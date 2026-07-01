const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const admin = require("firebase-admin");

const app = express();
const server = http.createServer(app);

// 🔥 إعداد CORS المرن لقبول الواجهات بجميع ميزاتها
const io = new Server(server, { 
    cors: { 
        origin: "*",
        methods: ["GET", "POST"]
    } 
});

app.use(express.static(__dirname));

const firebaseConfig = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
    : require("./firebase-key.json"); 

admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig),
  databaseURL: "https://thegame-9d23d-default-rtdb.firebaseio.com/" 
});

const db = admin.database();
let onlineUsersList = [];

io.on('connection', (socket) => {
    let currentLoggedUser = null;
    console.log(`📡 جهاز جديد متصل: ${socket.id}`);

    socket.on('authRequest', async (data) => {
        const { type, username, password } = data;
        if (!username || !password) {
            socket.emit('authResponse', { success: false, message: "الرجاء ملء جميع الحقول!" });
            return;
        }

        const userRef = db.ref('users/' + username);
        try {
            const snapshot = await userRef.once('value');
            if (type === 'register') {
                if (snapshot.exists()) {
                    socket.emit('authResponse', { success: false, message: "⚠️ اسم المستخدم مسجل بالفعل!" });
                } else {
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
                }
            } else if (type === 'login') {
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    if (userData.password === password) {
                        currentLoggedUser = username;
                        if (!onlineUsersList.includes(username)) onlineUsersList.push(username);
                        socket.emit('authResponse', { success: true, username: username });
                        io.emit('updateOnlineUsers', onlineUsersList);
                    } else {
                        socket.emit('authResponse', { success: false, message: "❌ كلمة المرور غير صحيحة!" });
                    }
                } else {
                    socket.emit('authResponse', { success: false, message: "❓ المستخدم غير موجود!" });
                }
            }
        } catch (error) {
            socket.emit('authResponse', { success: false, message: "حدث خطأ أثناء الاتصال بقاعدة البيانات." });
        }
    });

    socket.on('sendGlobalCommunityMessage', (data) => {
        io.emit('receiveGlobalCommunityMessage', { name: data.name, msg: data.msg });
    });

    socket.on('joinXOGame', (data) => {
        socket.join(data.roomCode);
    });

    socket.on('disconnect', () => {
        if (currentLoggedUser) {
            onlineUsersList = onlineUsersList.filter(u => u !== currentLoggedUser);
            io.emit('updateOnlineUsers', onlineUsersList);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل بنجاح على بورت: ${PORT}`);
});
