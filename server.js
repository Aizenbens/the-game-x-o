const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

// السيرفر العالمي الأونلاين الموحد لجميع اللاعبين والبوتات
const globalServer = {
    snakes: {},
    candies: [],
    magnet: { x: 500, y: 400, taken: true, spawnTimer: 0 }
};

const candyIcons = ["🍬", "🍭", "🍫", "🍩"];
const randomDir = () => ['UP', 'DOWN', 'LEFT', 'RIGHT'][Math.floor(Math.random() * 4)];

// ملء السيرفر مبدئياً بالحلويات والـ 20 بوت الثابتين
for (let j = 0; j < 70; j++) {
    globalServer.candies.push({
        x: Math.random() * 1250 + 35, y: Math.random() * 750 + 35,
        type: candyIcons[Math.floor(Math.random() * candyIcons.length)]
    });
}
for (let i = 1; i <= 20; i++) {
    globalServer.snakes["BOT_" + i] = {
        id: "BOT_" + i, name: "🤖 بوت " + i,
        color: ["#f43f5e", "#a855f7", "#38bdf8", "#eab308", "#f97316"][Math.floor(Math.random() * 5)],
        body: [{ x: Math.random() * 1200 + 50, y: Math.random() * 700 + 50 }],
        dir: randomDir(), score: 0, isBot: true, magnetActive: false, magnetTimeLeft: 0
    };
}

io.on('connection', (socket) => {

    // انضمام لاعب حقيقي عبر الأونلاين إلى السيرفر المشترك
    socket.on('joinGlobalSnake', (data) => {
        globalServer.snakes[socket.id] = {
            id: socket.id, name: data.name || "لاعب أونلاين", color: data.color || "#10b981",
            body: [{ x: Math.random() * 1000 + 100, y: Math.random() * 600 + 100 }, { x: 300, y: 300 }],
            dir: 'RIGHT', score: 0, isBot: false, magnetActive: false, magnetTimeLeft: 0
        };
    });

    // معالجة توجيه حركة اللاعب أونلاين
    socket.on('moveSnakeOnline', (data) => {
        const p = globalServer.snakes[socket.id];
        if (p) {
            if (data.dir === 'UP' && p.dir !== 'DOWN') p.dir = 'UP';
            if (data.dir === 'DOWN' && p.dir !== 'UP') p.dir = 'DOWN';
            if (data.dir === 'LEFT' && p.dir !== 'RIGHT') p.dir = 'LEFT';
            if (data.dir === 'RIGHT' && p.dir !== 'LEFT') p.dir = 'RIGHT';
        }
    });

    socket.on('disconnect', () => {
        if (globalServer.snakes[socket.id]) {
            delete globalServer.snakes[socket.id];
        }
    });
});

// محرك السيرفر المباشر لتحديث جميع اللاعبين والبوتات معاً
setInterval(() => {
    const keys = Object.keys(globalServer.snakes);
    const deadPlayers = {};

    // 1. تدوير وإعادة توليد المغناطيس عشوائياً
    globalServer.magnet.spawnTimer++;
    if (globalServer.magnet.spawnTimer >= 100 && globalServer.magnet.taken) {
        globalServer.magnet.x = Math.random() * 1200 + 50;
        globalServer.magnet.y = Math.random() * 700 + 50;
        globalServer.magnet.taken = false;
        globalServer.magnet.spawnTimer = 0;
    }

    // 2. تحديث حركة ومواقع الدود (الحقيقيين والآليين)
    keys.forEach(id => {
        const p = globalServer.snakes[id];
        if (!p) return;

        if (p.isBot && Math.random() < 0.15) p.dir = randomDir();

        let head = { ...p.body[0] };
        if (p.dir === 'UP') head.y -= 11;
        if (p.dir === 'DOWN') head.y += 11;
        if (p.dir === 'LEFT') head.x -= 11;
        if (p.dir === 'RIGHT') head.x += 11;

        // الالتفاف حول حدود الشاشة التلقائي المطور
        if (head.x < 0) head.x = 1380; if (head.x > 1380) head.x = 0;
        if (head.y < 0) head.y = 800; if (head.y > 800) head.y = 0;

        p.body.unshift(head);

        if (p.magnetActive) {
            p.magnetTimeLeft--;
            if (p.magnetTimeLeft <= 0) p.magnetActive = false;
        }

        // التقاط المغناطيس المجسم
        if (!globalServer.magnet.taken && Math.hypot(head.x - globalServer.magnet.x, head.y - globalServer.magnet.y) < 35) {
            globalServer.magnet.taken = true;
            globalServer.magnet.spawnTimer = 0;
            p.magnetActive = true;
            p.magnetTimeLeft = 50; // 5 ثوانٍ
        }

        // التجميع وجاذبية الحلويات ثلاثية الأبعاد عن بعد
        let ateCandy = false;
        globalServer.candies.forEach((candy, index) => {
            let distance = Math.hypot(head.x - candy.x, head.y - candy.y);
            let grabRange = p.magnetActive ? 190 : 25;

            if (distance < grabRange) {
                if (p.magnetActive && distance > 22) {
                    candy.x += (head.x - candy.x) * 0.35;
                    candy.y += (head.y - candy.y) * 0.35;
                } else {
                    p.score += 10;
                    ateCandy = true;
                    globalServer.candies[index] = {
                        x: Math.random() * 1250 + 35, y: Math.random() * 750 + 35,
                        type: candyIcons[Math.floor(Math.random() * candyIcons.length)]
                    };
                }
            }
        });

        if (!ateCandy) p.body.pop();
    });

    // 3. فحص قواعد الموت ونقل النقاط وحجم الطول بين المتنافسين أونلاين
    keys.forEach(id1 => {
        const p1 = globalServer.snakes[id1];
        if (!p1) return;
        const head1 = p1.body[0];

        keys.forEach(id2 => {
            if (id1 === id2) return;
            const p2 = globalServer.snakes[id2];
            if (!p2) return;

            // اصطدام الرأس بجسم دودة أخرى -> الموت التلقائي ونقل الحجم
            for (let i = 0; i < p2.body.length; i++) {
                if (Math.hypot(head1.x - p2.body[i].x, head1.y - p2.body[i].y) < 13) {
                    deadPlayers[id1] = id2;
                    break;
                }
            }
        });
    });

    // تصفية الحسابات وإعادة الرسبون
    for (let deadId in deadPlayers) {
        const killerId = deadPlayers[deadId];
        const deadPlayer = globalServer.snakes[deadId];
        const killerPlayer = globalServer.snakes[killerId];

        if (deadPlayer && killerPlayer) {
            killerPlayer.score += deadPlayer.score + 60;
            for (let k = 0; k < Math.max(3, Math.floor(deadPlayer.body.length / 2)); k++) {
                killerPlayer.body.push({ ...killerPlayer.body[killerPlayer.body.length - 1] });
            }
        }
        if (deadPlayer) {
            deadPlayer.body = [{ x: Math.random() * 1100 + 10, y: Math.random() * 700 + 10 }];
            deadPlayer.score = 0;
            deadPlayer.magnetActive = false;
        }
    }

    // تجميع وترتيب ليدربورد السيرفر الموحد
    const leaderboard = Object.values(globalServer.snakes)
        .map(p => ({ id: p.id, name: p.name, score: p.score }))
        .sort((a, b) => b.score - a.score);

    io.emit('renderOnlineSnakeFrame', {
        snakes: Object.values(globalServer.snakes),
        candies: globalServer.candies,
        magnet: globalServer.magnet,
        leaderboard: leaderboard
    });

}, 100);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`3D Online Multiplayer Engine active on port ${PORT}`));
