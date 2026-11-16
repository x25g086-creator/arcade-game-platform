(function () {
  const canvas = document.getElementById('dino-canvas');
  const ctx = canvas.getContext('2d');
  const GROUND_Y = 250;

  let dino = { x: 55, y: GROUND_Y - 40, w: 32, h: 40, vy: 0, ducking: false, legFrame: 0 };
  let obstacles = [];
  let clouds = [{ x: 140, y: 55 }, { x: 380, y: 80 }];
  let score = 0, dist = 0, speed = 5.0;
  let isOver = true, animId = null, spawnTimer = 0;
  let callbacks = {};

  function jump() {
    if (dino.y >= GROUND_Y - dino.h - 1) {
      dino.vy = -11.5;
    }
  }

  function spawnObstacle() {
    const r = Math.random();
    if (r < 0.7) {
      // サボテン（1〜2本連なり）
      const count = Math.random() < 0.45 ? 2 : 1;
      obstacles.push({
        type: 'cactus',
        x: canvas.width + 20,
        y: GROUND_Y - 36,
        w: count === 2 ? 32 : 18,
        h: 36
      });
    } else {
      // プテラノドン（低空または高空）
      const high = Math.random() < 0.5;
      obstacles.push({
        type: 'bird',
        x: canvas.width + 20,
        y: high ? GROUND_Y - 68 : GROUND_Y - 34,
        w: 34,
        h: 22
      });
    }
  }

  function drawScene() {
    const isNight = Math.floor(score / 300) % 2 === 1;
    ctx.fillStyle = isNight ? '#0f172a' : '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 雲・星
    ctx.fillStyle = isNight ? '#475569' : '#cbd5e1';
    clouds.forEach(c => {
      ctx.fillRect(c.x, c.y, 44, 12);
      ctx.fillRect(c.x + 10, c.y - 6, 24, 10);
    });

    // 地面ライン
    ctx.strokeStyle = isNight ? '#64748b' : '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(canvas.width, GROUND_Y);
    ctx.stroke();

    // 恐竜描画
    const curH = dino.ducking ? 24 : 40;
    const curY = dino.ducking ? GROUND_Y - 24 : dino.y;
    ctx.fillStyle = isNight ? '#38bdf8' : '#334155';
    // 胴体と頭
    ctx.fillRect(dino.x + 4, curY + 8, 20, curH - 14);
    ctx.fillRect(dino.x + 14, curY, 18, 14);
    // 目
    ctx.fillStyle = isNight ? '#0f172a' : '#f8fafc';
    ctx.fillRect(dino.x + 24, curY + 3, 3, 3);
    // 足アニメーション
    ctx.fillStyle = isNight ? '#38bdf8' : '#334155';
    const step = Math.floor(dino.legFrame / 6) % 2;
    if (step === 0) {
      ctx.fillRect(dino.x + 7, curY + curH - 6, 5, 6);
      ctx.fillRect(dino.x + 17, curY + curH - 9, 5, 6);
    } else {
      ctx.fillRect(dino.x + 7, curY + curH - 9, 5, 6);
      ctx.fillRect(dino.x + 17, curY + curH - 6, 5, 6);
    }

    // 障害物描画
    obstacles.forEach(obs => {
      if (obs.type === 'cactus') {
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(obs.x + 4, obs.y, 10, obs.h);
        ctx.fillRect(obs.x, obs.y + 10, 18, 6);
        if (obs.w > 20) {
          ctx.fillRect(obs.x + 18, obs.y + 4, 10, obs.h - 4);
        }
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(obs.x + 4, obs.y + 8, 26, 8);
        const wingY = Math.floor(dino.legFrame / 8) % 2 === 0 ? obs.y : obs.y + 12;
        ctx.fillRect(obs.x + 12, wingY, 10, 8);
      }
    });
  }

  function update() {
    if (isOver) return;

    speed = Math.min(11, 5.0 + dist * 0.0005);
    dist += speed;
    dino.legFrame++;

    if (Math.floor(dist) % 15 === 0) {
      score += 1;
      if (callbacks.onScoreUpdate) callbacks.onScoreUpdate(score);
    }

    clouds.forEach(c => {
      c.x -= speed * 0.25;
      if (c.x < -50) c.x = canvas.width + 30;
    });

    const gravity = dino.ducking ? 1.1 : 0.6;
    dino.vy += gravity;
    dino.y += dino.vy;
    if (dino.y >= GROUND_Y - dino.h) {
      dino.y = GROUND_Y - dino.h;
      dino.vy = 0;
    }

    spawnTimer++;
    if (spawnTimer > Math.max(45, 95 - speed * 4)) {
      spawnObstacle();
      spawnTimer = 0;
    }

    const hitBoxY = dino.ducking ? GROUND_Y - 24 : dino.y;
    const hitBoxH = dino.ducking ? 24 : dino.h;

    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      obs.x -= speed;
      if (dino.x + 4 < obs.x + obs.w - 3 &&
          dino.x + dino.w - 4 > obs.x + 3 &&
          hitBoxY + 3 < obs.y + obs.h - 2 &&
          hitBoxY + hitBoxH - 2 > obs.y + 2) {
        isOver = true;
        drawScene();
        if (callbacks.onGameOver) callbacks.onGameOver(score);
        return;
      }
    }
    obstacles = obstacles.filter(o => o.x > -50);

    drawScene();
    animId = requestAnimationFrame(update);
  }

  function handleKeyDown(e) {
    if (isOver) return;
    if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') jump();
    if (e.code === 'ArrowDown' || e.code === 'KeyS') dino.ducking = true;
  }

  function handleKeyUp(e) {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') dino.ducking = false;
  }

  window.ArcadeGames.dino = {
    title: '🦖 恐竜ランナー (Dino Runner)',
    rankTitle: '🏆 恐竜ランナー ランキング',
    controlsHint: '操作方法：<strong>↑ / スペース</strong> ジャンプ ｜ <strong>↓</strong> しゃがむ（プテラノドン回避）',
    initIdle() {
      dino = { x: 55, y: GROUND_Y - 40, w: 32, h: 40, vy: 0, ducking: false, legFrame: 0 };
      obstacles = [];
      score = 0;
      drawScene();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('「ゲーム開始」を押してダッシュ！', canvas.width / 2, canvas.height / 2);
    },
    start(cbs) {
      callbacks = cbs || {};
      dino = { x: 55, y: GROUND_Y - 40, w: 32, h: 40, vy: 0, ducking: false, legFrame: 0 };
      obstacles = [];
      score = 0;
      dist = 0;
      speed = 5.0;
      spawnTimer = 0;
      isOver = false;
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
