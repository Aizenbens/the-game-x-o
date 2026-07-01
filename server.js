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

const rooms = {};
const canvasSize = 500;
const step = 20;
const candyTypes = ["🍬", "🍭", "🍩", "🍫", "🧁"];

function generateCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

io.on('connection', (socket) => {

    // تفعيل لعبة الدودة الفردية والمحلية بـ 12 بوت عالي الأداء فوراً
    socket.on('startSingleSnake', (data) => {
        const roomCode = "SINGLE_" + socket.id;
        rooms[roomCode] = {
            game: 'snake',
            isSingle: true,
            players: {},
            candies: [],
            loop: null
        };

        // إضافة دودة اللاعب البشري الأساسي
        rooms[roomCode].players[socket.id] = {
            name: data.name || "أنت",
            body: [{ x: 200, y: 200 }],
            dir: 'RIGHT',
            score: 0,
            color: data.color || '#22c55e',
            isBot: false
        };

        // حقن وضخ 12 بوت متفاعل ومنظم داخل بيئة اللعب الفردية
        for (let i = 1; i <= 12; i++) {
            rooms[roomCode].players["BOT_" + i] = {
                name: "البوت الخصم " + i,
                body: [{ x: Math.floor(Math.random() * 20) * step, y: Math.floor(Math.random() * 20) * step }],
                dir: ['UP', 'DOWN', 'LEFT', 'RIGHT'][Math.floor(Math.random() * 4)],
                score: 0,
                color: '#64748b',
                isBot: true
            };
        }

        // نشر وتوزيع الحلويات والسكاكر العشوائية
        for (let j = 0; j < 15; j++) {
            rooms[roomCode].candies.push({
                x: Math.floor(Math.random() * 24) * step,
                y: Math.floor(Math.random() * 24) * step,
                type: candyTypes[Math.floor(Math.random() * candyTypes.length)]
            });
        }

        socket.emit('roomReady', { roomCode, game: 'snake' });
        runSnakeEngine(roomCode);
    });

    socket.on('createRoom', (data) => {
        const roomCode = generateCode();
        rooms[roomCode] = {
            game: data.game,
            isSingle: false,
            players: {},
            candies: [],
            xoBoard: Array(9).fill(null),
            xoTurn: 'X'
        };

        rooms[roomCode].players[socket.id] = {
            name: data.name,
            body: [{ x: 60, y: 60 }],
            dir: 'RIGHT',
            score: 0,
            color: data.color,
            sign: 'X',
            isBot: false
        };

        socket.join(roomCode);
        socket.emit('roomReady', { roomCode, game: data.game });
    });

    socket.on('joinRoom', (data) => {
        const room = rooms[data.roomCode];
        if(!room) return;

        room.players[socket.id] = {
            name: data.name,
            body: [{ x: 300, y: 300 }],
            dir: 'LEFT',
            score: 0,
            color: data.color,
            sign: 'O',
            isBot: false
        };

        socket.join(data.roomCode);
        io.to(data.roomCode).emit('roomReady', { roomCode: data.roomCode, game: room.game });

        if(room.game === 'snake') {
            for (let j = 0; j < 12; j++) {
                room.candies.push({
                    x: Math.floor(Math.random() * 24) * step,
                    y: Math.floor(Math.random() * 24) * step,
                    type: candyTypes[Math.floor(Math.random() * candyTypes.length)]
                });
            }
            runSnakeEngine(data.roomCode);
        } else {
            io.to(data.roomCode).emit('startRoundXO', { currentTurn: 'X' });
        }
    });

    socket.on('snakeDirection', (data) => {
        const room = rooms[data.roomCode];
        if(room && room.players[socket.id]) {
            const p = room.players[socket.id];
            if(data.direction === 'UP' && p.dir !== 'DOWN') p.dir = 'UP';
            if(data.direction === 'DOWN' && p.dir !== 'UP') p.dir = 'DOWN';
            if(data.direction === 'LEFT' && p.dir !== 'RIGHT') p.dir = 'LEFT';
            if(data.direction === 'RIGHT' && p.dir !== 'LEFT') p.dir = 'RIGHT';
        }
    });

    socket.on('disconnect', () => {
        for(let code in rooms) {
            if(rooms[code].players[socket.id]) {
                clearInterval(rooms[code].loop);
                delete rooms[code];
            }
        }
    });
});

// محرك الدورة الشامل لحساب حركات الـ 12 بوت والموت والتجدد المباشر
function runSnakeEngine(code) {
    const room = rooms[code];
    if(!room) return;

    room.loop = setInterval(() => {
        const playersList = Object.keys(room.players);

        playersList.forEach(id => {
            const p = room.players[id];
            
            // ذكاء اصطناعي بسيط ومبهر لحركة الـ 12 بوت نحو أقرب حلوى
            if(p.isBot && room.candies.length > 0) {
                const target = room.candies[0];
                const head = p.body[0];
                if(target.x > head.x && p.dir !== 'LEFT') p.dir = 'RIGHT';
                else if(target.x < head.x && p.dir !== 'RIGHT') p.dir = 'LEFT';
                else if(target.y > head.y && p.dir !== 'UP') p.dir = 'DOWN';
                else if(target.y < head.y && p.dir !== 'DOWN') p.dir = 'UP';
            }

            let head = { ...p.body[0] };
            if (p.dir === 'UP') head.y -= step;
            if (p.dir === 'DOWN') head.y += step;
            if (p.dir === 'LEFT') head.x -= step;
            if (p.dir === 'RIGHT') head.x += step;

            // حماية حدود جدران الساحة
            if(head.x < 0) head.x = canvasSize - step;
            if(head.x >= canvasSize) head.x = 0;
            if(head.y < 0) head.y = canvasSize - step;
            if(head.y >= canvasSize) head.y = 0;

            p.body.unshift(head);

            // التحقق من التهام الحلويات الملونة
            let ate = false;
            room.candies.forEach((candy, cIdx) => {
                if(head.x === candy.x && head.y === candy.y) {
                    p.score += 10; // زيادة الرصيد بمقدار 10 نقاط لكل قطة حلوى
                    ate = true;
                    room.candies[cIdx] = {
                        x: Math.floor(Math.random() * 24) * step,
                        y: Math.floor(Math.random() * 24) * step,
                        type: candyTypes[Math.floor(Math.random() * candyTypes.length)]
                    };
                }
            });

            if(!ate) p.body.pop();

            // تحقق من شروط الموت والاصطدام (التجدد الفوري للبوتات من الصفر)
            playersList.forEach(otherId => {
                if(id !== otherId) {
                    const other = room.players[otherId];
                    other.body.forEach(part => {
                        if(head.x === part.x && head.y === part.y) {
                            // إذا مات البوت أو اللاعب يعود من الأول بصفر نقاط
                            p.body = [{ x: Math.floor(Math.random() * 20) * step, y: Math.floor(Math.random() * 20) * step }];
                            p.score = 0;
                        }
                    });
                }
            });
        });

        // إنشاء وتحديث قائمة الترتيب المباشر (Leaderboard) على السيرفر
        const leaderboard = Object.values(room.players)
            .map(p => ({ name: p.name, score: p.score }))
            .sort((a, b) => b.score - a.score);

        io.to(code).emit('snakeUpdate', {
            snakes: Object.values(room.players),
            candies: room.candies,
            leaderboard: leaderboard
        });

    }, 130);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Platform live on port ' + PORT));
