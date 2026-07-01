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

let onlineUsers = {}; // id: {username, color, score}
let xoRooms = {};     // roomCode: {players, board, turn}
let snakePlayers = {}; // id: {x, y, body, direction, score, username, color}
let apple = { x: 300, y: 300 };
const GRID_SIZE = 20;

// تحديث حركة الدودة أونلاين كل 100 ملي ثانية
setInterval(() => {
    for (let id in snakePlayers) {
        let p = snakePlayers[id];
        let head = { ...p.body[0] };

        if (p.direction === "UP") head.y -= GRID_SIZE;
        if (p.direction === "DOWN") head.y += GRID_SIZE;
        if (p.direction === "LEFT") head.y -= GRID_SIZE;
        if (p.direction === "RIGHT") head.y += GRID_SIZE;

        // التحقق من أكل التفاحة
        if (Math.abs(head.x - apple.x) < GRID_SIZE && Math.abs(head.y - apple.y) < GRID_SIZE) {
            p.score += 10;
            if (onlineUsers[id]) onlineUsers[id].score = p.score;
            apple = {
                x: Math.floor(Math.random() * 40) * GRID_SIZE,
                y: Math.floor(Math.random() * 40) * GRID_SIZE
            };
            io.emit('updateApple', apple);
            io.emit('updateLeaderboard', getLeaderboard());
        } else {
            p.body.pop();
        }

        p.body.unshift(head);
        p.x = head.x;
        p.y = head.y;
    }
    io.emit('snakeUpdatePlayers', snakePlayers);
}, 100);

function getLeaderboard() {
    return Object.values(onlineUsers).sort((a, b) => b.score - a.score);
}

io.on('connection', (socket) => {
    
    socket.on('joinHub', (data) => {
        onlineUsers[socket.id] = { username: data.username, color: data.color, score: 0 };
        io.emit('updateOnlineUsers', Object.values(onlineUsers));
        io.emit('updateLeaderboard', getLeaderboard());
    });

    // شات XO والصالة العامة
    socket.on('sendChatMessage', (data) => {
        if (data.roomCode) {
            io.to(data.roomCode).emit('receiveChatMessage', data);
        } else {
            io.emit('receiveChatMessage', data);
        }
    });

    // دخول الدودة أونلاين شاشة كاملة
    socket.on('startSnakeOnline', () => {
        const user = onlineUsers[socket.id] || { username: "لاعب", color: "#22c55e" };
        snakePlayers[socket.id] = {
            body: [{ x: 200, y: 200 }],
            direction: "RIGHT",
            score: 0,
            username: user.username,
            color: user.color
        };
        socket.emit('updateApple', apple);
    });

    socket.on('snakeChangeDirection', (dir) => {
        if (snakePlayers[socket.id]) {
            snakePlayers[socket.id].direction = dir;
        }
    });

    // غرف XO أونلاين
    socket.on('joinXOGame', (data) => {
        const { roomCode, username } = data;
        socket.join(roomCode);

        if (!xoRooms[roomCode]) {
            xoRooms[roomCode] = { players: [], board: Array(9).fill(""), turn: "X" };
        }

        if (xoRooms[roomCode].players.length < 2 && !xoRooms[roomCode].players.includes(socket.id)) {
            xoRooms[roomCode].players.push(socket.id);
        }

        const symbol = xoRooms[roomCode].players.indexOf(socket.id) === 0 ? "X" : "O";
        socket.emit('xoInit', { symbol });

        if (xoRooms[roomCode].players.length === 2) {
            io.to(roomCode).emit('xoStart', { turn: "X" });
        } else {
            socket.emit('xoWaiting', "في انتظار منافس...");
        }
    });

    socket.on('makeXOMove', (data) => {
        const { roomCode, index, symbol } = data;
        let room = xoRooms[roomCode];
        if (room && room.turn === symbol && room.board[index] === "") {
            room.board[index] = symbol;
            room.turn = symbol === "X" ? "O" : "X";
            io.to(roomCode).emit('xoUpdate', { board: room.board, turn: room.turn });
        }
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        delete snakePlayers[socket.id];
        io.emit('updateOnlineUsers', Object.values(onlineUsers));
        io.emit('updateLeaderboard', getLeaderboard());
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Ultimate Server running on port ${PORT}`));
