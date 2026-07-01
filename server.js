const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(__dirname));

let onlineUsers = {}; 
let xoRooms = {};     // roomCode: {players: [], board: [], turn: "X", scores: {socketId: 0}, round: 1}
let snakeRooms = {};  // roomCode: {players: {}, candies: [], bots: {}}

const GRID_SIZE = 20;
const MAP_WIDTH = 1500;  // خريطة دودة عملاقة
const MAP_HEIGHT = 1500;

// أنواع الحلويات الـ 3D المتاحة عشوائياً
const CANDY_TYPES = ['donut', 'cupcake', 'icecream', 'lollipop', 'candy'];

// محرك تحديث غرف الدودة أونلاين (كل 100 ملي ثانية)
setInterval(() => {
    for (let rCode in snakeRooms) {
        let room = snakeRooms[rCode];
        let allActive = { ...room.players, ...room.bots };

        // 1. تحريك البوتات ذكائياً نحو أقرب حلوى
        for (let bId in room.bots) {
            let bot = room.bots[bId];
            if (room.candies.length > 0) {
                let target = room.candies[0];
                let head = bot.body[0];
                if (target.x > head.x && bot.direction !== "LEFT") bot.direction = "RIGHT";
                else if (target.x < head.x && bot.direction !== "RIGHT") bot.direction = "LEFT";
                else if (target.y > head.y && bot.direction !== "DOWN") bot.direction = "UP";
                else if (target.y < head.y && bot.direction !== "UP") bot.direction = "DOWN";
            }
        }

        // 2. تحديث حركة جميع الديدان (لاعبين وبوتات)
        for (let id in allActive) {
            let p = allActive[id];
            let head = { ...p.body[0] };

            if (p.direction === "UP") head.y -= GRID_SIZE;
            if (p.direction === "DOWN") head.y += GRID_SIZE;
            if (p.direction === "LEFT") head.x -= GRID_SIZE;
            if (p.direction === "RIGHT") head.x += GRID_SIZE;

            // الحدود التلقائية (الالتفاف حول الخريطة لمنع الموت العشوائي)
            if (head.x < 0) head.x = MAP_WIDTH - GRID_SIZE;
            if (head.x >= MAP_WIDTH) head.x = 0;
            if (head.y < 0) head.y = MAP_HEIGHT - GRID_SIZE;
            if (head.y >= MAP_HEIGHT) head.y = 0;

            // التحقق من أكل الحلويات
            let ate = false;
            for (let i = room.candies.length - 1; i >= 0; i--) {
                let c = room.candies[i];
                if (Math.abs(head.x - c.x) < GRID_SIZE && Math.abs(head.y - c.y) < GRID_SIZE) {
                    p.score += 10;
                    room.candies.splice(i, 1);
                    ate = true;
                    // إضافة حلوى جديدة بديلة
                    room.candies.push({
                        x: Math.floor(Math.random() * (MAP_WIDTH / GRID_SIZE)) * GRID_SIZE,
                        y: Math.floor(Math.random() * (MAP_HEIGHT / GRID_SIZE)) * GRID_SIZE,
                        type: CANDY_TYPES[Math.floor(Math.random() * CANDY_TYPES.length)]
                    });
                    break;
                }
            }

            if (!ate) p.body.pop();
            p.body.unshift(head);
        }

        // 3. قوانين التصادم الصارمة (جسم الدودة والرأس)
        let toRespawn = [];
        for (let id1 in allActive) {
            let p1 = allActive[id1];
            let h1 = p1.body[0];

            for (let id2 in allActive) {
                let p2 = allActive[id2];
                let h2 = p2.body[0];

                if (id1 === id2) {
                    // اصطدام اللاعب بجسمه هو
                    if (p1.body.slice(1).some(seg => seg.x === h1.x && seg.y === h1.y)) {
                        toRespawn.push(id1);
                    }
                    continue;
                }

                // قاعدة 1: إذا اصطدم رأس لاعب 1 برأس لاعب 2 -> يموت الاثنان فوراً ويعيدان
                if (h1.x === h2.x && h1.y === h2.y) {
                    if (!toRespawn.includes(id1)) toRespawn.push(id1);
                    if (!toRespawn.includes(id2)) toRespawn.push(id2);
                    continue;
                }

                // قاعدة 2: إذا اصطدم رأس لاعب 1 بجسم لاعب 2 -> يموت لاعب 1 فقط
                if (p2.body.slice(1).some(seg => seg.x === h1.x && seg.y === h1.y)) {
                    if (!toRespawn.includes(id1)) toRespawn.push(id1);
                }
            }
        }

        // تنفيذ إعادة الإحياء الفورية (حلقة لا متناهية من التحدي)
        toRespawn.forEach(id => {
            let target = room.players[id] || room.bots[id];
            if (target) {
                target.score = 0;
                target.body = [{
                    x: Math.floor(Math.random() * 30 + 10) * GRID_SIZE,
                    y: Math.floor(Math.random() * 30 + 10) * GRID_SIZE
                }];
                target.direction = ["UP", "DOWN", "LEFT", "RIGHT"][Math.floor(Math.random() * 4)];
            }
        });

        // إرسال البيانات المحدثة لجميع داخل الغرفة الخاصة
        io.to(rCode).emit('snakeRoomUpdate', { players: room.players, bots: room.bots, candies: room.candies });
    }
}, 100);

io.on('connection', (socket) => {
    
    socket.on('joinHub', (data) => {
        onlineUsers[socket.id] = { username: data.username, color: data.color };
        io.emit('updateOnlineUsers', Object.values(onlineUsers));
    });

    socket.on('sendChatMessage', (data) => {
        io.to(data.roomCode).emit('receiveChatMessage', data);
    });

    // إعداد ودخول غرف الدودة الخاصة المشفرة أونلاين مع إضافة البوتات
    socket.on('joinSnakeRoom', (data) => {
        const { roomCode, username, color } = data;
        socket.join(roomCode);

        if (!snakeRooms[roomCode]) {
            snakeRooms[roomCode] = { players: {}, candies: [], bots: {} };
            // توليد 40 حلوى متنوعة داخل الغرفة عند إنشائها أول مرة
            for (let i = 0; i < 40; i++) {
                snakeRooms[roomCode].candies.push({
                    x: Math.floor(Math.random() * (MAP_WIDTH / GRID_SIZE)) * GRID_SIZE,
                    y: Math.floor(Math.random() * (MAP_HEIGHT / GRID_SIZE)) * GRID_SIZE,
                    type: CANDY_TYPES[Math.floor(Math.random() * CANDY_TYPES.length)]
                });
            }
            // إضافة بوتين تلقائيين (AI) لزيادة حماس الغرفة الفردية والخاصة
            for (let b = 1; b <= 2; b++) {
                let bId = `bot_${roomCode}_${b}`;
                snakeRooms[roomCode].bots[bId] = {
                    body: [{ x: 400 + b * 100, y: 400 }],
                    direction: "DOWN",
                    score: 0,
                    username: `🤖 بوت ذكي ${b}`,
                    color: b === 1 ? "#ff00ff" : "#00ffff"
                };
            }
        }

        snakeRooms[roomCode].players[socket.id] = {
            body: [{ x: Math.floor(Math.random() * 40) * GRID_SIZE, y: Math.floor(Math.random() * 40) * GRID_SIZE }],
            direction: "RIGHT",
            score: 0,
            username: username,
            color: color
        };
    });

    socket.on('snakeRoomDirection', (data) => {
        const { roomCode, direction } = data;
        if (snakeRooms[roomCode] && snakeRooms[roomCode].players[socket.id]) {
            let p = snakeRooms[roomCode].players[socket.id];
            // منع الالتفاف العكسي المباشر لحركة مرنة وصحيحة
            if (direction === "UP" && p.direction !== "DOWN") p.direction = "UP";
            if (direction === "DOWN" && p.direction !== "UP") p.direction = "DOWN";
            if (direction === "LEFT" && p.direction !== "RIGHT") p.direction = "LEFT";
            if (direction === "RIGHT" && p.direction !== "LEFT") p.direction = "RIGHT";
        }
    });

    // نظام غرف XO المتطور أونلاين (نظام الجولات والشات الخاص للمباراة)
    socket.on('joinXOGame', (data) => {
        const { roomCode, username } = data;
        socket.join(roomCode);

        if (!xoRooms[roomCode]) {
            xoRooms[roomCode] = { players: [], board: Array(9).fill(""), turn: "X", scores: {}, round: 1 };
        }

        let room = xoRooms[roomCode];
        if (room.players.length < 2 && !room.players.includes(socket.id)) {
            room.players.push(socket.id);
            room.scores[socket.id] = 0;
        }

        const symbol = room.players.indexOf(socket.id) === 0 ? "X" : "O";
        socket.emit('xoInit', { symbol });

        if (room.players.length === 2) {
            io.to(roomCode).emit('xoStart', { turn: "X", round: room.round, scores: room.scores });
        } else {
            socket.emit('xoWaiting', "في انتظار منافس لدخول الغرفة...");
        }
    });

    socket.on('makeXOMove', (data) => {
        const { roomCode, index, symbol } = data;
        let room = xoRooms[roomCode];
        if (room && room.turn === symbol && room.board[index] === "") {
            room.board[index] = symbol;
            
            // التحقق من فوز الجولة الحالية
            if (checkServerWin(room.board, symbol)) {
                room.scores[socket.id] += 1;
                room.round += 1;
                room.board.fill("");
                room.turn = "X";
                io.to(roomCode).emit('xoRoundEnd', { winnerSymbol: symbol, scores: room.scores, round: room.round, board: room.board });
            } else if (!room.board.includes("")) {
                // تعادل في الجولة
                room.round += 1;
                room.board.fill("");
                room.turn = "X";
                io.to(roomCode).emit('xoRoundEnd', { winnerSymbol: "تعادل", scores: room.scores, round: room.round, board: room.board });
            } else {
                room.turn = symbol === "X" ? "O" : "X";
                io.to(roomCode).emit('xoUpdate', { board: room.board, turn: room.turn });
            }
        }
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        for (let rCode in snakeRooms) {
            if (snakeRooms[rCode].players[socket.id]) {
                delete snakeRooms[rCode].players[socket.id];
            }
        }
        io.emit('updateOnlineUsers', Object.values(onlineUsers));
    });
});

function checkServerWin(b, s) {
    const w = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return w.some(p => b[p[0]] === s && b[p[1]] === s && b[p[2]] === s);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Ultimate 3D Candy Server fully active on port ${PORT}`));
