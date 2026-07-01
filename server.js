const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const activeRooms = {};
const candyIcons = ["🍬", "🍭", "🍫", "🍩", "🧁"];

const randomDir = () => ['UP', 'DOWN', 'LEFT', 'RIGHT'][Math.floor(Math.random() * 4)];

io.on('connection', (socket) => {

    socket.on('startSingleSnake', (data) => {
        const roomCode = "ROOM_" + socket.id;
        activeRooms[roomCode] = {
            game: 'snake',
            players: {},
            candies: [],
            interval: null
        };

        activeRooms[roomCode].players[socket.id] = {
            id: socket.id,
            name: data.name || "أنت",
            color: data.color || "#10b981",
            body: [{ x: 300, y: 300 }, { x: 280, y: 300 }],
            dir: 'RIGHT',
            score: 0,
            isBot: false
        };

        // ضخ 12 بوت
        for (let i = 1; i <= 12; i++) {
            activeRooms[roomCode].players["BOT_" + i] = {
                id: "BOT_" + i,
                name: "🤖 بوت خصم " + i,
                color: ["#f43f5e", "#a855f7", "#38bdf8", "#eab308", "#64748b"][Math.floor(Math.random() * 5)],
                body: [{ x: Math.random() * 1100 + 50, y: Math.random() * 700 + 50 }],
                dir: randomDir(),
                score: 0,
                isBot: true
            };
        }

        // توزيع 40 حلوى
        for (let j = 0; j < 40; j++) {
            activeRooms[roomCode].candies.push({
                x: Math.random() * 1100 + 50,
                y: Math.random() * 700 + 50,
                type: candyIcons[Math.floor(Math.random() * candyIcons.length)]
            });
        }

        socket.join(roomCode);
        socket.emit('roomConnected', { roomCode, game: 'snake' });
        
        runSnakeEngine(roomCode);
    });

    socket.on('createNewRoom', (data) => {
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        activeRooms[roomCode] = { game: data.game, players: {}, candies: [], interval: null };
        
        activeRooms[roomCode].players[socket.id] = {
            id: socket.id, name: data.name, color: data.color,
            body: [{ x: 200, y: 200 }], dir: 'RIGHT', score: 0, isBot: false
        };
        socket.join(roomCode);
        socket.emit('roomConnected', { roomCode, game: data.game });
    });

    socket.on('moveSnakeDirect', (data) => {
        const room = activeRooms[data.roomCode];
        if (room && room.players[socket.id]) {
            room.players[socket.id].dir = data.dir;
        }
    });

    socket.on('disconnect', () => {
        for (let code in activeRooms) {
            if (activeRooms[code].players[socket.id]) {
                clearInterval(activeRooms[code].interval);
                delete activeRooms[code];
            }
        }
    });
});

function runSnakeEngine(code) {
    const room = activeRooms[code];
    if (!room) return;

    room.interval = setInterval(() => {
        const playersList = Object.keys(room.players);
        const deadPlayers = new Set(); // لتخزين من سيموت في هذا الفريم لمنع الأخطاء التزامنية

        // 1. تحريك كل الدود (اللاعبين والبوتات) خطوة للأمام
        playersList.forEach(id => {
            const p = room.players[id];
            if (!p) return;

            if (p.isBot && Math.random() < 0.15) {
                p.dir = randomDir();
            }

            let head = { ...p.body[0] };
            if (p.dir === 'UP') head.y -= 12;
            if (p.dir === 'DOWN') head.y += 12;
            if (p.dir === 'LEFT') head.x -= 12;
            if (p.dir === 'RIGHT') head.x += 12;

            if (head.x < 0) head.x = 1300; if (head.x > 1300) head.x = 0;
            if (head.y < 0) head.y = 800; if (head.y > 800) head.y = 0;

            p.body.unshift(head);

            // أكل الحلويات
            let ateCandy = false;
            room.candies.forEach((candy, index) => {
                if (Math.hypot(head.x - candy.x, head.y - candy.y) < 25) {
                    p.score += 10;
                    ateCandy = true;
                    room.candies[index] = {
                        x: Math.random() * 1200 + 40,
                        y: Math.random() * 750 + 40,
                        type: candyIcons[Math.floor(Math.random() * candyIcons.length)]
                    };
                }
            });

            if (!ateCandy) p.body.pop();
        });

        // 2. فحص قوانين الاصطدام المتقدمة (رأس برأس أو رأس بجسم)
        playersList.forEach(id1 => {
            const p1 = room.players[id1];
            if (!p1) return;
            const head1 = p1.body[0];

            playersList.forEach(id2 => {
                if (id1 === id2) return; // لا يفحص نفسه مع نفسه
                
                const p2 = room.players[id2];
                if (!p2) return;
                const head2 = p2.body[0];

                // أ. فحص اصطدام (رأس برأس) -> يموت الاثنان معاً
                if (Math.hypot(head1.x - head2.x, head1.y - head2.y) < 15) {
                    deadPlayers.add(id1);
                    deadPlayers.add(id2);
                }

                // ب. فحص اصطدام (رأس لاعب 1 بجسم لاعب 2) -> يموت لاعب 1 فقط
                // نبدأ الفحص من العقدة رقم 1 (تخطي الرأس لأنه فُحص بالأعلى)
                for (let i = 1; i < p2.body.length; i++) {
                    if (Math.hypot(head1.x - p2.body[i].x, head1.y - p2.body[i].y) < 12) {
                        deadPlayers.add(id1);
                        break; 
                    }
                }
            });
        });

        // 3. إعادة إحياء (Respawn) وتصفير نقاط كل من مات في هذا الفريم
        deadPlayers.forEach(id => {
            const p = room.players[id];
            if (p) {
                p.body = [{ x: Math.random() * 1100 + 50, y: Math.random() * 700 + 50 }];
                p.score = 0;
            }
        });

        // 4. إرسال البيانات وتحديث المتصدرين
        const leaderboard = Object.values(room.players)
            .map(p => ({ id: p.id, name: p.name, score: p.score }))
            .sort((a, b) => b.score - a.score);

        io.to(code).emit('renderSnakeFrame', {
            snakes: Object.values(room.players),
            candies: room.candies,
            leaderboard: leaderboard
        });

    }, 100);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Fixed physics engine running on port ${PORT}`));
