(function () {
  const canvas = document.getElementById('game2048-canvas');
  const ctx = canvas.getContext('2d');
  const SIZE = 4;
  const CELL = 76;
  const GAP = 10;

  let board = [];
  let score = 0;
  let isOver = true;
  let callbacks = {};

  const TILE_COLORS = {
    0: { bg: '#1e293b', fg: '#f8fafc' },
    2: { bg: '#e2e8f0', fg: '#0f172a' },
    4: { bg: '#fde68a', fg: '#0f172a' },
    8: { bg: '#fdba74', fg: '#ffffff' },
    16: { bg: '#fb923c', fg: '#ffffff' },
    32: { bg: '#f87171', fg: '#ffffff' },
    64: { bg: '#ef4444', fg: '#ffffff' },
    128: { bg: '#facc15', fg: '#0f172a' },
    256: { bg: '#eab308', fg: '#0f172a' },
    512: { bg: '#4ade80', fg: '#0f172a' },
    1024: { bg: '#38bdf8', fg: '#0f172a' },
    2048: { bg: '#c084fc', fg: '#ffffff' }
  };

  function addRandomTile() {
    const empty = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) empty.push({ r, c });
      }
    }
    if (empty.length > 0) {
      const pick = empty[Math.floor(Math.random() * empty.length)];
      board[pick.r][pick.c] = Math.random() < 0.9 ? 2 : 4;
    }
  }

  function slideLine(line) {
    let arr = line.filter(v => v !== 0);
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        score += arr[i];
        arr[i + 1] = 0;
      }
    }
    arr = arr.filter(v => v !== 0);
    while (arr.length < SIZE) arr.push(0);
    return arr;
  }

  function move(dir) {
    if (isOver) return;
    const prev = JSON.stringify(board);

    if (dir === 'left' || dir === 'right') {
      for (let r = 0; r < SIZE; r++) {
        let row = [...board[r]];
        if (dir === 'right') row.reverse();
        row = slideLine(row);
        if (dir === 'right') row.reverse();
        board[r] = row;
      }
    } else {
      for (let c = 0; c < SIZE; c++) {
        let col = [board[0][c], board[1][c], board[2][c], board[3][c]];
        if (dir === 'down') col.reverse();
        col = slideLine(col);
        if (dir === 'down') col.reverse();
        for (let r = 0; r < SIZE; r++) board[r][c] = col[r];
      }
    }

    if (JSON.stringify(board) !== prev) {
      addRandomTile();
      if (callbacks.onScoreUpdate) callbacks.onScoreUpdate(score);
      draw();
      if (checkGameOver()) {
        isOver = true;
        if (callbacks.onGameOver) callbacks.onGameOver(score);
      }
    }
  }

  function checkGameOver() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) return false;
        if (c < SIZE - 1 && board[r][c] === board[r][c + 1]) return false;
        if (r < SIZE - 1 && board[r][c] === board[r + 1][c]) return false;
      }
    }
    return true;
  }

  function draw() {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const val = board[r][c];
        const x = GAP + c * (CELL + GAP);
        const y = GAP + r * (CELL + GAP);
        const style = TILE_COLORS[val] || { bg: '#818cf8', fg: '#ffffff' };

        ctx.fillStyle = style.bg;
        ctx.beginPath();
        ctx.roundRect(x, y, CELL, CELL, 8);
        ctx.fill();

        if (val !== 0) {
          ctx.fillStyle = style.fg;
          ctx.font = val >= 1024 ? 'bold 20px sans-serif' : val >= 128 ? 'bold 24px sans-serif' : 'bold 28px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(val, x + CELL / 2, y + CELL / 2);
        }
      }
    }
  }

  function handleKeyDown(e) {
    if (isOver) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
    if (e.key === 'ArrowLeft' || e.key === 'a') move('left');
    else if (e.key === 'ArrowRight' || e.key === 'd') move('right');
    else if (e.key === 'ArrowUp' || e.key === 'w') move('up');
    else if (e.key === 'ArrowDown' || e.key === 's') move('down');
  }

  window.ArcadeGames.game2048 = {
    title: '🔢 2048 パズル (2048)',
    rankTitle: '🏆 2048 ランキング',
    controlsHint: '操作方法：矢印キー <strong>↑ ↓ ← →</strong> で同じ数字を合体させて 2048 を目指そう！',
    initIdle() {
      board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
      draw();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('「ゲーム開始」を押してスタート', canvas.width / 2, canvas.height / 2);
    },
    start(cbs) {
      callbacks = cbs || {};
      board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
      score = 0;
      isOver = false;
      addRandomTile();
      addRandomTile();
      document.addEventListener('keydown', handleKeyDown);
      draw();
    },
    stop() {
      isOver = true;
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
})();
