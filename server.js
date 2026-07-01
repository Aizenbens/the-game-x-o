const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(__dirname));

let onlineUsers = {}; 
let xoRooms = {};     
let snakeRooms = {};  
let chessRooms = {}; 

const GRID_SIZE = 20;
const MAP_WIDTH = 3000;   
const MAP_HEIGHT = 3000;
const CANDY_TYPES = ['donut', 'cupcake', 'icecream', 'lollipop', 'candy'];

setInterval(() => {
    for (let rCode in snakeRooms) {
        let room = snakeRooms[rCode];
        room.magnets = room.magnets || [];
        if (room.magnets.length < 3) {
            room.magnets.push({
                x: Math.floor(Math.random() * (MAP_WIDTH / GRID_SIZE)) * GRID_SIZE,
                y: Math.floor(Math.random() * (MAP_HEIGHT / GRID_SIZE)) * GRID_SIZE
            });
        }
    }
}, 10000);

setInterval(() => {
    for (let rCode in snakeRooms) {
        let room = snakeRooms[rCode];
        let allActive = { ...room.players, ...room.bots };

        for (let bId in room.bots) {
            let bot = room.bots[bId];
            let target = room.magnets.length > 0 ? room.magnets[0] : room.candies[0];
            if (target) {
                let head = bot.body[0];
                if (target.x > head.x && bot.direction !== "LEFT") bot.direction = "RIGHT";
                else if (target.x < head.x && bot.direction !== "RIGHT") bot.direction = "LEFT";
                else if (target.y > head.y && bot.direction !== "DOWN") bot.direction = "UP";
                else if (target.y < head.y && bot.direction !== "UP") bot.direction = "DOWN";
            }
        }

        for (let id in allActive) {
            let p = allActive[id];
            if (p.magnetTimer > 0) {
                p.magnetTimer -= 0.1;
                let head = p.body[0];
                room.candies.forEach(c => {
                    let dist = Math.hypot(c.x - head.x, c.y - head.y);
                    if (dist < 200) {
                        if (c.x < head.x) c.x += GRID_SIZE;
                        if (c.x > head.x) c.x -= GRID_SIZE;
                        if (c.y < head.y) c.y += GRID_SIZE;
                        if (c.y > head.y) c.y -= GRID_SIZE;
                    }
                });
            }
        }

        for (let id in allActive) {
            let p = allActive[id];
            let head = { ...p.body[0] };

            if (p.direction === "UP") head.y -= GRID_SIZE;
            if (p.direction === "DOWN") head.y += GRID_SIZE;
            if (p.direction === "LEFT") head.x -= GRID_SIZE;
            if (p.direction === "RIGHT") head.x += GRID_SIZE;

            if (head.x < 0 || head.x >= MAP_WIDTH || head.y < 0 || head.y >= MAP_HEIGHT) {
                p.isDead = true;
                continue;
            }

            for (let i = room.magnets.length - 1; i >= 0; i--) {
                let mag = room.magnets[i];
                if (Math.abs(head.x - mag.x) < GRID_SIZE && Math.abs(head.y - mag.y) < GRID_SIZE) {
                    p.magnetTimer = 6;
                    room.magnets.splice(i, 1);
                }
            }

            let ate = false;
            for (let i = room.candies.length - 1; i >= 0; i--) {
                let c = room.candies[i];
                if (Math.abs(head.x - c.x) < GRID_SIZE && Math.abs(head.y - c.y) < GRID_SIZE) {
                    p.score += 10;
                    room.candies.splice(i, 1);
                    ate = true;
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

        let killedScores = {};
        for (let id1 in allActive) {
            let p1 = allActive[id1];
            if (p1.isDead) continue;
            let h1 = p1.body[0];

            for (let id2 in allActive) {
                let p2 = allActive[id2];
                if (p2.isDead) continue;

                if (id1 !== id2) {
                    if (p2.body.some(seg => seg.x === h1.x && seg.y === h1.y)) {
                        p1.isDead = true;
                        killedScores[id2] = (killedScores[id2] || 0) + p1.score;
                    }
                } else {
                    if (p1.body.slice(1).some(seg => seg.x === h1.x && seg.y === h1.y)) {
                        p1.isDead = true;
                    }
                }
            }
        }

        for (let id in allActive) {
            let p = allActive[id];
            if (killedScores[id]) p.score += killedScores[id];

            if (p.isDead) {
                p.score = 0;
                p.magnetTimer = 0;
                p.isDead = false;
                p.body = [{
                    x: Math.floor(Math.random() * 50 + 10) * GRID_SIZE,
                    y: Math.floor(Math.random() * 50 + 10) * GRID_SIZE
                }];
                p.direction = ["UP", "DOWN", "LEFT", "RIGHT"][Math.floor(Math.random() * 4)];
            }
        }

        io.to(rCode).emit('snakeRoomUpdate', { players: room.players, bots: room.bots, candies: room.candies, magnets: room.magnets });
    }
}, 100);

io.on('connection', (socket) => {
    socket.on('joinHub', (data) => {
        onlineUsers[socket.id] = { username: data.username, color: data.color, roomXO: null, roomSnake: null, roomChess: null };
        io.emit('updateOnlineUsers', Object.values(onlineUsers));
    });

    socket.on('sendHubChatMessage', (data) => {
        io.emit('receiveHubChatMessage', data);
    });

    socket.on('sendXOChatMessage', (data) => {
        io.to(data.roomCode).emit('receiveXOChatMessage', data);
    });

    socket.on('sendChessChatMessage', (data) => {
        io.to(data.roomCode).emit('receiveChessChatMessage', data);
    });

    socket.on('leaveXORoom', (data) => {
        const { roomCode, username } = data;
        socket.leave(roomCode);
        if(xoRooms[roomCode]) {
            xoRooms[roomCode].players = xoRooms[roomCode].players.filter(id => id !== socket.id);
        }
        io.to(roomCode).emit('playerLeftAlert', { username, game: "XO" });
    });

    socket.on('leaveSnakeRoom', (data) => {
        const { roomCode, username } = data;
        if (snakeRooms[roomCode] && snakeRooms[roomCode].players[socket.id]) {
            delete snakeRooms[roomCode].players[socket.id];
        }
        socket.leave(roomCode);
        io.to(roomCode).emit('playerLeftAlert', { username, game: "الدودة" });
    });

    socket.on('leaveChessRoom', (data) => {
        const { roomCode, username } = data;
        socket.leave(roomCode);
        if(chessRooms[roomCode]) {
            chessRooms[roomCode].players = chessRooms[roomCode].players.filter(id => id !== socket.id);
        }
        io.to(roomCode).emit('playerLeftAlert', { username, game: "الشطرنج" });
    });

    socket.on('joinSnakeRoom', (data) => {
        const { roomCode, username, color } = data;
        socket.join(roomCode);
        if(onlineUsers[socket.id]) onlineUsers[socket.id].roomSnake = roomCode;

        if (!snakeRooms[roomCode]) {
            snakeRooms[roomCode] = { players: {}, candies: [], bots: {}, magnets: [] };
            for (let i = 0; i < 600; i++) {
                snakeRooms[roomCode].candies.push({
                    x: Math.floor(Math.random() * (MAP_WIDTH / GRID_SIZE)) * GRID_SIZE,
                    y: Math.floor(Math.random() * (MAP_HEIGHT / GRID_SIZE)) * GRID_SIZE,
                    type: CANDY_TYPES[Math.floor(Math.random() * CANDY_TYPES.length)]
                });
            }
        }

        snakeRooms[roomCode].players[socket.id] = {
            body: [{ x: 400, y: 400 }],
            direction: "RIGHT",
            score: 0,
            username: username,
            color: color,
            magnetTimer: 0,
            isDead: false
        };
    });

    socket.on('snakeRoomDirection', (data) => {
        const { roomCode, direction } = data;
        if (snakeRooms[roomCode] && snakeRooms[roomCode].players[socket.id]) {
            let p = snakeRooms[roomCode].players[socket.id];
            if (direction === "UP" && p.direction !== "DOWN") p.direction = "UP";
            if (direction === "DOWN" && p.direction !== "UP") p.direction = "DOWN";
            if (direction === "LEFT" && p.direction !== "RIGHT") p.direction = "LEFT";
            if (direction === "RIGHT" && p.direction !== "LEFT") p.direction = "RIGHT";
        }
    });

    socket.on('joinXOGame', (data) => {
        const { roomCode, username } = data;
        socket.join(roomCode);
        if(onlineUsers[socket.id]) onlineUsers[socket.id].roomXO = roomCode;

        if (!xoRooms[roomCode]) {
            xoRooms[roomCode] = { 
                players: [], 
                board: Array(9).fill(""), 
                turn: "X", 
                scores: {}, 
                usernames: {}, 
                round: 1,
                startingPlayerIdx: 0
            };
        }
        let room = xoRooms[roomCode];
        if (room.players.length < 2 && !room.players.includes(socket.id)) {
            room.players.push(socket.id);
            room.scores[socket.id] = 0;
            room.usernames[socket.id] = username;
        }
        
        const symbol = room.players.indexOf(socket.id) === 0 ? "X" : "O";
        socket.emit('xoInit', { symbol });
        
        if (room.players.length === 2) {
            io.to(roomCode).emit('xoStart', { turn: "X", round: room.round, scores: room.scores });
        } else {
            socket.emit('xoWaiting', "في انتظار الخصم...");
        }
    });

    socket.on('makeXOMove', (data) => {
        const { roomCode, index, symbol } = data;
        let room = xoRooms[roomCode];
        if (room && room.turn === symbol && room.board[index] === "") {
            room.board[index] = symbol;
            
            if (checkServerWin(room.board, symbol)) {
                room.scores[socket.id] += 1;
                room.round += 1;
                room.board.fill("");
                room.turn = "X";
                io.to(roomCode).emit('xoRoundEnd', { winnerSymbol: symbol, scores: room.scores, round: room.round, board: room.board, isDraw: false });
            } else if (!room.board.includes("")) {
                room.round += 1;
                room.board.fill("");
                room.startingPlayerIdx = room.startingPlayerIdx === 0 ? 1 : 0; 
                room.turn = "X"; 
                
                io.to(roomCode).emit('xoRoundEnd', { 
                    winnerSymbol: "تعادل", 
                    scores: room.scores, 
                    round: room.round, 
                    board: room.board,
                    isDraw: true
                });
            } else {
                room.turn = symbol === "X" ? "O" : "X";
                io.to(roomCode).emit('xoUpdate', { board: room.board, turn: room.turn });
            }
        }
    });

    socket.on('joinChessGame', (data) => {
        const { roomCode, username } = data;
        socket.join(roomCode);
        if(onlineUsers[socket.id]) onlineUsers[socket.id].roomChess = roomCode;

        if(!chessRooms[roomCode]) {
            chessRooms[roomCode] = { players: [], usernames: {} };
        }
        let room = chessRooms[roomCode];
        if(room.players.length < 2 && !room.players.includes(socket.id)) {
            room.players.push(socket.id);
            room.usernames[socket.id] = username;
        }

        const color = room.players.indexOf(socket.id) === 0 ? "w" : "b";
        socket.emit('chessInit', { color });

        if(room.players.length === 2) {
            io.to(roomCode).emit('chessStart');
        }
    });

    socket.on('makeChessMove', (data) => {
        const { roomCode, move } = data;
        socket.to(roomCode).emit('chessMoveUpdate', { move });
    });

    socket.on('disconnect', () => {
        let user = onlineUsers[socket.id];
        if (user) {
            if(user.roomXO) io.to(user.roomXO).emit('playerLeftAlert', { username: user.username, game: "XO" });
            if(user.roomSnake) io.to(user.roomSnake).emit('playerLeftAlert', { username: user.username, game: "الدودة" });
            if(user.roomChess) io.to(user.roomChess).emit('playerLeftAlert', { username: user.username, game: "الشطرنج" });
            
            delete onlineUsers[socket.id];
            io.emit('updateOnlineUsers', Object.values(onlineUsers));
        }
        for (let rCode in snakeRooms) {
            if (snakeRooms[rCode].players[socket.id]) delete snakeRooms[rCode].players[socket.id];
        }
    });
});

function checkServerWin(b, s) {
    const w = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return w.some(p => b[p[0]] === s && b[p[1]] === s && b[p[2]] === s);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 السيرفر يعمل بالكامل على منفذ ${PORT}`));
