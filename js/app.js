let currentUser = null;
let activeGame = 'tetris';

// DOM参照
const views = document.querySelectorAll('.view-container');
const navBtns = document.querySelectorAll('.nav-btn[data-view]');
const authModal = document.getElementById('auth-modal');
const authMessage = document.getElementById('auth-message');

const tetrisCanvas = document.getElementById('tetris-canvas');
const externalWrapper = document.getElementById('external-frame-wrapper');
const externalFrame = document.getElementById('external-game-frame');
const localStatsBar = document.getElementById('local-stats-bar');
const startGameBtn = document.getElementById('start-game-btn');
const controlsHint = document.getElementById('controls-hint');
const cloudSavePanel = document.getElementById('cloud-save-panel');

// 1. ビュー切り替え（ロビー / マイページ / 概要）
navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.view;
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    views.forEach(v => v.classList.toggle('active', v.id === `view-${target}`));
    if (target === 'profile') refreshProfileStats();
  });
});

// 2. ゲーム選択切り替え（テトリス / ディアブロ）
document.querySelectorAll('.game-item').forEach(item => {
  item.addEventListener('click', () => {
    const selected = item.dataset.game;
    if (selected === activeGame) return;

    document.querySelectorAll('.game-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    switchGame(selected);
  });
});

function switchGame(gameKey) {
  activeGame = gameKey;
  window.ArcadeGames.tetris.stop();

  if (gameKey === 'tetris') {
    document.getElementById('current-game-title').textContent = window.ArcadeGames.tetris.title;
    document.getElementById('lb-title').textContent = window.ArcadeGames.tetris.rankTitle;
    controlsHint.innerHTML = window.ArcadeGames.tetris.controlsHint;

    externalFrame.src = 'about:blank';
    externalWrapper.classList.add('hidden');
    cloudSavePanel.classList.add('hidden');
    tetrisCanvas.classList.remove('hidden');
    localStatsBar.classList.remove('hidden');
    startGameBtn.classList.remove('hidden');

    window.ArcadeGames.tetris.initIdle();
    loadLeaderboard('tetris');
  } else if (gameKey === 'diablo') {
    document.getElementById('current-game-title').textContent = '⚔️ ディアブロ I (Diablo Web)';
    document.getElementById('lb-title').textContent = '⚔️ 冒険者クラウド記録';
    controlsHint.innerHTML = '操作方法：画面内の <strong>Play Shareware</strong> をクリックして開始（マウス移動・攻撃 / 1〜8 スキル）';

    tetrisCanvas.classList.add('hidden');
    localStatsBar.classList.add('hidden');
    startGameBtn.classList.add('hidden');
    externalWrapper.classList.remove('hidden');
    cloudSavePanel.classList.remove('hidden');

    externalFrame.src = './diablo/index.html';
    checkCloudSaveStatus();
    loadDiabloRecords();
  }
}

// 3. ゲーム開始ボタン（テトリス）
startGameBtn.addEventListener('click', () => {
  if (activeGame === 'tetris') {
    document.getElementById('score-val').textContent = '0';
    window.ArcadeGames.tetris.start({
      onScoreUpdate(score) {
        document.getElementById('score-val').textContent = score;
      },
      async onGameOver(finalScore) {
        alert(`ゲームオーバー！最終スコア: ${finalScore}`);
        await submitScore('tetris', finalScore);
      }
    });
  }
});

// フルスクリーン切り替え
document.getElementById('fullscreen-btn').addEventListener('click', () => {
  const stage = document.querySelector('.stage-area');
  if (!document.fullscreenElement) {
    stage.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
});

// 4. Supabase Storage クラウドセーブ機能（ディアブロ .sv ファイル同期）
async function checkCloudSaveStatus() {
  const statusEl = document.getElementById('cloud-save-status');
  if (!currentUser) {
    statusEl.textContent = '※ ログインするとクラウド保存が利用できます';
    statusEl.style.color = '#facc15';
    return;
  }

  const { data, error } = await window.sbClient
    .from('game_saves')
    .select('updated_at, char_name')
    .eq('user_id', currentUser.id)
    .eq('game_name', 'diablo')
    .maybeSingle();

  if (data) {
    const timeStr = new Date(data.updated_at).toLocaleString('ja-JP');
    statusEl.textContent = `✅ 同期済み (${data.char_name} / ${timeStr})`;
    statusEl.style.color = '#4ade80';
  } else {
    statusEl.textContent = 'クラウドデータなし（未アップロード）';
    statusEl.style.color = '#94a3b8';
  }
}

document.getElementById('upload-save-btn').addEventListener('click', async () => {
  if (!currentUser) {
    alert('クラウド保存にはログインが必要です！');
    authModal.classList.remove('hidden');
    return;
  }
  const fileInput = document.getElementById('sv-file-input');
  const file = fileInput.files[0];
  if (!file) {
    alert('先にアップロードするセーブファイル（.sv）を選択してください。');
    return;
  }

  const statusEl = document.getElementById('cloud-save-status');
  statusEl.textContent = '⏳ アップロード中...';

  const filePath = `${currentUser.id}/${file.name}`;
  const { error: uploadError } = await window.sbClient.storage
    .from('save-files')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    statusEl.textContent = '❌ アップロード失敗: ' + uploadError.message;
    statusEl.style.color = '#ef4444';
    return;
  }

  // メタデータを game_saves テーブルにも記録
  await window.sbClient.from('game_saves').upsert({
    user_id: currentUser.id,
    game_name: 'diablo',
    char_name: file.name,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,game_name' });

  statusEl.textContent = `✅ クラウド保存完了 (${file.name})`;
  statusEl.style.color = '#4ade80';
  loadDiabloRecords();
});

document.getElementById('download-save-btn').addEventListener('click', async () => {
  if (!currentUser) {
    alert('クラウド復元にはログインが必要です！');
    authModal.classList.remove('hidden');
    return;
  }

  const { data: saveMeta } = await window.sbClient
    .from('game_saves')
    .select('char_name')
    .eq('user_id', currentUser.id)
    .eq('game_name', 'diablo')
    .maybeSingle();

  if (!saveMeta || !saveMeta.char_name) {
    alert('クラウド上に保存されたセーブファイルが見つかりません。');
    return;
  }

  const filePath = `${currentUser.id}/${saveMeta.char_name}`;
  const { data: blob, error } = await window.sbClient.storage
    .from('save-files')
    .download(filePath);

  if (error || !blob) {
    alert('ダウンロードに失敗しました: ' + (error ? error.message : ''));
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = saveMeta.char_name;
  a.click();
  URL.revokeObjectURL(url);
});

async function loadDiabloRecords() {
  const listEl = document.getElementById('leaderboard-list');
  listEl.innerHTML = '<li class="loading">クラウド記録を取得中...</li>';

  const { data } = await window.sbClient
    .from('game_saves')
    .select('char_name, updated_at')
    .eq('game_name', 'diablo')
    .order('updated_at', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) {
    listEl.innerHTML = '<li class="loading">まだクラウドセーブ記録がありません</li>';
    return;
  }

  listEl.innerHTML = data.map((row, idx) => {
    const dt = new Date(row.updated_at).toLocaleDateString('ja-JP');
    return `
      <li class="lb-row">
        <span><strong>#${idx + 1}</strong> ⚔️ ${row.char_name}</span>
        <span style="color:#38bdf8;">${dt}</span>
      </li>
    `;
  }).join('');
}

// 5. スコア送信＆ランキング取得（テトリス）
async function submitScore(game, score) {
  if (!currentUser || score <= 0) return;
  const username = currentUser.email.split('@')[0];

  if (game === 'tetris') {
    await window.sbClient.from('tetris_scores').insert({
      user_id: currentUser.id,
      username,
      score
    });
  }
  loadLeaderboard(game);
}

async function loadLeaderboard(game) {
  if (game === 'diablo') {
    loadDiabloRecords();
    return;
  }
  const listEl = document.getElementById('leaderboard-list');
  listEl.innerHTML = '<li class="loading">読み込み中...</li>';

  const { data, error } = await window.sbClient
    .from('tetris_scores')
    .select('username, score')
    .order('score', { ascending: false })
    .limit(10);

  if (error || !data || data.length === 0) {
    listEl.innerHTML = '<li class="loading">まだ記録がありません</li>';
    return;
  }

  listEl.innerHTML = data.map((row, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
    return `
      <li class="lb-row">
        <span><strong>${medal}</strong> ${row.username}</span>
        <span class="lb-score">${row.score}</span>
      </li>
    `;
  }).join('');

  if (currentUser) {
    const myName = currentUser.email.split('@')[0];
    const myScores = data.filter(d => d.username === myName).map(d => d.score);
    const best = myScores.length ? Math.max(...myScores) : 0;
    document.getElementById('best-val').textContent = best;
  }
}

document.getElementById('refresh-lb-btn').addEventListener('click', () => loadLeaderboard(activeGame));

// 6. 認証・セッション管理
document.getElementById('auth-toggle-btn').addEventListener('click', () => authModal.classList.remove('hidden'));
document.getElementById('close-modal').addEventListener('click', () => authModal.classList.add('hidden'));

document.getElementById('login-submit').addEventListener('click', async () => {
  const email = document.getElementById('email-input').value.trim();
  const password = document.getElementById('password-input').value;
  authMessage.textContent = '処理中...';
  const { error } = await window.sbClient.auth.signInWithPassword({ email, password });
  if (error) authMessage.textContent = 'エラー: ' + error.message;
  else {
    authModal.classList.add('hidden');
    checkSession();
  }
});

document.getElementById('signup-submit').addEventListener('click', async () => {
  const email = document.getElementById('email-input').value.trim();
  const password = document.getElementById('password-input').value;
  authMessage.textContent = '登録中...';
  const { error } = await window.sbClient.auth.signUp({ email, password });
  if (error) authMessage.textContent = 'エラー: ' + error.message;
  else authMessage.textContent = '登録完了！そのままログインしてください。';
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await window.sbClient.auth.signOut();
  checkSession();
});

async function checkSession() {
  const { data: { session } } = await window.sbClient.auth.getSession();
  currentUser = session ? session.user : null;

  const greeting = document.getElementById('user-greeting');
  const authBtn = document.getElementById('auth-toggle-btn');
  const logoutBtn = document.getElementById('logout-btn');

  if (currentUser) {
    greeting.textContent = `ようこそ、${currentUser.email.split('@')[0]} さん`;
    authBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
  } else {
    greeting.textContent = 'ゲストモード';
    authBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
  }
  loadLeaderboard(activeGame);
  if (activeGame === 'diablo') checkCloudSaveStatus();
}

async function refreshProfileStats() {
  const guestBox = document.getElementById('profile-guest-notice');
  const detailBox = document.getElementById('profile-details');

  if (!currentUser) {
    guestBox.classList.remove('hidden');
    detailBox.classList.add('hidden');
    return;
  }

  guestBox.classList.add('hidden');
  detailBox.classList.remove('hidden');
  document.getElementById('prof-email').textContent = currentUser.email;

  const { data: tData } = await window.sbClient
    .from('tetris_scores')
    .select('score')
    .eq('user_id', currentUser.id)
    .order('score', { ascending: false })
    .limit(1);

  const { data: sData } = await window.sbClient
    .from('game_saves')
    .select('char_name')
    .eq('user_id', currentUser.id)
    .eq('game_name', 'diablo')
    .maybeSingle();

  document.getElementById('prof-tetris-best').textContent = (tData && tData[0]) ? tData[0].score : 0;
  document.getElementById('prof-save-status').textContent = sData ? `保存済み (${sData.char_name})` : '未保存';
}

// 初期起動
controlsHint.innerHTML = window.ArcadeGames.tetris.controlsHint;
window.ArcadeGames.tetris.initIdle();
checkSession();