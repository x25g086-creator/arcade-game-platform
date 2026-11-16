(function () {
  const canvas = document.getElementById('breakout-canvas');
  const ctx = canvas.getContext('2d');

  let paddle = { x: 185, y: 315, w: 90, h: 12 };
  let ball = { x: 230, y: 290, r: 7, dx: 3.2, dy: -3.2 };
  let bricks = [];
  let keys = {};
  let score = 0, level = 1, isOver = true, animId = null;
  let callbacks = {};

  const ROW_COLORS = ['#ef4444', '#fb923c', '#facc15', '#4ade80', '#38bdf8'];

  function initBricks() {
    bricks = [];
    const rows = Math.min(6, 4 + level);
    const cols = 7;
    const bw = 56, bh = 18, pad = 6, offX = 16, offY = 32;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        bricks.push({
          x: offX + c * (bw + pad),
          y: offY + r * (bh + pad),
          w: bw,
          h: bh,
          color: ROW_COLORS[r % ROW_COLORS.length],
          alive: true
        });
      }
    }
  }

  function draw() {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ステージ表示
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`STAGE ${level}`, 14, 20);

    // ブロック描画
    bricks.forEach(b => {
      if (!b.alive) return;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.fill();
    });

    // パドル描画
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
    ctx.fill();

    // ボール描画
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
  }

  function update() {
    if (isOver) return;

    if (keys['ArrowLeft'] || keys['KeyA']) paddle.x = Math.max(0, paddle.x - 6);
    if (keys['ArrowRight'] || keys['KeyD']) paddle.x = Math.min(canvas.width - paddle.w, paddle.x + 6);

    ball.x += ball.dx;
    ball.y += ball.dy;

    // 壁反射
    if (ball.x - ball.r < 0 || ball.x + ball.r > canvas.width) ball.dx *= -1;
    if (ball.y - ball.r < 0) ball.dy *= -1;

    // パドル反射（当たった位置で角度変化）
    if (ball.dy > 0 &&
        ball.y + ball.r >= paddle.y &&
        ball.y - ball.r <= paddle.y + paddle.h &&
        ball.x >= paddle.x &&
        ball.x <= paddle.x + paddle.w) {
      const hitRatio = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const speed = Math.hypot(ball.dx, ball.dy);
      ball.dx = hitRatio * speed * 0.85;
      ball.dy = -Math.sqrt(Math.max(4, speed * speed - ball.dx * ball.dx));
    }

    // ブロック衝突判定
    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      if (!b.alive) continue;
      if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
          ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
        b.alive = false;
        ball.dy *= -1;
        score += 15;
        if (callbacks.onScoreUpdate) callbacks.onScoreUpdate(score);
        break;
      }
    }

    // 全破壊で次ステージへ
    if (bricks.every(b => !b.alive)) {
      level++;
      score += 100;
      if (callbacks.onScoreUpdate) callbacks.onScoreUpdate(score);
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - 16;
      ball.dx = (ball.dx > 0 ? 1 : -1) * (3.2 + level * 0.35);
      ball.dy = -(3.2 + level * 0.35);
      initBricks();
    }

    // 落下判定
    if (ball.y - ball.r > canvas.height) {
      isOver = true;
      draw();
      if (callbacks.onGameOver) callbacks.onGameOver(score);
      return;
    }

    draw();
    animId = requestAnimationFrame(update);
  }

  function handleKeyDown(e) {
    if (isOver) return;
    keys[e.code] = true;
    if (['ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }

  function handleKeyUp(e) {
    keys[e.code] = false;
  }

  window.ArcadeGames.breakout = {
    title: '🧱 ブロック崩し (Breakout)',
    rankTitle: '🏆 ブロック崩し ランキング',
    controlsHint: '操作方法：<strong>← →</strong>（または A / D）でパドルを移動して全ブロック破壊を目指そう！',
    initIdle() {
      level = 1;
      initBricks();
      draw();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('「ゲーム開始」を押してスタート', canvas.width / 2, canvas.height / 2);
    },
    start(cbs) {
      callbacks = cbs || {};
      paddle = { x: 185, y: 315, w: 90, h: 12 };
      ball = { x: 230, y: 290, r: 7, dx: 3.2, dy: -3.2 };
      keys = {};
      score = 0;
      level = 1;
      isOver = false;
      initBricks();
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
