const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
var admin = require("firebase-admin");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

// 🔥 ربط Firebase بالسيرفر
var serviceAccount = require("./firebase-key.json"); 
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://thegame-9d23d-default-rtdb.firebaseio.com/" // تأكد من مطابقة الرابط الخاص بك
});

const db = admin.database();
let onlineUsersList = [];

io.on('connection', (socket) => {
    let currentLoggedUser = null;
    console.log(`📡 جهاز جديد متصل: ${socket.id}`);

    // استقبال طلبات التسجيل ودخول الحسابات وحفظها في Firebase
    socket.on('authRequest', async (data) => {
        const { type, username, password } = data;
        const userRef = db.ref('users/' + username);

        try {
            const snapshot = await userRef.once('value');

            if (type === 'register') {
                if (snapshot.exists()) {
                    socket.emit('authResponse', { success: false, message: "⚠️ اسم المستخدم مسجل بالفعل!" });
                } else {
                    // 💾 حفظ الحساب في Firebase
                    await userRef.set({
                        password: password,
                        highScoreSnake: 0,
                        winsXO: 0,
                        createdAt: new Date().toISOString()
                    });
                    
                    currentLoggedUser = username;
                    if (!onlineUsersList.includes(username)) onlineUsersList.push(username);
                    
                    socket.emit('authResponse', { success: true, username: username });
                    io.emit('updateOnlineUsers', onlineUsersList);
                    console.log(`✨ مستخدم جديد في Firebase: ${username}`);
                }
            } 
            
            else if (type === 'login') {
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    if (userData.password === password) {
                        currentLoggedUser = username;
                        if (!onlineUsersList.includes(username)) onlineUsersList.push(username);
                        
                        socket.emit('authResponse', { success: true, username: username });
                        io.emit('updateOnlineUsers', onlineUsersList);
                        console.log(`🔓 سجل دخول بنجاح: ${username}`);
                    } else {
                        socket.emit('authResponse', { success: false, message: "❌ كلمة المرور غير صحيحة!" });
                    }
                } else {
                    socket.emit('authResponse', { success: false, message: "❓ المستخدم غير موجود!" });
                }
            }
        } catch (error) {
            console.error("خطأ في قاعدة البيانات:", error);
            socket.emit('authResponse', { success: false, message: "حدث خطأ في الاتصال بقاعدة البيانات." });
        }
    });

    // شات المجتمع العام
    socket.on('sendGlobalCommunityMessage', (data) => {
        io.emit('receiveGlobalCommunityMessage', { name: data.name, msg: data.msg });
    });

    socket.on('disconnect', () => {
        if (currentLoggedUser) {
            onlineUsersList = onlineUsersList.filter(u => u !== currentLoggedUser);
            io.emit('updateOnlineUsers', onlineUsersList);
            console.log(`🚶 غادر المستخدم: ${currentLoggedUser}`);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل الآن بنجاح على: http://localhost:${PORT}`);
});
