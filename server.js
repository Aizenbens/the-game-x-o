const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

const allRooms = {}; 
const xoRooms = {};  
const candyIcons = ["🍬", "🍭", "🍫", "🍩"];
const randomDir = () => ['UP', 'DOWN', 'LEFT', 'RIGHT'][Math.floor(Math.random() * 4)];

io.on('connection', (socket) => {

    // --- منطومة الـ XO أونلاين والغرف الخاصة والشات التابع لها ---
    socket.on('joinXOGame', (data) => {
        const { roomCode, name } = data;
        socket.join(roomCode);
        socket.xoRoom = roomCode;
        socket.nickname = name;

        if (!xoRooms[roomCode]) {
            xoRooms[roomCode] = {
                board: Array(9).fill(null),
                players: {}, 
                playerOrder: [],
                turn: null,
                winner: null
            };
        }

        const room = xoRooms[roomCode];
        
        if (room.playerOrder.length < 2 && !room.players[socket.id]) {
            room.playerOrder.push(socket.id);
            room.players[socket.id] = room.playerOrder.length === 1 ? 'X' : 'O';
        }

        if (room.playerOrder.length === 2 && !room.turn) {
            room.turn = room.playerOrder[0];
        }

        io.to(roomCode).emit('receiveXOMessage', { system: true, msg: `📢 انضم ${name} إلى تحدي XO والشات!` });
        io.to(roomCode).emit('updateXOBoard', room);
    });

    socket.on('makeXOMove', (data) => {
        const room = xoRooms[data.roomCode];
        if (room && room.turn === socket.id && !room.winner && !room.board[data.index]) {
            const sign = room.players[socket.id];
            room.board[data.index] = sign;

            if (checkXOWin(room.board, sign)) {
                room.winner = socket.id;
            } else if (room.board.every(b => b !== null)) {
                room.winner = 'draw';
            } else {
                room.turn = room.playerOrder.find(id => id !== socket.id);
            }
            io.to(data.roomCode).emit('updateXOBoard', room);
        }
    });

    socket.on('sendXOMessage', (data) => {
        io.to(data.roomCode).emit('receiveXOMessage', { name: data.name, msg: data.msg });
    });

    // --- منظومة غرف الدودة ثلاثية الأبعاد (محتفظ بها بالكامل) ---
    socket.on('joinSnakeGame', (data) => {
        const { mode, roomCode, name, color, headSkin } = data;
        socket.join(roomCode);

        if (!allRooms[roomCode]) {
            allRooms[roomCode] = { mode: mode, snakes: {}, candies: [], magnet: { x: 450, y: 350, taken: true, spawnTimer: 0 }, interval: null };
            for (let j = 0; j < 50; j++) {
                allRooms[roomCode].candies.push({ x: Math.random() * 1250 + 35, y: Math.random() * 750 + 35, type: candyIcons[Math.floor(Math.random() * candyIcons.length)] });
            }
            if (mode === 'global' || mode === 'bots') {
                for (let i = 1; i <= 14; i++) {
                    allRooms[roomCode].snakes["BOT_" + i] = {
                        id: "BOT_" + i, name: "🤖 بوت " + i, color: ["#f43f5e", "#a855f7", "#38bdf8", "#eab308", "#f97316"][Math.floor(Math.random() * 5)],
                        headSkin: ['default', 'crown', 'dragon', 'ninja'][Math.floor(Math.random() * 4)], body: [{ x: Math.random() * 1200 + 50, y: Math.random() * 700 + 50 }], dir: randomDir(), score: 0, isBot: true, magnetActive: false, magnetTimeLeft: 0
                    };
                }
            }
            runRoomEngine(roomCode);
        }
        allRooms[roomCode].snakes[socket.id] = { id: socket.id, name: name, color: color, headSkin: headSkin, body: [{ x: Math.random() * 1000 + 100, y: Math.random() * 600 + 100 }, { x: 300, y: 300 }], dir: 'RIGHT', score: 0, isBot: false, magnetActive: false, magnetTimeLeft: 0 };
        socket.currentRoom = roomCode;
    });

    socket.on('moveSnake', (data) => {
        const room = allRooms[data.roomCode];
        if (room && room.snakes[socket.id]) {
            const p = room.snakes[socket.id];
            if (data.dir === 'UP' && p.dir !== 'DOWN') p.dir = 'UP';
            if (data.dir === 'DOWN' && p.dir !== 'UP') p.dir = 'DOWN';
            if (data.dir === 'LEFT' && p.dir !== 'RIGHT') p.dir = 'LEFT';
            if (data.dir === 'RIGHT' && p.dir !== 'LEFT') p.dir = 'RIGHT';
        }
    });

    socket.on('disconnect', () => {
        const rCode = socket.currentRoom;
        if (rCode && allRooms[rCode]) {
            delete allRooms[rCode].snakes[socket.id];
            if (Object.values(allRooms[rCode].snakes).filter(s => !s.isBot).length === 0) { clearInterval(allRooms[rCode].interval); delete allRooms[rCode]; }
        }
        const xoCode = socket.xoRoom;
        if (xoCode && xoRooms[xoCode]) {
            io.to(xoCode).emit('receiveXOMessage', { system: true, msg: `❌ غادر أحد اللاعبين التحدي.` });
            delete xoRooms[xoCode];
        }
    });
});

function checkXOWin(board, sign) {
    const wins = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]];
    return wins.some(w => w.every(i => board[i] === sign));
}

function runRoomEngine(roomCode) {
    const room = allRooms[roomCode]; if (!room) return;
    room.interval = setInterval(() => {
        const keys = Object.keys(room.snakes); const deadPlayers = {};
        room.magnet.spawnTimer++;
        if (room.magnet.spawnTimer >= 100 && room.magnet.taken) { room.magnet.x = Math.random() * 1200 + 50; room.magnet.y = Math.random() * 700 + 50; room.magnet.taken = false; room.magnet.spawnTimer = 0; }
        keys.forEach(id => {
            const p = room.snakes[id]; if (!p) return;
            if (p.isBot && Math.random() < 0.15) p.dir = randomDir();
            let head = { ...p.body[0] };
            if (p.dir === 'UP') head.y -= 11; if (p.dir === 'DOWN') head.y += 11; if (p.dir === 'LEFT') head.x -= 11; if (p.dir === 'RIGHT') head.x += 11;
            if (head.x < 0) head.x = 1380; if (head.x > 1380) head.x = 0; if (head.y < 0) head.y = 800; if (head.y > 800) head.y = 0;
            p.body.unshift(head);
            if (p.magnetActive) { p.magnetTimeLeft--; if (p.magnetTimeLeft <= 0) p.magnetActive = false; }
            if (!room.magnet.taken && Math.hypot(head.x - room.magnet.x, head.y - room.magnet.y) < 35) { room.magnet.taken = true; room.magnet.spawnTimer = 0; p.magnetActive = true; p.magnetTimeLeft = 50; }
            let ateCandy = false;
            room.candies.forEach((candy, index) => {
                let distance = Math.hypot(head.x - candy.x, head.y - candy.y); let grabRange = p.magnetActive ? 190 : 25;
                if (distance < grabRange) {
                    if (p.magnetActive && distance > 22) { candy.x += (head.x - candy.x) * 0.35; candy.y += (head.y - candy.y) * 0.35; }
                    else { p.score += 10; ateCandy = true; room.candies[index] = { x: Math.random() * 1250 + 35, y: Math.random() * 750 + 35, type: candyIcons[Math.floor(Math.random() * candyIcons.length)] }; }
                }
            });
            if (!ateCandy) p.body.pop();
        });
        keys.forEach(id1 => {
            const p1 = room.snakes[id1]; if (!p1) return; const head1 = p1.body[0];
            keys.forEach(id2 => {
                if (id1 === id2) return; const p2 = room.snakes[id2]; if (!p2) return;
                for (let i = 0; i < p2.body.length; i++) { if (Math.hypot(head1.x - p2.body[i].x, head1.y - p2.body[i].y) < 13) { deadPlayers[id1] = id2; break; } }
            });
        });
        for (let deadId in deadPlayers) {
            const killerId = deadPlayers[deadId]; const deadPlayer = room.snakes[deadId]; const killerPlayer = room.snakes[killerId];
            if (deadPlayer && killerPlayer) { killerPlayer.score += deadPlayer.score + 60; for (let k = 0; k < Math.max(3, Math.floor(deadPlayer.body.length / 2)); k++) killerPlayer.body.push({ ...killerPlayer.body[killerPlayer.body.length - 1] }); }
            if (deadPlayer) { deadPlayer.body = [{ x: Math.random() * 1100 + 50, y: Math.random() * 700 + 50 }]; deadPlayer.score = 0; deadPlayer.magnetActive = false; }
        }
        const leaderboard = Object.values(room.snakes).map(p => ({ id: p.id, name: p.name, score: p.score })).sort((a, b) => b.score - a.score);
        io.to(roomCode).emit('renderSnakeFrame', { snakes: Object.values(room.snakes), candies: room.candies, magnet: room.magnet, leaderboard: leaderboard });
    }, 100);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server fully optimization for mobile active on port ${PORT}`));
