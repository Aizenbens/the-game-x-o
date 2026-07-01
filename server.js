const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// إعداد السوكيت مع السماح بجميع الاتصالات لمنع أخطاء CORS
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname));

let onlineUsers = {};
let rooms = {}; // لتخزين غرف الـ XO

io.on('connection', (socket) => {
    console.log(`📡 لاعب اتصل الآن: ${socket.id}`);

    // عند دخول اللاعب باسم مستخدم
    socket.on('joinHub', (username) => {
        onlineUsers[socket.id] = username;
        io.emit('updateOnlineUsers', Object.values(onlineUsers));
    });

    // الشات الجماعي الأونلاين
    socket.on('sendGlobalMessage', (data) => {
        io.emit('receiveGlobalMessage', { name: data.name, msg: data.msg });
    });

    // نظام غرف XO أونلاين
    socket.on('joinXORoom', (data) => {
        const { roomCode, username } = data;
        socket.join(roomCode);

        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [], board: Array(9).fill(""), turn: "X" };
        }

        if (rooms[roomCode].players.length < 2 && !rooms[roomCode].players.includes(socket.id)) {
            rooms[roomCode].players.push(socket.id);
        }

        const playerIndex = rooms[roomCode].players.indexOf(socket.id);
        const symbol = playerIndex === 0 ? "X" : "O";

        socket.emit('xoInit', { symbol: symbol });

        if (rooms[roomCode].players.length === 2) {
            io.to(roomCode).emit('xoStart', { turn: "X" });
        } else {
            socket.emit('xoWaiting', "في انتظار دخول لاعب آخر...");
        }
    });

    // حركات اللعب في XO أونلاين
    socket.on('makeXOMove', (data) => {
        const { roomCode, index, symbol } = data;
        if (rooms[roomCode] && rooms[roomCode].turn === symbol) {
            rooms[roomCode].board[index] = symbol;
            rooms[roomCode].turn = symbol === "X" ? "O" : "X";

            io.to(roomCode).emit('xoUpdate', {
                board: rooms[roomCode].board,
                turn: rooms[roomCode].turn,
                lastMove: { index, symbol }
            });
        }
    });

    // عند الخروج أو قطع الاتصال
    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('updateOnlineUsers', Object.values(onlineUsers));
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 السيرفر الأونلاين يعمل على بورت: ${PORT}`);
});
