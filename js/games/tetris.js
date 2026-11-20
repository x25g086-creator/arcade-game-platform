window.ArcadeGames = window.ArcadeGames || {};

window.ArcadeGames.tetris = (function () {
  const canvas = document.getElementById('tetris-canvas');
  const ctx = canvas.getContext('2d');
  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 20;
  canvas.width = COLS * BLOCK;
  canvas.height = ROWS * BLOCK;

  const COLORS = [null, '#38bdf8', '#facc15', '#a855f7', '#4ade80', '#ef4444', '#fb923c', '#818cf8'];
  const SHAPES = [
    [],
    [[1, 1, 1, 1]],
    [[2, 2], [2, 2]],
    [[0, 3, 0], [3, 3, 3]],
    [[0, 4, 4], [4, 4, 0]],
    [[5, 5, 0], [0, 5, 5]],
    [[6, 0, 0], [6, 6, 6]],
    [[0, 0, 7], [7, 7, 7]]
  ];

  let board = [];
  let piece = null;
  let score = 0;
  let timer = null;
  let running = false;
  let callbacks = {};

  function resetBoard() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function newPiece() {
    const id = Math.floor(Math.random() * 7) + 1;
    const matrix = SHAPES[id].map(r => [...r]);
    return {
      matrix,
      x: Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2),
      y: 0
    };
  }

  function collide(b, p) {
    for (let y = 0; y < p.matrix.length; y++) {
      for (let x = 0; x < p.matrix[y].length; x++) {
        if (p.matrix[y][x] !== 0) {
          const ny = y + p.y;
          const nx = x + p.x;
          if (nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && b[ny][nx] !== 0)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function merge() {
    piece.matrix.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val !== 0 && y + piece.y >= 0) {
          board[y + piece.y][x + piece.x] = val;
        }
      });
    });
  }

  function sweep() {
    let lines = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(v => v !== 0)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(0));
        lines++;
        y++;
      }
    }
    if (lines > 0) {
      score += [0, 100, 300, 500, 800][lines];
      if (callbacks.onScoreUpdate) callbacks.onScoreUpdate(score);
    }
  }

  function rotate(matrix) {
    return matrix[0].map((_, i) => matrix.map(row => row[i]).reverse());
  }

  function draw() {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    board.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val) {
          ctx.fillStyle = COLORS[val];
          ctx.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
        }
      });
    });

    if (piece) {
      piece.matrix.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val) {
            ctx.fillStyle = COLORS[val];
            ctx.fillRect((piece.x + x) * BLOCK + 1, (piece.y + y) * BLOCK + 1, BLOCK - 2, BLOCK - 2);
          }
        });
      });
    }
  }

  function drop() {
    piece.y++;
    if (collide(board, piece)) {
      piece.y--;
      merge();
      sweep();
      piece = newPiece();
      if (collide(board, piece)) {
        stop();
        if (callbacks.onGameOver) callbacks.onGameOver(score);
        return;
      }
    }
    draw();
  }

  document.addEventListener('keydown', e => {
    if (!running || !piece) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === 'ArrowLeft') {
      piece.x--;
      if (collide(board, piece)) piece.x++;
    } else if (e.code === 'ArrowRight') {
      piece.x++;
      if (collide(board, piece)) piece.x--;
    } else if (e.code === 'ArrowDown') {
      drop();
    } else if (e.code === 'ArrowUp') {
      const old = piece.matrix;
      piece.matrix = rotate(piece.matrix);
      if (collide(board, piece)) piece.matrix = old;
    } else if (e.code === 'Space') {
      while (!collide(board, piece)) piece.y++;
      piece.y--;
      drop();
    }
    draw();
  });

  function stop() {
    running = false;
    if (timer) clearInterval(timer);
    timer = null;
  }

  function initIdle() {
    stop();
    resetBoard();
    piece = null;
    draw();
  }

  function start(cbs) {
    stop();
    callbacks = cbs || {};
    resetBoard();
    score = 0;
    piece = newPiece();
    running = true;
    draw();
    timer = setInterval(drop, 500);
  }

  return { initIdle, start, stop };
})();