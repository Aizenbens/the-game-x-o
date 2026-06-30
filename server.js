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

const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function checkWinner(board) {
    for (let condition of winningConditions) {
        const [a, b, c] = condition;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    if (!board.includes(null)) return 'draw';
    return null;
}

io.on('connection', (socket) => {

    socket.on('createPrivateRoom', (data) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            players: [{ id: socket.id, sign: 'X', name: data.name }],
            board: Array(9).fill(null),
            round: 1,
            currentTurn: 'X',
            drawStreak: 0,
            startingPlayerOfRound: 'X'
        };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode);
        socket.emit('playerAssignment', { sign: 'X' });
    });

    socket.on('joinPrivateRoom', (data) => {
        const { roomCode, name } = data;
        const room = rooms[roomCode];
        if (!room) {
            socket.emit('errorEvent', 'رمز الجولة غير صحيح!');
            return;
        }
        if (room.players.length >= 2) {
            socket.emit('errorEvent', 'الجولة ممتلئة!');
            return;
        }

        room.players.push({ id: socket.id, sign: 'O', name: name });
        socket.join(roomCode);
        
        socket.emit('roomCreated', roomCode);
        socket.emit('playerAssignment', { sign: 'O' });

        io.to(roomCode).emit('systemMessage', `انضم اللاعب ${name} إلى الجولة!`);
        startNewRound(roomCode);
    });

    socket.on('makeMove', (data) => {
        const { roomCode, index } = data;
        const room = rooms[roomCode];
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player && player.sign === room.currentTurn && room.board[index] === null) {
            room.board[index] = room.currentTurn;
            
            const result = checkWinner(room.board);
            
            if (result) {
                if (result === 'draw') {
                    room.drawStreak++;
                    room.startingPlayerOfRound = (room.drawStreak % 2 !== 0) ? 'O' : 'X';
                    io.to(roomCode).emit('systemMessage', `تعادل! الجولة التالية تبدأ بواسطة: ${room.startingPlayerOfRound}`);
                    room.round++;
                    startNewRound(roomCode);
                } else {
                    room.startingPlayerOfRound = result;
                    room.drawStreak = 0;
                    const winnerName = room.players.find(p => p.sign === result)?.name || result;
                    io.to(roomCode).emit('systemMessage', `الفائز في الجولة هو: ${winnerName}`);
                    room.round++;
                    startNewRound(roomCode);
                }
            } else {
                room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
                io.to(roomCode).emit('updateBoard', { index: index, sign: player.sign, nextTurn: room.currentTurn });
            }
        }
    });

    socket.on('sendMessage', (data) => {
        const { roomCode, text, name } = data;
        io.to(roomCode).emit('receiveMessage', { sender: socket.id, text: text, name: name });
    });

    socket.on('disconnect', () => {
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                io.to(roomCode).emit('systemMessage', 'غادر أحد اللاعبين الجولة.');
                delete rooms[roomCode];
                break;
            }
        }
    });
});

function startNewRound(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    room.board = Array(9).fill(null);
    room.currentTurn = room.startingPlayerOfRound;
    io.to(roomCode).emit('startRound', { round: room.round, currentTurn: room.currentTurn });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`السيرفر يعمل على منفذ ${PORT}`);
});
