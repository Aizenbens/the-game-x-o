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
app.use(express.static(__dirname));

const rooms = {};
const MAP_SIZE = 2500;
const GRID_SIZE = 14;

function generateCandies() {
    const types = [{ val: 10, size: 4, col: "#ec4899" }, { val: 25, size: 6, col: "#06b6d4" }, { val: 50, size: 8, col: "#eab308" }];
    let arr = [];
    for(let i=0; i<400; i++) {
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
    socket.on('joinRoom', ({ roomCode, username, color, isSnakeMode }) => {
        if (!roomCode || !username) return;
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.username = username;
        
        if (!rooms[roomCode]) {
            rooms[roomCode] = {
                code: roomCode,
                players: {},
                candies: generateCandies()
            };
        }

        rooms[roomCode].players[socket.id] = {
            id: socket.id,
            username: username,
            color: color || '#a855f7',
            body: [], 
            score: 250,
            direction: 'RIGHT'
        };

        const currentPlayers = Object.values(rooms[roomCode].players);
        io.to(roomCode).emit('roomUpdate', { 
            players: currentPlayers,
            candies: rooms[roomCode].candies
        });

        io.to(roomCode).emit('chatMessageReceived', {
            system: true,
            text: `📢 دخل العميل [${username}] إلى الساحة التكتيكية.`
        });
    });

    socket.on('sendChatMessage', (msgText) => {
        const roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode] && socket.username) {
            io.to(roomCode).emit('chatMessageReceived', {
                system: false,
                username: socket.username,
                text: msgText
            });
        }
    });

    socket.on('snakeUpdate', (snakeData) => {
        const roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode] && rooms[roomCode].players[socket.id]) {
            rooms[roomCode].players[socket.id].body = snakeData.body;
            rooms[roomCode].players[socket.id].score = snakeData.score;
            rooms[roomCode].players[socket.id].direction = snakeData.direction;
            socket.to(roomCode).emit('snakePositions', Object.values(rooms[roomCode].players));
        }
    });

    socket.on('candyEaten', (candyId) => {
        const roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode]) {
            rooms[roomCode].candies = rooms[roomCode].candies.filter(c => c.id !== candyId);
            io.to(roomCode).emit('candyRemoved', candyId);
            
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
    });

    socket.on('xoMove', (data) => {
        if (socket.roomCode) socket.to(socket.roomCode).emit('xoMoveReceived', data);
    });

    socket.on('chessMove', (data) => {
        if (socket.roomCode) socket.to(socket.roomCode).emit('chessMoveReceived', data);
    });

    socket.on('disconnect', () => {
        const roomCode = socket.roomCode;
        if (roomCode && rooms[roomCode]) {
            const leftUsername = socket.username || "لاعب";
            delete rooms[roomCode].players[socket.id];
            
            if (Object.keys(rooms[roomCode].players).length === 0) {
                delete rooms[roomCode];
            } else {
                io.to(roomCode).emit('roomUpdate', { 
                    players: Object.values(rooms[roomCode].players),
                    candies: rooms[roomCode].candies
                });
                io.to(roomCode).emit('chatMessageReceived', {
                    system: true,
                    text: `❌ غادر العميل [${leftUsername}] الساحة.`
                });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 السيرفر المطور يعمل بكفاءة على البورت ${PORT}`));
