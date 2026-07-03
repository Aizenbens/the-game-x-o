const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};
const MAP_SIZE = 2500;
const GRID_SIZE = 14;

// دالة لتوليد الحلويات عشوائياً في الغرفة
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
    // انضمام لاعب لغرفة
    socket.on('joinRoom', ({ roomCode, username, color, isSnakeMode }) => {
        if (!roomCode || !username) return;
        socket.join(roomCode);
        
        if (!rooms[roomCode]) {
            rooms[roomCode] = {
                code: roomCode,
                players: {},
                candies: isSnakeMode ? generateCandies() : [],
                magnets: []
            };
        }

        // إضافة اللاعب للغرفة ببيانات الدودة الخاصة به
        rooms[roomCode].players[socket.id] = {
            id: socket.id,
            username: username,
            color: color || '#a855f7',
            body: [], 
            score: 0,
            direction: 'RIGHT'
        };
        
        socket.roomCode = roomCode;
        socket.username = username;

        // إرسال تحديث الغرفة والحلويات الابتدائية
        io.to(roomCode).emit('roomUpdate', { 
            players: Object.values(rooms[roomCode].players),
            candies: rooms[roomCode].candies,
            magnets: rooms[roomCode].magnets
        });
    });

    // مزامنة حركة الدودة من العميل (Client) إلى باقي اللاعبين في الغرفة
    socket.on('snakeUpdate', (snakeData) => {
        const roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode] && rooms[roomCode].players[socket.id]) {
            rooms[roomCode].players[socket.id].body = snakeData.body;
            rooms[roomCode].players[socket.id].score = snakeData.score;
            rooms[roomCode].players[socket.id].direction = snakeData.direction;
            
            // بث تحديثات اللاعبين لجميع من في الغرفة
            socket.to(roomCode).emit('snakePositions', Object.values(rooms[roomCode].players));
        }
    });

    // مزامنة أكل الحلويات أونلاين
    socket.on('candyEaten', (candyId) => {
        const roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode]) {
            rooms[roomCode].candies = rooms[roomCode].candies.filter(c => c.id !== candyId);
            io.to(roomCode).emit('candyRemoved', candyId);
            
            // تعويض الحلوى المأكولة بحلوى جديدة
            if (rooms[roomCode].candies.length < 150) {
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

    // مزامنة حركات XO أونلاين
    socket.on('xoMove', (data) => {
        if (socket.roomCode) socket.to(socket.roomCode).emit('xoMoveReceived', data);
    });

    // مزامنة حركات الشطرنج أونلاين
    socket.on('chessMove', (data) => {
        if (socket.roomCode) socket.to(socket.roomCode).emit('chessMoveReceived', data);
    });

    // عند مغادرة اللاعب أو انقطاع اتصاله
    socket.on('disconnect', () => {
        const roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode]) {
            delete rooms[roomCode].players[socket.id];
            if (Object.keys(rooms[roomCode].players).length === 0) {
                delete rooms[roomCode];
            } else {
                io.to(roomCode).emit('roomUpdate', { players: Object.values(rooms[roomCode].players) });
                io.to(roomCode).emit('playerLeftEvent', socket.id);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 السيرفر يعمل على: http://localhost:${PORT}`));
