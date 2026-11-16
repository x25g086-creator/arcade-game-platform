(function () {
  const canvas = document.getElementById('tetris-canvas');
  const ctx = canvas.getContext('2d');
  ctx.scale(20, 20);

  const colors = [null, '#ef4444', '#38bdf8', '#4ade80', '#facc15', '#c084fc', '#fb923c', '#2dd4bf'];
  const arena = Array.from({ length: 20 }, () => Array(12).fill(0));
  const player = { pos: { x: 0, y: 0 }, matrix: null, score: 0 };

  let dropCounter = 0, lastTime = 0, isOver = true, animId = null;
  let callbacks = {};

  function createPiece(type) {
    if (type === 'T') return [[0,0,0],[1,1,1],[0,1,0]];
    if (type === 'O') return [[2,2],[2,2]];
    if (type === 'L') return [[0,3,0],[0,3,0],[0,3,3]];
    if (type === 'J') return [[0,4,0],[0,4,0],[4,4,0]];
    if (type === 'I') return [[0,5,0,0],[0,5,0,0],[0,5,0,0],[0,5,0,0]];
    if (type === 'S') return [[0,6,6],[6,6,0],[0,0,0]];
    if (type === 'Z') return [[7,7,0],[0,7,7],[0,0,0]];
  }

  function collide() {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
      for (let x = 0; x < m[y].length; ++x) {
        if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) return true;
      }
    }
    return false;
  }

  function merge() {
    player.matrix.forEach((row, y) => {
      row.forEach((val, x) => { if (val !== 0) arena[y + player.pos.y][x + player.pos.x] = val; });
    });
  }

  function arenaSweep() {
    let rowCount = 1;
    outer: for (let y = arena.length - 1; y > 0; --y) {
      for (let x = 0; x < arena[y].length; ++x) if (arena[y][x] === 0) continue outer;
      const row = arena.splice(y, 1)[0].fill(0);
      arena.unshift(row);
      ++y;
      player.score += rowCount * 100;
      rowCount *= 2;
    }
    if (callbacks.onScoreUpdate) callbacks.onScoreUpdate(player.score);
  }

  function rotate(matrix) {
    for (let y = 0; y < matrix.length; ++y) {
      for (let x = 0; x < y; ++x) [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
    matrix.forEach(row => row.reverse());
  }

  function playerReset() {
    const pieces = 'ILJOTSZ';
    player.matrix = createPiece(pieces[pieces.length * Math.random() | 0]);
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    if (collide()) {
      isOver = true;
      if (callbacks.onGameOver) callbacks.onGameOver(player.score);
    }
  }

  function playerDrop() {
    player.pos.y++;
    if (collide()) {
      player.pos.y--;
      merge();
      playerReset();
      arenaSweep();
    }
    dropCounter = 0;
  }

  function draw() {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    arena.forEach((row, y) => row.forEach((val, x) => {
      if (val !== 0) { ctx.fillStyle = colors[val]; ctx.fillRect(x, y, 1, 1); }
    }));
    if (player.matrix) {
      player.matrix.forEach((row, y) => row.forEach((val, x) => {
        if (val !== 0) { ctx.fillStyle = colors[val]; ctx.fillRect(x + player.pos.x, y + player.pos.y, 1, 1); }
      }));
    }
  }

  function update(time = 0) {
    if (isOver) return;
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > 800) playerDrop();
    draw();
    animId = requestAnimationFrame(update);
  }

  function handleKeyDown(e) {
    if (isOver) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
    if (e.key === 'ArrowLeft') { player.pos.x--; if (collide()) player.pos.x++; }
    else if (e.key === 'ArrowRight') { player.pos.x++; if (collide()) player.pos.x--; }
    else if (e.key === 'ArrowDown') playerDrop();
    else if (e.key === 'ArrowUp') {
      const pos = player.pos.x; let offset = 1;
      rotate(player.matrix);
      while (collide()) {
        player.pos.x += offset; offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) { rotate(player.matrix); rotate(player.matrix); rotate(player.matrix); player.pos.x = pos; return; }
      }
    }
  }

  window.ArcadeGames.tetris = {
    title: '🧱 テトリス (Tetris)',
    rankTitle: '🏆 テトリス ランキング',
    controlsHint: '操作方法：<strong>← →</strong> 左右移動 ｜ <strong>↑</strong> 回転 ｜ <strong>↓</strong> 高速落下',
    initIdle() {
      arena.forEach(row => row.fill(0));
      player.matrix = null;
      draw();
    },
    start(cbs) {
      callbacks = cbs || {};
      arena.forEach(row => row.fill(0));
      player.score = 0;
      isOver = false;
      document.addEventListener('keydown', handleKeyDown);
      playerReset();
      lastTime = performance.now();
      update();
    },
    stop() {
      isOver = true;
      if (animId) cancelAnimationFrame(animId);
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
})();
