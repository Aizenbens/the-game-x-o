const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const admin = require("firebase-admin");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// تخديم ملفات الواجهة (مثل index.html) تلقائياً من المجلد الحالي
app.use(express.static(__dirname));

// 🔥 ربط Firebase بالسيرفر بشكل آمن يدعم الاستضافة والتشغيل المحلي
// إذا كان السيرفر يعمل على Render سيقرأ من الـ Environment Variable، وإذا كان محلياً سيقرأ من الملف
const firebaseConfig = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
    : require("./firebase-key.json"); 

admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig),
  // ⚠️ تأكد من أن هذا الرابط يطابق تماماً رابط الـ Realtime Database في حسابك
  databaseURL: "https://thegame-9d23d-default-rtdb.firebaseio.com/" 
});

const db = admin.database();
let onlineUsersList = [];

io.on('connection', (socket) => {
    let currentLoggedUser = null;
    console.log(`📡 جهاز جديد متصل: ${socket.id}`);

    // 🔐 استقبال طلبات التسجيل ودخول الحسابات وحفظها في Firebase
    socket.on('authRequest', async (data) => {
        const { type, username, password } = data;
        
        if (!username || !password) {
            socket.emit('authResponse', { success: false, message: "الرجاء ملء جميع الحقول!" });
            return;
        }

        const userRef = db.ref('users/' + username);

        try {
            const snapshot = await userRef.once('value');

            // منطق إنشاء حساب جديد
            if (type === 'register') {
                if (snapshot.exists()) {
                    socket.emit('authResponse', { success: false, message: "⚠️ اسم المستخدم مسجل بالفعل!" });
                } else {
                    // 💾 حفظ الحساب في Firebase بشكل دائم
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
                    console.log(`✨ مستخدم جديد تم حفظه بنجاح في Firebase: ${username}`);
                }
            } 
            
            // منطق تسجيل الدخول
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
            console.error("خطأ في الاتصال بقاعدة البيانات:", error);
            socket.emit('authResponse', { success: false, message: "حدث خطأ أثناء الاتصال بقاعدة البيانات." });
        }
    });

    // 💬 تمرير رسائل شات المجتمع العام فورياً لجميع الأجهزة
    socket.on('sendGlobalCommunityMessage', (data) => {
        io.emit('receiveGlobalCommunityMessage', { name: data.name, msg: data.msg });
    });

    // 🎮 منطق دخول غرف الـ XO أونلاين
    socket.on('joinXOGame', (data) => {
        socket.join(data.roomCode);
        console.log(`👤 اللاعب ${data.name} دخل الغرفة المشتركة رقم: ${data.roomCode}`);
    });

    // 🚶 معالجة خروج اللاعب عند إغلاق التاب أو انقطاع الاتصال
    socket.on('disconnect', () => {
        if (currentLoggedUser) {
            onlineUsersList = onlineUsersList.filter(u => u !== currentLoggedUser);
            io.emit('updateOnlineUsers', onlineUsersList);
            console.log(`🚶 غادر المستخدم: ${currentLoggedUser}`);
        }
    });
});

// إعداد البورت ليتوافق مع بورت Render الديناميكي أو 3000 محلياً
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل الآن بنجاح ومستعد للاستضافة على البورت: ${PORT}`);
});
