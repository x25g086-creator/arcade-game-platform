(function () {
  const canvas = document.getElementById('mario-canvas');
  const ctx = canvas.getContext('2d');
  const GROUND_Y = 270;

  let mario = { x: 70, y: GROUND_Y - 32, w: 24, h: 32, vy: 0, jumps: 0 };
  let keys = {};
  let obstacles = [];
  let coins = [];
  let clouds = [{ x: 100, y: 50 }, { x: 320, y: 75 }, { x: 480, y: 40 }];
  let score = 0, dist = 0, speed = 3.5;
  let isOver = true, animId = null, spawnTimer = 0;
  let callbacks = {};

  function jump() {
    if (mario.jumps < 2) {
      mario.vy = -10.5;
      mario.jumps++;
    }
  }

  function spawnEntities() {
    const r = Math.random();
    if (r < 0.45) {
      const pipeH = 34 + Math.floor(Math.random() * 24);
      obstacles.push({ type: 'pipe', x: canvas.width + 20, y: GROUND_Y - pipeH, w: 34, h: pipeH });
      coins.push({ x: canvas.width + 29, y: GROUND_Y - pipeH - 36, r: 8, collected: false });
    } else if (r < 0.85) {
      obstacles.push({ type: 'goomba', x: canvas.width + 20, y: GROUND_Y - 24, w: 26, h: 24, dead: false });
    } else {
      for (let i = 0; i < 3; i++) {
        coins.push({ x: canvas.width + 20 + i * 26, y: GROUND_Y - 85, r: 8, collected: false });
      }
    }
  }

  function drawScene() {
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    clouds.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 16, 0, Math.PI * 2);
      ctx.arc(c.x + 18, c.y - 4, 20, 0, Math.PI * 2);
      ctx.arc(c.x + 36, c.y, 15, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, GROUND_Y, canvas.width, 10);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(0, GROUND_Y + 10, canvas.width, canvas.height - GROUND_Y - 10);

    coins.forEach(c => {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    obstacles.forEach(obs => {
      if (obs.type === 'pipe') {
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(obs.x + 3, obs.y + 8, obs.w - 6, obs.h - 8);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(obs.x, obs.y, obs.w, 10);
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, 10);
      } else if (obs.type === 'goomba') {
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w / 2, obs.y + 12, 12, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(obs.x + 6, obs.y + 12, 14, 10);
        ctx.fillStyle = '#000';
        ctx.fillRect(obs.x + 8, obs.y + 13, 3, 5);
        ctx.fillRect(obs.x + 15, obs.y + 13, 3, 5);
      }
    });

    // プレイヤー描画
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(mario.x + 4, mario.y + 16, 16, 12);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(mario.x + 2, mario.y + 12, 20, 6);
    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(mario.x + 5, mario.y + 5, 15, 9);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(mario.x + 4, mario.y, 18, 5);
    ctx.fillRect(mario.x + 14, mario.y + 3, 10, 3);
    ctx.fillStyle = '#713f12';
    ctx.fillRect(mario.x + 3, mario.y + 28, 7, 4);
    ctx.fillRect(mario.x + 14, mario.y + 28, 7, 4);
  }

  function update() {
    if (isOver) return;

    speed = Math.min(7.5, 3.5 + dist * 0.0004);
    dist += speed;
    if (Math.floor(dist) % 25 === 0) {
      score += 1;
      if (callbacks.onScoreUpdate) callbacks.onScoreUpdate(score);
    }

    clouds.forEach(c => {
      c.x -= speed * 0.3;
      if (c.x < -60) c.x = canvas.width + 40;
    });

    if (keys['ArrowLeft'] || keys['KeyA']) mario.x = Math.max(10, mario.x - 4.2);
    if (keys['ArrowRight'] || keys['KeyD']) mario.x = Math.min(canvas.width - 60, mario.x + 4.2);

    mario.vy += 0.55;
    mario.y += mario.vy;
    if (mario.y >= GROUND_Y - mario.h) {
      mario.y = GROUND_Y - mario.h;
      mario.vy = 0;
      mario.jumps = 0;
    }

    spawnTimer++;
    if (spawnTimer > Math.max(55, 105 - speed * 5)) {
      spawnEntities();
      spawnTimer = 0;
    }

    coins.forEach(c => {
      c.x -= speed;
      if (!c.collected &&
          mario.x < c.x + c.r && mario.x + mario.w > c.x - c.r &&
          mario.y < c.y + c.r && mario.y + mario.h > c.y - c.r) {
        c.collected = true;
        score += 20;
        if (callbacks.onScoreUpdate) callbacks.onScoreUpdate(score);
      }
    });
    coins = coins.filter(c => c.x > -20 && !c.collected);

    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      obs.x -= obs.type === 'goomba' ? speed * 1.25 : speed;
      if (obs.dead) continue;

      const hitX = mario.x + 3 < obs.x + obs.w && mario.x + mario.w - 3 > obs.x;
      const hitY = mario.y + 2 < obs.y + obs.h && mario.y + mario.h > obs.y;

      if (hitX && hitY) {
        if (obs.type === 'goomba' && mario.vy > 0 && mario.y + mario.h - mario.vy <= obs.y + 12) {
          obs.dead = true;
          mario.vy = -8.5;
          mario.jumps = 1;
          score += 50;
          if (callbacks.onScoreUpdate) callbacks.onScoreUpdate(score);
        } else {
          isOver = true;
          drawScene();
          if (callbacks.onGameOver) callbacks.onGameOver(score);
          return;
        }
      }
    }
    obstacles = obstacles.filter(o => o.x > -50 && !o.dead);

    drawScene();
    animId = requestAnimationFrame(update);
  }

  function handleKeyDown(e) {
    if (isOver) return;
    keys[e.code] = true;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') jump();
  }

  function handleKeyUp(e) {
    keys[e.code] = false;
  }

  window.ArcadeGames.mario = {
    title: '🍄 マリオ風ラン (Super Jump)',
    rankTitle: '🏆 マリオ風ラン ランキング',
    controlsHint: '操作方法：<strong>← →</strong> 左右移動 ｜ <strong>↑ / スペース</strong> ジャンプ（2段ジャンプ可・敵を踏んで +50 点）',
    initIdle() {
      mario = { x: 70, y: GROUND_Y - 32, w: 24, h: 32, vy: 0, jumps: 0 };
      obstacles = [];
      coins = [];
      drawScene();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('「ゲーム開始」を押して冒険スタート！', canvas.width / 2, canvas.height / 2);
    },
    start(cbs) {
      callbacks = cbs || {};
      mario = { x: 70, y: GROUND_Y - 32, w: 24, h: 32, vy: 0, jumps: 0 };
      keys = {};
      obstacles = [];
      coins = [];
      score = 0;
      dist = 0;
      speed = 3.5;
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
