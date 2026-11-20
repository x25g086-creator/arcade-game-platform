(function () {
  const canvas = document.getElementById('tetris-canvas');
  const ctx = canvas.getContext('2d');
  const SCALE = 20; // 240x400 -> 12x20 grid

  const colors = [
    null,
    '#ef4444', // T - Red
    '#38bdf8', // O - Sky Blue
    '#4ade80', // L - Green
    '#facc15', // J - Yellow
    '#c084fc', // I - Purple
    '#fb923c', // S - Orange
    '#2dd4bf'  // Z - Teal
  ];

  const arena = Array.from({ length: 20 }, () => Array(12).fill(0));
  const player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    nextMatrix: null,
    score: 0,
    lines: 0
  };

  let dropCounter = 0;
  let lastTime = 0;
  let isOver = true;
  let animId = null;
  let callbacks = {};
  let touchControlsEl = null;

  function createPiece(type) {
    if (type === 'T') return [[0, 0, 0], [1, 1, 1], [0, 1, 0]];
    if (type === 'O') return [[2, 2], [2, 2]];
    if (type === 'L') return [[0, 3, 0], [0, 3, 0], [0, 3, 3]];
    if (type === 'J') return [[0, 4, 0], [0, 4, 0], [4, 4, 0]];
    if (type === 'I') return [[0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0]];
    if (type === 'S') return [[0, 6, 6], [6, 6, 0], [0, 0, 0]];
    if (type === 'Z') return [[7, 7, 0], [0, 7, 7], [0, 0, 0]];
  }

  function randomPiece() {
    const pieces = 'ILJOTSZ';
    return createPiece(pieces[(pieces.length * Math.random()) | 0]);
  }

  function collide(matrix = player.matrix, pos = player.pos) {
    for (let y = 0; y < matrix.length; ++y) {
      for (let x = 0; x < matrix[y].length; ++x) {
        if (
          matrix[y][x] !== 0 &&
          (arena[y + pos.y] && arena[y + pos.y][x + pos.x]) !== 0
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function merge() {
    player.matrix.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val !== 0) {
          arena[y + player.pos.y][x + player.pos.x] = val;
        }
      });
    });
  }

  function arenaSweep() {
    let linesCleared = 0;
    outer: for (let y = arena.length - 1; y >= 0; --y) {
      for (let x = 0; x < arena[y].length; ++x) {
        if (arena[y][x] === 0) continue outer;
      }
      const row = arena.splice(y, 1)[0].fill(0);
      arena.unshift(row);
      ++y;
      linesCleared++;
    }

    if (linesCleared > 0) {
      const lineBonus = [0, 100, 300, 500, 800][linesCleared] || linesCleared * 200;
      player.lines += linesCleared;
      player.score += lineBonus;
      if (callbacks.onScoreUpdate) callbacks.onScoreUpdate(player.score);
    }
  }

  function rotate(matrix) {
    for (let y = 0; y < matrix.length; ++y) {
      for (let x = 0; x < y; ++x) {
        [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
      }
    }
    matrix.forEach(row => row.reverse());
  }

  function playerRotate() {
    if (isOver || !player.matrix) return;
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix);
    while (collide()) {
      player.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > player.matrix[0].length) {
        rotate(player.matrix);
        rotate(player.matrix);
        rotate(player.matrix);
        player.pos.x = pos;
        return;
      }
    }
  }

  function playerMove(dir) {
    if (isOver || !player.matrix) return;
    player.pos.x += dir;
    if (collide()) player.pos.x -= dir;
  }

  function playerReset() {
    player.matrix = player.nextMatrix || randomPiece();
    player.nextMatrix = randomPiece();
    player.pos.y = 0;
    player.pos.x = ((arena[0].length / 2) | 0) - ((player.matrix[0].length / 2) | 0);
    if (collide()) {
      isOver = true;
      if (callbacks.onGameOver) callbacks.onGameOver(player.score);
    }
  }

  function playerDrop() {
    if (isOver || !player.matrix) return;
    player.pos.y++;
    if (collide()) {
      player.pos.y--;
      merge();
      playerReset();
      arenaSweep();
    }
    dropCounter = 0;
  }

  function playerHardDrop() {
    if (isOver || !player.matrix) return;
    let dropped = 0;
    while (!collide()) {
      player.pos.y++;
      dropped++;
    }
    player.pos.y--;
    if (dropped > 1) {
      player.score += (dropped - 1) * 2;
      if (callbacks.onScoreUpdate) callbacks.onScoreUpdate(player.score);
    }
    merge();
    playerReset();
    arenaSweep();
    dropCounter = 0;
  }

  function getGhostY() {
    if (!player.matrix) return player.pos.y;
    let ghostY = player.pos.y;
    while (!collide(player.matrix, { x: player.pos.x, y: ghostY + 1 })) {
      ghostY++;
    }
    return ghostY;
  }

  function drawBlock(gx, gy, color, alpha = 1) {
    const px = gx * SCALE;
    const py = gy * SCALE;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, SCALE - 2, SCALE - 2);

    // 立体ハイライト
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(px + 1, py + 1, SCALE - 2, 3);
    ctx.restore();
  }

  function draw() {
    // 背景
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 薄いグリッド線
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.28)';
    ctx.lineWidth = 1;
    for (let x = 1; x < 12; x++) {
      ctx.beginPath();
      ctx.moveTo(x * SCALE, 0);
      ctx.lineTo(x * SCALE, canvas.height);
      ctx.stroke();
    }
    for (let y = 1; y < 20; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * SCALE);
      ctx.lineTo(canvas.width, y * SCALE);
      ctx.stroke();
    }

    // 固定済みブロック
    arena.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val !== 0) drawBlock(x, y, colors[val], 1);
      });
    });

    if (player.matrix) {
      // 1. 落下予測ゴーストピース
      const ghostY = getGhostY();
      player.matrix.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val !== 0) {
            drawBlock(x + player.pos.x, y + ghostY, colors[val], 0.22);
          }
        });
      });

      // 2. 操作中のブロック
      player.matrix.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val !== 0) {
            drawBlock(x + player.pos.x, y + player.pos.y, colors[val], 1);
          }
        });
      });
    }

    // 3. 右上 NEXT プレビュー小窓
    if (player.nextMatrix) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.fillRect(canvas.width - 56, 6, 50, 52);
      ctx.strokeRect(canvas.width - 56, 6, 50, 52);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('NEXT', canvas.width - 44, 16);

      const miniSize = 9;
      player.nextMatrix.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val !== 0) {
            ctx.fillStyle = colors[val];
            ctx.fillRect(
              canvas.width - 48 + x * miniSize,
              21 + y * miniSize,
              miniSize - 1,
              miniSize - 1
            );
          }
        });
      });
      ctx.restore();
    }
  }

  function update(time = 0) {
    if (isOver) return;
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;

    // 消去ライン数に応じて徐々にスピードアップ（800ms -> 最速220ms）
    const speedInterval = Math.max(800 - Math.floor(player.lines / 5) * 60, 220);
    if (dropCounter > speedInterval) playerDrop();

    draw();
    animId = requestAnimationFrame(update);
  }

  function handleKeyDown(e) {
    if (isOver) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      playerMove(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      playerMove(1);
    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      playerDrop();
    } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      playerRotate();
    } else if (e.key === ' ') {
      playerHardDrop();
    }
    draw();
  }

  // スマホ・タッチ操作用ボタンバーの自動生成
  function ensureTouchControls() {
    if (touchControlsEl) {
      touchControlsEl.style.display = 'flex';
      return;
    }

    touchControlsEl = document.createElement('div');
    touchControlsEl.id = 'tetris-touch-controls';
    touchControlsEl.style.cssText =
      'display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-top:12px; width:100%; max-width:320px;';

    const buttons = [
      { label: '◀', title: '左移動', action: () => { playerMove(-1); draw(); } },
      { label: '↻', title: '回転', action: () => { playerRotate(); draw(); } },
      { label: '▶', title: '右移動', action: () => { playerMove(1); draw(); } },
      { label: '▼', title: '高速落下', action: () => { playerDrop(); draw(); } },
      { label: '⤓', title: '一気に落下', action: () => { playerHardDrop(); draw(); }, accent: true }
    ];

    buttons.forEach(cfg => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = cfg.label;
      btn.title = cfg.title;
      btn.style.cssText = `
        flex: 1;
        min-width: 48px;
        height: 44px;
        border-radius: 10px;
        border: 1px solid ${cfg.accent ? '#38bdf8' : '#334155'};
        background: ${cfg.accent ? 'rgba(56, 189, 248, 0.2)' : '#0f172a'};
        color: ${cfg.accent ? '#38bdf8' : '#f8fafc'};
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        user-select: none;
        touch-action: manipulation;
      `;
      const trigger = (e) => {
        e.preventDefault();
        cfg.action();
      };
      btn.addEventListener('touchstart', trigger, { passive: false });
      btn.addEventListener('mousedown', trigger);
      touchControlsEl.appendChild(btn);
    });

    canvas.insertAdjacentElement('afterend', touchControlsEl);

    // キャンバス上のスワイプ＆タップ操作にも対応
    let startX = 0, startY = 0;
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
      if (isOver || e.changedTouches.length === 0) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 15) {
        playerRotate();
      } else if (Math.abs(dx) > Math.abs(dy)) {
        playerMove(dx > 0 ? 1 : -1);
      } else if (dy > 25) {
        playerHardDrop();
      }
      draw();
    }, { passive: true });
  }

  function hideTouchControls() {
    if (touchControlsEl) {
      touchControlsEl.style.display = 'none';
    }
  }

  window.ArcadeGames.tetris = {
    title: '🧱 テトリス (Tetris)',
    rankTitle: '🏆 テトリス ランキング',
    controlsHint: 'PC：<strong>← →</strong> 移動 ｜ <strong>↑</strong> 回転 ｜ <strong>↓</strong> 加速 ｜ <strong>Space</strong> 一気落下<br>スマホ：下のボタンまたは画面タップ・スワイプで操作',
    initIdle() {
      arena.forEach(row => row.fill(0));
      player.matrix = null;
      player.nextMatrix = null;
      ensureTouchControls();
      draw();
    },
    start(cbs) {
      callbacks = cbs || {};
      arena.forEach(row => row.fill(0));
      player.score = 0;
      player.lines = 0;
      player.nextMatrix = randomPiece();
      isOver = false;
      ensureTouchControls();
      document.removeEventListener('keydown', handleKeyDown);
      document.addEventListener('keydown', handleKeyDown);
      playerReset();
      lastTime = performance.now();
      update();
    },
    stop() {
      isOver = true;
      if (animId) cancelAnimationFrame(animId);
      document.removeEventListener('keydown', handleKeyDown);
      hideTouchControls();
    }
  };
})();