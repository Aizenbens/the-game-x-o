const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// تقديم الملفات الثابتة من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};
const MAP_SIZE = 2500;
const GRID_SIZE = 14;

// دالة توليد الحلويات الافتراضية للغرفة عند إنشائها
function generateCandies() {
    const types = [{ val: 10, size: 4, col: "#ec4899" }, { val: 25, size: 6, col: "#06b6d4" }, { val: 50, size: 8, col: "#eab308" }];
    let arr = [];
    for(let i=0; i<300; i++) {
        let select = types[Math.floor(Math.random() * types.length)];
        arr.push({
            id: Math.random().toString(36).substring(2, 9),
            x: Math.floor(Math.random() * (MAP_SIZE / GRID_SIZE)) * GRID_SIZE,
            y: Math.floor(Math.random() * (MAP_SIZE / GRID_SIZE)) * GRID_SIZE,
            value: select.val, size: select.size, color: select.col
        });
    }
    return arr;
}

io.on('connection', (socket) => {
    console.log(`👤 اتصال جديد: ${socket.id}`);

    // انضمام لاعب لغرفة معينة
    socket.on('joinRoom', ({ roomCode, username, color, isSnakeMode }) => {
        if (!roomCode || !username) return;
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.username = username;
        
        // إنشاء الغرفة في الذاكرة إذا لم تكن موجودة
        if (!rooms[roomCode]) {
            rooms[roomCode] = {
                code: roomCode,
                players: {},
                candies: generateCandies()
            };
        }

        // إضافة أو تحديث بيانات اللاعب داخل الغرفة
        rooms[roomCode].players[socket.id] = {
            id: socket.id,
            username: username,
            color: color || '#a855f7',
            body: [], 
            score: 250,
            direction: 'RIGHT'
        };

        // إرسال البيانات المحدثة لجميع اللاعبين في الغرفة
        io.to(roomCode).emit('roomUpdate', { 
            players: Object.values(rooms[roomCode].players),
            candies: rooms[roomCode].candies
        });
    });

    // استقبال تحديثات الدودة وإعادة بثها للبقية
    socket.on('snakeUpdate', (snakeData) => {
        const roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode] && rooms[roomCode].players[socket.id]) {
            rooms[roomCode].players[socket.id].body = snakeData.body;
            rooms[roomCode].players[socket.id].score = snakeData.score;
            rooms[roomCode].players[socket.id].direction = snakeData.direction;
            
            // بث الإحداثيات لكل اللاعبين في الغرفة ما عدا الراسل لتجنب الارتداد (Lag)
            socket.to(roomCode).emit('snakePositions', Object.values(rooms[roomCode].players));
        }
    });

    // إدارة أكل الحلويات المتزامنة
    socket.on('candyEaten', (candyId) => {
        const roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode]) {
            // التحقق من وجود الحلوى قبل حذفها لمنع تكرار الأكل من لاعبين في نفس الوقت
            const exists = rooms[roomCode].candies.some(c => c.id === candyId);
            if (exists) {
                rooms[roomCode].candies = rooms[roomCode].candies.filter(c => c.id !== candyId);
                io.to(roomCode).emit('candyRemoved', candyId);
                
                // تعويض الحلوى المأكولة فوراً بحلوى جديدة في إحداثيات عشوائية
                const types = [{ val: 10, size: 4, col: "#ec4899" }, { val: 25, size: 6, col: "#06b6d4" }, { val: 50, size: 8, col: "#eab308" }];
                let select = types[Math.floor(Math.random() * types.length)];
                let newCandy = {
                    id: Math.random().toString(36).substring(2, 9),
                    x: Math.floor(Math.random() * (MAP_SIZE / GRID_SIZE)) * GRID_SIZE,
                    y: Math.floor(Math.random() * (MAP_SIZE / GRID_SIZE)) * GRID_SIZE,
                    value: select.val, size: select.size, color: select.col
                };
                rooms[roomCode].candies.push(newCandy);
                io.to(roomCode).emit('newCandySpawned', newCandy);
            }
        }
    });

    // بث حركات الـ XO للخصم
    socket.on('xoMove', (data) => {
        if (socket.roomCode) {
            socket.to(socket.roomCode).emit('xoMoveReceived', data);
        }
    });

    // بث حركات الشطرنج للخصم
    socket.on('chessMove', (data) => {
        if (socket.roomCode) {
            socket.to(socket.roomCode).emit('chessMoveReceived', data);
        }
    });

    // عند مغادرة اللاعب أو انقطاع الاتصال
    socket.on('disconnect', () => {
        const roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode]) {
            delete rooms[roomCode].players[socket.id];
            
            // إذا فرغت الغرفة تماماً يتم مسحها لتوفير ذاكرة السيرفر
            if (Object.keys(rooms[roomCode].players).length === 0) {
                delete rooms[roomCode];
            } else {
                // إرسال القائمة المحدثة للاعب المتبقي
                io.to(roomCode).emit('roomUpdate', { 
                    players: Object.values(rooms[roomCode].players),
                    candies: rooms[roomCode].candies
                });
                io.to(roomCode).emit('snakePositions', Object.values(rooms[roomCode].players));
            }
        }
        console.log(`❌ انقطع اتصال: ${socket.id}`);
    });
});

// تعيين البورت بشكل ديناميكي ليتوافق مع منصة الاستضافة Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 السيرفر المطور يعمل بكفاءة على البورت ${PORT}`));
