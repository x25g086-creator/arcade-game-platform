let currentUser = null;

const lobbyView = document.getElementById('view-lobby');
const profileView = document.getElementById('view-profile');
const aboutView = document.getElementById('view-about');
const authView = document.getElementById('auth-view');
const navBtns = document.querySelectorAll('.nav-btn[data-view]');
const authMessage = document.getElementById('auth-message');

// 1. 独立视图切换（大厅 / 独立登录页 / 个人中心 / 系统概要）
function switchView(viewName) {
  lobbyView.classList.toggle('hidden', viewName !== 'lobby');
  profileView.classList.toggle('hidden', viewName !== 'profile');
  aboutView.classList.toggle('hidden', viewName !== 'about');
  authView.classList.toggle('hidden', viewName !== 'auth');

  navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  if (viewName === 'profile') refreshProfileStats();
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// 2. 登录 / 注册页面切换与 Supabase 认证
document.getElementById('auth-toggle-btn').addEventListener('click', () => {
  authMessage.textContent = '';
  switchView('auth');
});

document.getElementById('close-auth-btn').addEventListener('click', () => {
  switchView('lobby');
});

document.getElementById('login-submit').addEventListener('click', async () => {
  const email = document.getElementById('email-input').value.trim();
  const password = document.getElementById('password-input').value;
  if (!email || !password) {
    authMessage.textContent = 'メールアドレスとパスワードを入力してください。';
    return;
  }
  authMessage.textContent = 'ログイン中...';
  const { error } = await window.sbClient.auth.signInWithPassword({ email, password });
  if (error) {
    authMessage.textContent = 'ログイン失敗: ' + error.message;
  } else {
    switchView('lobby');
    checkSession();
  }
});

document.getElementById('signup-submit').addEventListener('click', async () => {
  const email = document.getElementById('email-input').value.trim();
  const password = document.getElementById('password-input').value;
  if (!email || password.length < 6) {
    authMessage.textContent = '有効なメールアドレスと6文字以上のパスワードを入力してください。';
    return;
  }
  authMessage.textContent = '新規登録中...';
  const { error } = await window.sbClient.auth.signUp({ email, password });
  if (error) {
    authMessage.textContent = '登録失敗: ' + error.message;
  } else {
    authMessage.textContent = '登録完了！そのまま「ログイン」を押してください。';
  }
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
  loadLeaderboard();
}

// 3. 俄罗斯方块控制与分数提交
document.getElementById('start-game-btn').addEventListener('click', () => {
  document.getElementById('score-val').textContent = '0';
  window.ArcadeGames.tetris.start({
    onScoreUpdate(score) {
      document.getElementById('score-val').textContent = score;
    },
    async onGameOver(finalScore) {
      alert(`ゲームオーバー！最終スコア: ${finalScore}`);
      if (currentUser && finalScore > 0) {
        await window.sbClient.from('tetris_scores').insert({
          user_id: currentUser.id,
          username: currentUser.email.split('@')[0],
          score: finalScore
        });
        loadLeaderboard();
      }
    }
  });
});

document.getElementById('fullscreen-btn').addEventListener('click', () => {
  const stage = document.querySelector('.game-stage');
  if (!document.fullscreenElement) stage.requestFullscreen().catch(() => {});
  else document.exitFullscreen();
});

// 4. 全服排行榜与个人战绩
async function loadLeaderboard() {
  const listEl = document.getElementById('leaderboard-list');
  listEl.innerHTML = '<li class="rank-item"><span>読み込み中...</span></li>';

  const { data, error } = await window.sbClient
    .from('tetris_scores')
    .select('username, score')
    .order('score', { ascending: false })
    .limit(10);

  if (error || !data || data.length === 0) {
    listEl.innerHTML = '<li class="rank-item"><span>まだ記録がありません</span></li>';
    return;
  }

  listEl.innerHTML = data.map((row, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
    return `
      <li class="rank-item">
        <span>${medal} ${row.username}</span>
        <strong>${row.score}</strong>
      </li>
    `;
  }).join('');

  if (currentUser) {
    const myName = currentUser.email.split('@')[0];
    const myScores = data.filter(d => d.username === myName).map(d => d.score);
    document.getElementById('best-val').textContent = myScores.length ? Math.max(...myScores) : 0;
  }
}

document.getElementById('refresh-lb-btn').addEventListener('click', loadLeaderboard);

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

  const { data } = await window.sbClient
    .from('tetris_scores')
    .select('score')
    .eq('user_id', currentUser.id)
    .order('score', { ascending: false })
    .limit(1);

  document.getElementById('prof-tetris-best').textContent = (data && data[0]) ? data[0].score : 0;
}

// 启动初始化
window.ArcadeGames.tetris.initIdle();
checkSession();