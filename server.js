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

// متغيرات حالة اللعبة
let players = []; 
let board = Array(9).fill(null);
let round = 1;
let currentTurn = 'X'; // الجولة الأولى تبدأ بـ X افتراضياً
let drawStreak = 0;    // لحساب عدد التعادلات المتتالية واغتصاب الأدوار على أساسها
let startingPlayerOfRound = 'X'; 

const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // أفقي
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // عمودي
    [0, 4, 8], [2, 4, 6]             // قطري
];

function checkWinner() {
    for (let condition of winningConditions) {
        const [a, b, c] = condition;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // يعيد X أو O
        }
    }
    if (!board.includes(null)) return 'draw'; // تعادل
    return null;
}

io.on('connection', (socket) => {
    // إدارة دخول اللاعبين (الحد الأقصى 2)
    if (players.length < 2) {
        const sign = players.length === 0 ? 'X' : 'O';
        players.push({ id: socket.id, sign: sign });
        socket.emit('playerAssignment', { sign: sign });
        
        if (players.length === 2) {
            io.emit('systemMessage', 'اكتمل اللاعبون! بدأت اللعبة.');
            startNewRound();
        }
    } else {
        socket.emit('systemMessage', 'عذراً، الغرفة ممتلئة حالياً.');
        socket.disconnect();
        return;
    }

    // استقبال حركات اللاعبين وتطبيق القوانين المطلوبة
    socket.on('makeMove', (data) => {
        const player = players.find(p => p.id === socket.id);
        if (player && player.sign === currentTurn && board[data.index] === null) {
            board[data.index] = currentTurn;
            
            const result = checkWinner();
            
            if (result) {
                if (result === 'draw') {
                    // قانون التعادل:
                    drawStreak++;
                    if (drawStreak % 2 !== 0) {
                        startingPlayerOfRound = 'O'; // التعادل الأول: O يبدأ
                    } else {
                        startingPlayerOfRound = 'X'; // التعادل الثاني: تنقلب الكفة لـ X
                    }
                    io.emit('systemMessage', `تعادل! جولة جديدة تبدأ بواسطة: ${startingPlayerOfRound}`);
                    round++;
                    startNewRound();
                } else {
                    // قانون الفائز: الفائز هو من يفتتح الجولة القادمة
                    startingPlayerOfRound = result;
                    drawStreak = 0; // إعادة تصغير ستريك التعادل
                    io.emit('systemMessage', `الفائز في هذه الجولة هو اللاعب: ${result}!`);
                    round++;
                    startNewRound();
                }
            } else {
                // تبديل الدور العادي داخل الجولة
                currentTurn = currentTurn === 'X' ? 'O' : 'X';
                io.emit('updateBoard', { index: data.index, sign: player.sign, nextTurn: currentTurn });
            }
        }
    });

    // نظام الشات
    socket.on('sendMessage', (text) => {
        io.emit('receiveMessage', { sender: socket.id, text: text });
    });

    // عند خروج لاعب
    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('systemMessage', 'غادر أحد اللاعبين. تم إعادة تصغير اللعبة.');
        // إعادة تهيئة المتغيرات
        board = Array(9).fill(null);
        round = 1;
        drawStreak = 0;
        startingPlayerOfRound = 'X';
    });
});

function startNewRound() {
    board = Array(9).fill(null);
    currentTurn = startingPlayerOfRound;
    io.emit('startRound', { round: round, currentTurn: currentTurn });
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`السيرفر يعمل بنجاح على الرابط http://localhost:${PORT}`);
});