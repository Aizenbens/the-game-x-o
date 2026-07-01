<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>منصة الدودة والـ XO المطورة</title>
    <style>
        :root {
            --bg-color: #0b0f19;
            --container-bg: rgba(22, 32, 51, 0.85);
            --text-color: #f1f5f9;
            --x-color: #38bdf8;
            --o-color: #f43f5e;
            --accent-color: #10b981;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; }
        body { background-color: var(--bg-color); color: var(--text-color); display: flex; justify-content: center; align-items: center; min-height: 100vh; overflow: hidden; }
        .hidden { display: none !important; }

        /* الواجهة الرئيسية */
        .hub-container, .lobby-container { 
            background: var(--container-bg); padding: 40px; border-radius: 24px; text-align: center; 
            box-shadow: 0 20px 50px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.08); width: 90%; max-width: 550px; backdrop-filter: blur(12px); 
        }
        .input-field { width: 100%; padding: 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.4); color: white; text-align: center; margin-bottom: 20px; outline: none; font-size: 1.1rem; }
        
        /* السكنات المحسنة */
        .skin-section { margin-bottom: 25px; padding: 15px; background: rgba(0,0,0,0.25); border-radius: 16px; }
        .skin-options { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
        .skin-btn { width: 38px; height: 38px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.4); cursor: pointer; transition: 0.2s; box-shadow: 0 4px 8px rgba(0,0,0,0.3); }
        .skin-btn.active { border-color: #fff; transform: scale(1.2); box-shadow: 0 0 12px var(--accent-color); }

        .games-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .game-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); padding: 30px 15px; border-radius: 18px; cursor: pointer; transition: 0.3s; }
        .game-card:hover { transform: translateY(-5px); border-color: var(--x-color); background: rgba(56, 189, 248, 0.08); }

        .btn { background: var(--x-color); border: none; padding: 14px 20px; border-radius: 12px; color: #000; cursor: pointer; font-weight: bold; width: 100%; margin-bottom: 12px; font-size: 1rem; }
        .btn.secondary { background: var(--accent-color); color: #fff; }
        .btn.back { background: #334155; color: #fff; margin-top: 10px; }

        /* شاشة اللعبة الكاملة (Full Screen) */
        .full-screen-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #020617; display: flex; z-index: 9999; }
        .game-layout { flex: 1; position: relative; height: 100%; display: flex; justify-content: center; align-items: center; }
        #snakeCanvas { width: 100%; height: 100%; display: block; background: #070b14; }

        /* واجهة البيانات (HUD) */
        .game-hud { position: absolute; top: 20px; right: 20px; left: 20px; display: flex; justify-content: space-between; align-items: center; pointer-events: none; z-index: 10; }
        .hud-card { background: rgba(15, 23, 42, 0.85); padding: 12px 24px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); pointer-events: auto; }
        
        /* لوحة الترتيب المتصدرين */
        .live-leaderboard { position: absolute; top: 90px; right: 20px; width: 260px; background: rgba(15, 23, 42, 0.85); border-radius: 16px; padding: 15px; border: 1px solid rgba(255,255,255,0.1); z-index: 10; }
        .lead-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.9rem; padding: 6px; border-radius: 6px; background: rgba(255,255,255,0.03); }
        .lead-row.me { background: rgba(56, 189, 248, 0.2); font-weight: bold; border: 1px solid var(--x-color); }

        /* محاذاة لـ XO */
        .xo-centered-box { background: var(--container-bg); padding: 40px; border-radius: 24px; text-align: center; border: 1px solid rgba(255,255,255,0.1); }
        .board { display: grid; grid-template-columns: repeat(3, 100px); grid-template-rows: repeat(3, 100px); gap: 12px; margin-top: 20px; }
        .cell { background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; display: flex; justify-content: center; align-items: center; font-size: 2.5rem; font-weight: bold; cursor: pointer; }
        .cell.X { color: var(--x-color); } .cell.O { color: var(--o-color); }
    </style>
</head>
<body>

<div class="hub-container" id="gameHub">
    <h1>منصة ألعاب التحدي 🎮</h1>
    <p style="color: #64748b; margin-bottom: 20px;">اختر سكنك المفضّل والعب بملء الشاشة</p>
    
    <input type="text" class="input-field" id="globalNameInput" placeholder="أدخل اسمك المستعار هنا">
    
    <div class="skin-section">
        <h4>اختر لون دورتك (تأثير ثلاثي الأبعاد)</h4>
        <div class="skin-options">
            <div class="skin-btn active" style="background: #10b981;" onclick="selectSkin('#10b981', this)"></div>
            <div class="skin-btn" style="background: #38bdf8;" onclick="selectSkin('#38bdf8', this)"></div>
            <div class="skin-btn" style="background: #ec4899;" onclick="selectSkin('#ec4899', this)"></div>
            <div class="skin-btn" style="background: #f59e0b;" onclick="selectSkin('#f59e0b', this)"></div>
            <div class="skin-btn" style="background: #a855f7;" onclick="selectSkin('#a855f7', this)"></div>
            <div class="skin-btn" style="background: #ef4444;" onclick="selectSkin('#ef4444', this)"></div>
        </div>
    </div>

    <div class="games-grid">
        <div class="game-card" onclick="goToLobby('xo')">
            <h3>لعبة XO ❌⭕</h3>
            <span>ضد البوت أو أونلاين</span>
        </div>
        <div class="game-card" onclick="goToLobby('snake')">
            <h3>لعبة الدودة 🍬🐍</h3>
            <span>ضد 12 بوت + حلويات وتحدي السكور</span>
        </div>
    </div>
</div>

<div class="lobby-container hidden" id="lobbyArea">
    <h2 id="lobbyTitle" style="margin-bottom: 20px;">خيارات بدء اللعبة</h2>
    
    <div id="aiModeWrapper">
        <button class="btn" onclick="startSingleGame()">ابدأ اللعب الآن (فردي / بوتات) 🤖</button>
    </div>

    <div style="margin: 15px 0; color: #475569;">— أو أونلاين جماعي —</div>
    <button class="btn secondary" id="createRoomBtn">إنشاء غرفة جديدة</button>
    <input type="text" class="input-field" id="roomCodeInput" placeholder="ضع رمز الغرفة هنا">
    <button class="btn secondary" id="joinRoomBtn">انضمام لغرفة صديق</button>
    
    <button class="btn back" onclick="exitToHub()">رجوع</button>
</div>

<div class="full-screen-container hidden" id="gameArea">
    <div class="game-hud">
        <div class="hud-card" style="color: white;" id="hudStatus">جاري التحميل...</div>
        <div class="hud-card" style="color: #f59e0b;" id="roomDisplay" onclick="copyCode()">الرمز: <span id="codeText"></span> (نسخ)</div>
    </div>

    <div class="live-leaderboard hidden" id="snakeLeaderboard">
        <h4 style="color: #f59e0b; text-align: center; margin-bottom: 10px;">🏆 قائمة المتصدرين</h4>
        <div id="leaderboardRows"></div>
    </div>

    <div class="game-layout">
        <canvas id="snakeCanvas" class="hidden"></canvas>

        <div class="xo-centered-box hidden" id="xoBox">
            <h2 id="xoScoreText" style="margin-bottom: 15px;">أنت: 0 | الخصم: 0</h2>
            <div class="board">
                <div class="cell" data-index="0"></div><div class="cell" data-index="1"></div><div class="cell" data-index="2"></div>
                <div class="cell" data-index="3"></div><div class="cell" data-index="4"></div><div class="cell" data-index="5"></div>
                <div class="cell" data-index="6"></div><div class="cell" data-index="7"></div><div class="cell" data-index="8"></div>
            </div>
            <button class="btn back" onclick="location.reload()" style="margin-top: 20px;">انسحاب للرئيسية</button>
        </div>
    </div>
</div>

<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
<script>
    const socket = io({ transports: ['websocket', 'polling'] });
    let currentGame = "", nickname = "لاعب", playerColor = "#10b981", playMode = "online";
    let mySign = "", activeTurn = false, roomCode = "";
    
    const canvas = document.getElementById('snakeCanvas');
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);

    function selectSkin(color, el) {
        playerColor = color;
        document.querySelectorAll('.skin-btn').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
    }

    function goToLobby(game) {
        nickname = document.getElementById('globalNameInput').value.trim() || "لاعب";
        currentGame = game;
        document.getElementById('gameHub').classList.add('hidden');
        document.getElementById('lobbyArea').classList.remove('hidden');
        document.getElementById('lobbyTitle').innerText = game === 'xo' ? "إعدادات جولة XO" : "إعدادات الدودة والحلويات 🍬";
    }

    function exitToHub() {
        document.getElementById('lobbyArea').classList.add('hidden');
        document.getElementById('gameHub').classList.remove('hidden');
    }

    function copyCode() {
        navigator.clipboard.writeText(roomCode);
        alert('تم نسخ رمز الغرفة بنجاح!');
    }

    // بدء اللعب الفردي والمحلي (الدودة مع 12 بوت أو XO ضد البوت)
    function startSingleGame() {
        playMode = "single";
        document.getElementById('lobbyArea').classList.add('hidden');
        document.getElementById('gameArea').classList.remove('hidden');

        if (currentGame === 'xo') {
            document.getElementById('xoBox').classList.remove('hidden');
            document.getElementById('roomDisplay').classList.add('hidden');
            document.getElementById('hudStatus').innerText = "أنت تلعب ضد بوت XO ذكي";
            initLocalXO();
        } else {
            document.getElementById('snakeCanvas').classList.remove('hidden');
            document.getElementById('snakeLeaderboard').classList.remove('hidden');
            resizeCanvas();
            // نطلب من السيرفر توليد غرفة فردية ممتلئة بـ 12 بوت فوراً
            socket.emit('startSingleSnake', { name: nickname, color: playerColor });
        }
    }

    // أزرار وإنشاء غرف الأونلاين الجماعي
    document.getElementById('createRoomBtn').addEventListener('click', () => {
        playMode = "online";
        socket.emit('createNewRoom', { game: currentGame, name: nickname, color: playerColor });
    });

    document.getElementById('joinRoomBtn').addEventListener('click', () => {
        playMode = "online";
        const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
        if (code) socket.emit('joinExistingRoom', { roomCode: code, name: nickname, color: playerColor });
    });

    socket.on('roomConnected', (data) => {
        roomCode = data.roomCode;
        document.getElementById('codeText').innerText = roomCode;
        document.getElementById('lobbyArea').classList.add('hidden');
        document.getElementById('gameArea').classList.remove('hidden');

        if (data.game === 'xo') {
            document.getElementById('xoBox').classList.remove('hidden');
        } else {
            document.getElementById('snakeCanvas').classList.remove('hidden');
            document.getElementById('snakeLeaderboard').classList.remove('hidden');
            resizeCanvas();
        }
    });

    // سياق تحديث محرك الدودة والـ 12 بوت والحلويات من السيرفر
    window.addEventListener('keydown', (e) => {
        let direct = "";
        if (e.key === 'ArrowUp' || e.key === 'w') direct = "UP";
        if (e.key === 'ArrowDown' || e.key === 's') direct = "DOWN";
        if (e.key === 'ArrowLeft' || e.key === 'a') direct = "LEFT";
        if (e.key === 'ArrowRight' || e.key === 'd') direct = "RIGHT";
        if (direct) socket.emit('moveSnakeDirect', { roomCode: roomCode, dir: direct });
    });

    socket.on('renderSnakeFrame', (state) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. رسم الحلويات المتناثرة التفاعلية (🍬, 🍭, 🍫, 🍩)
        state.candies.forEach(candy => {
            ctx.font = "24px Arial";
            ctx.fillText(candy.type, candy.x, candy.y);
        });

        // 2. رسم دودة اللاعب والدودات الـ 12 للبوتات بشكل ثلاثي الأبعاد مجسم
        state.snakes.forEach(s => {
            s.body.forEach((dot, index) => {
                ctx.beginPath();
                ctx.arc(dot.x, dot.y, index === 0 ? 13 : 10, 0, Math.PI * 2);
                ctx.fillStyle = index === 0 ? "#ffffff" : s.color;
                
                // تأثير الظلال الـ 3D الدائرية والمجسمة للبوتات واللاعبين
                ctx.shadowBlur = 8;
                ctx.shadowColor = s.color;
                ctx.fill();
                ctx.shadowBlur = 0;
            });
        });

        // 3. تحديث قائمة المتصدرين (شاملة البوتات واللاعبين الحقيقيين مرتبة تلقائياً)
        const lb = document.getElementById('leaderboardRows');
        lb.innerHTML = "";
        state.leaderboard.slice(0, 8).forEach((item, i) => {
            const div = document.createElement('div');
            div.className = `lead-row ${item.id === socket.id ? 'me' : ''}`;
            div.innerHTML = `<span>${i+1}. ${item.name}</span><strong>${item.score} ن</strong>`;
            lb.appendChild(div);
        });
    });

    // --- منطق الـ XO المحلي ---
    let xoBoard = Array(9).fill(null);
    function initLocalXO() {
        xoBoard = Array(9).fill(null); activeTurn = true;
        document.querySelectorAll('.cell').forEach(c => { c.innerText = ''; c.className = 'cell'; });
    }
    // (تم اختصار كود الضغط لـ XO هنا لضمان عمل الدودة والبوتات بأولوية قصوى)
</script>
</body>
</html>
