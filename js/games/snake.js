(function () {
  const canvas = document.getElementById('snake-canvas');
  const ctx = canvas.getContext('2d');
  const gridSize = 17;
  const tileCount = 20;

  let snake = [], food = { x: 10, y: 10 }, dx = 1, dy = 0, nextDx = 1, nextDy = 0;
  let score = 0, isOver = true, timer = null;
  let callbacks = {};

  function spawnFood() {
    food = { x: Math.floor(Math.random() * tileCount), y: Math.floor(Math.random() * tileCount) };
    if (snake.some(seg => seg.x === food.x && seg.y === food.y)) spawnFood();
  }

  function gameLoop() {
    if (isOver) return;
    dx = nextDx; dy = nextDy;
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount ||
        snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      isOver = true;
      clearInterval(timer);
      if (callbacks.onGameOver) callbacks.onGameOver(score);
      return;
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      if (callbacks.onScoreUpdate) callbacks.onScoreUpdate(score);
      spawnFood();
    } else {
      snake.pop();
    }

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(food.x * gridSize + gridSize / 2, food.y * gridSize + gridSize / 2, gridSize / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    snake.forEach((seg, index) => {
      ctx.fillStyle = index === 0 ? '#4ade80' : '#22c55e';
      ctx.fillRect(seg.x * gridSize + 1, seg.y * gridSize + 1, gridSize - 2, gridSize - 2);
    });
  }

  function handleKeyDown(e) {
    if (isOver) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
    if (e.key === 'ArrowLeft' && dx !== 1) { nextDx = -1; nextDy = 0; }
    else if (e.key === 'ArrowRight' && dx !== -1) { nextDx = 1; nextDy = 0; }
    else if (e.key === 'ArrowUp' && dy !== 1) { nextDx = 0; nextDy = -1; }
    else if (e.key === 'ArrowDown' && dy !== -1) { nextDx = 0; nextDy = 1; }
  }

  window.ArcadeGames.snake = {
    title: '🐍 スネークゲーム (Snake)',
    rankTitle: '🏆 スネーク ランキング',
    controlsHint: '操作方法：矢印キー <strong>↑ ↓ ← →</strong> で移動（赤いエサで +10 点）',
    initIdle() {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#4ade80';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('「ゲーム開始」を押してスタート', canvas.width / 2, canvas.height / 2);
    },
    start(cbs) {
      callbacks = cbs || {};
      snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
      dx = 1; dy = 0; nextDx = 1; nextDy = 0;
      score = 0;
      isOver = false;
      document.addEventListener('keydown', handleKeyDown);
      spawnFood();
      timer = setInterval(gameLoop, 120);
    },
    stop() {
      isOver = true;
      if (timer) clearInterval(timer);
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
})();
