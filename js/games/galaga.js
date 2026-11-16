(function () {
  const canvas = document.getElementById('galaga-canvas');
  const ctx = canvas.getContext('2d');

  let ship = { x: 205, y: 335, w: 30, h: 28, power: 1 };
  let bullets = [];
  let enemyBullets = [];
  let enemies = [];
  let powerUps = [];
  let stars = Array.from({ length: 35 }, () => ({
    x: Math.random() * 440,
    y: Math.random() * 380,
    s: 1 + Math.random() * 2
  }));

  let keys = {};
  let score = 0, wave = 1, shootCooldown = 0, enemyDir = 1;
  let isOver = true, animId = null;
  let callbacks = {};

  function spawnWave() {
    enemies = [];
    const rows = Math.min(4, 2 + Math.floor(wave / 2));
    const cols = 7;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        enemies.push({
          x: 45 + c * 52,
          y: 36 + r * 36,
          w: 28,
          h: 22,
          hp: r === 0 ? 2 : 1,
          color: r === 0 ? '#facc15' : r === 1 ? '#f87171' : '#c084fc',
          alive: true
        });
      }
    }
  }

  function fireBullet() {
    if (ship.power === 1) {
      bullets.push({ x: ship.x + ship.w / 2 - 2, y: ship.y - 6, dx: 0, dy: -7.5 });
    } else {
      // パワーアップ時は3方向ワイドショット（彩京風）
      bullets.push({ x: ship.x + ship.w / 2 - 2, y: ship.y - 6, dx: 0, dy: -7.5 });
      bullets.push({ x: ship.x + 4, y: ship.y, dx: -1.4, dy: -7.2 });
      bullets.push({ x: ship.x + ship.w - 8, y: ship.y, dx: 1.4, dy: -7.2 });
    }
  }

  function draw() {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 星空スクロール背景
    ctx.fillStyle = '#64748b';
    stars.forEach(st => ctx.fillRect(st.x, st.y, st.s, st.s));

    // WAVE表示
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`WAVE ${wave}  |  POWER LV.${ship.power}`, 12, 20);

    // 自機（戦闘機）描画
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(ship.x + ship.w / 2, ship.y);
    ctx.lineTo(ship.x + ship.w, ship.y + ship.h);
    ctx.lineTo(ship.x + ship.w / 2, ship.y + ship.h - 6);
    ctx.lineTo(ship.x, ship.y + ship.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(ship.x + ship.w / 2 - 2, ship.y + 10, 4, 10);

    // 自機弾
    ctx.fillStyle = '#4ade80';
    bullets.forEach(b => ctx.fillRect(b.x, b.y, 4, 10));

    // 敵弾
    ctx.fillStyle = '#fb7185';
    enemyBullets.forEach(eb => {
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // パワーアップアイテム（P）
    powerUps.forEach(p => {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', p.x, p.y);
    });

    // 敵機編隊描画
    enemies.forEach(e => {
      if (!e.alive) return;
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x + 4, e.y, e.w - 8, e.h - 6);
      ctx.fillRect(e.x, e.y + 6, e.w, 8);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(e.x + 7, e.y + 7, 4, 4);
      ctx.fillRect(e.x + e.w - 11, e.y + 7, 4, 4);
    });
  }

  function update() {
    if (isOver) return;

    stars.forEach(st => {
      st.y += st.s * 0.8;
      if (st.y > canvas.height) { st.y = 0; st.x = Math.random() * canvas.width; }
    });

    // 自機移動（上下左右移動対応）
    if (keys['ArrowLeft'] || keys['KeyA']) ship.x = Math.max(6, ship.x - 4.8);
    if (keys['ArrowRight'] || keys['KeyD']) ship.x = Math.min(canvas.width - ship.w - 6, ship.x + 4.8);
    if (keys['ArrowUp'] || keys['KeyW']) ship.y = Math.max(160, ship.y - 4.2);
    if (keys['ArrowDown'] || keys['KeyS']) ship.y = Math.min(canvas.height - ship.h - 8, ship.y + 4.2);

    // 自動連射＆スペース手動連射
    if (shootCooldown > 0) shootCooldown--;
    if ((keys['Space'] || shootCooldown === 0) && shootCooldown === 0) {
      fireBullet();
      shootCooldown = 14;
    }

    bullets.forEach(b => { b.x += b.dx; b.y += b.dy; });
    bullets = bullets.filter(b => b.y > -15);

    // 敵編隊の左右移動＆攻撃
    let hitEdge = false;
    const moveStep = (1.1 + wave * 0.2) * enemyDir;
    enemies.forEach(e => {
      if (!e.alive) return;
      e.x += moveStep;
      if (e.x <= 10 || e.x + e.w >= canvas.width - 10) hitEdge = true;

      // ランダムに自機狙い弾を発射
      if (Math.random() < 0.004 + wave * 0.001) {
        const angle = Math.atan2(ship.y - e.y, ship.x - e.x);
        const bSpeed = Math.min(4.8, 2.6 + wave * 0.25);
        enemyBullets.push({
          x: e.x + e.w / 2,
          y: e.y + e.h,
          dx: Math.cos(angle) * bSpeed,
          dy: Math.sin(angle) * bSpeed
        });
      }
    });

    if (hitEdge) {
      enemyDir *= -1;
      enemies.forEach(e => { if (e.alive) e.y += 10; });
    }

    // 自機弾と敵の当たり判定
    bullets.forEach(b => {
      enemies.forEach(e => {
        if (!e.alive || b.used) return;
        if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
          b.used = true;
          e.hp--;
          if (e.hp <= 0) {
            e.alive = false;
            score += 30;
            if (callbacks.onScoreUpdate) callbacks.onScoreUpdate(score);
            if (Math.random() < 0.14) {
              powerUps.push({ x: e.x + e.w / 2, y: e.y + e.h / 2 });
            }
          }
        }
      });
    });
    bullets = bullets.filter(b => !b.used);

    // パワーアップ取得
    powerUps.forEach(p => {
      p.y += 2.2;
      if (Math.hypot(p.x - (ship.x + ship.w / 2), p.y - (ship.y + ship.h / 2)) < 22) {
        p.collected = true;
        ship.power = 2;
        score += 50;
        if (callbacks.onScoreUpdate) callbacks.onScoreUpdate(score);
      }
    });
    powerUps = powerUps.filter(p => p.y < canvas.height + 15 && !p.collected);

    // 敵弾と自機の当たり判定
    for (let i = 0; i < enemyBullets.length; i++) {
      const eb = enemyBullets[i];
      eb.x += eb.dx;
      eb.y += eb.dy;
      if (eb.x > ship.x + 6 && eb.x < ship.x + ship.w - 6 &&
          eb.y > ship.y + 6 && eb.y < ship.y + ship.h - 4) {
        isOver = true;
        draw();
        if (callbacks.onGameOver) callbacks.onGameOver(score);
        return;
      }
    }
    enemyBullets = enemyBullets.filter(eb => eb.y < canvas.height + 10 && eb.x > -10 && eb.x < canvas.width + 10);

    // 全滅で次WAVEへ
    if (enemies.every(e => !e.alive)) {
      wave++;
      score += 150;
      if (callbacks.onScoreUpdate) callbacks.onScoreUpdate(score);
      spawnWave();
    }

    draw();
    animId = requestAnimationFrame(update);
  }

  function handleKeyDown(e) {
    if (isOver) return;
    keys[e.code] = true;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  }

  function handleKeyUp(e) {
    keys[e.code] = false;
  }

  window.ArcadeGames.galaga = {
    title: '🚀 スペースシューター (Galaga風)',
    rankTitle: '🏆 スペースシューター ランキング',
    controlsHint: '操作方法：<strong>↑ ↓ ← →</strong> 8方向移動（自動連射・<strong>P</strong>アイテムで3WAYショット強化！）',
    initIdle() {
      ship = { x: 205, y: 335, w: 30, h: 28, power: 1 };
      wave = 1;
      spawnWave();
      draw();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('「ゲーム開始」を押して出撃！', canvas.width / 2, canvas.height / 2);
    },
    start(cbs) {
      callbacks = cbs || {};
      ship = { x: 205, y: 335, w: 30, h: 28, power: 1 };
      bullets = [];
      enemyBullets = [];
      powerUps = [];
      keys = {};
      score = 0;
      wave = 1;
      shootCooldown = 0;
      enemyDir = 1;
      isOver = false;
      spawnWave();
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);
      update();
    },
    stop() {
      isOver = true;
      if (animId) cancelAnimationFrame(animId);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    }
  };
})();
