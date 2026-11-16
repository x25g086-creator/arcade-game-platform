// ==========================================
// 1. Supabase ＆ 外部カレンダーアプリ連携設定
// ==========================================
const SUPABASE_URL = 'https://tijekdtlvaukoftmwmip.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gSiLVFW65_xnHw_u1Hv-TQ_1tF-orL0';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 【チーム連携用インターフェース設定】
const DEFAULT_CALENDAR_APP_URL = 'https://example.com/calendar-app';

// 全タイトル一覧（ローカルCanvas + 外部OSS大作）
const GAME_KEYS = ['tetris', 'mindustry', 'browserquest', 'cnc'];

// 外部オープンソースWebゲーム設定
// ※ 各自のGitHubリポジトリにビルド済みを配置した場合は './games_external/xxx/index.html' に変更可能
const EXTERNAL_GAMES = {
  mindustry: {
    title: '🏭 Mindustry (工場建設・タワーディフェンス)',
    rankTitle: '🏆 Mindustry 実績ランキング',
    url: 'https://mindustrygame.github.io/',
    controlsHint: 'オープンソースOSS（GPL-3.0）：マウス操作でドリル・コンベア・砲塔を配置し基地を防衛しよう！'
  },
  browserquest: {
    title: '⚔️ BrowserQuest (Mozilla マルチプレイRPG)',
    rankTitle: '🏆 BrowserQuest 実績ランキング',
    url: 'https://browserquest.herokuapp.com/',
    controlsHint: 'オープンソースOSS（MPL-2.0）：クリックで移動・攻撃。装備を集めて魔王を倒そう！'
  },
  cnc: {
    title: '🎖️ Command & Conquer HTML5 (リアルタイム戦略)',
    rankTitle: '🏆 C&C RTS 実績ランキング',
    url: 'https://www.adityaravishankar.com/projects/games/command-and-conquer/',
    controlsHint: 'オープンソースOSS（MIT）：基地を建設し戦車部隊を生産して敵軍を制圧しよう！'
  }
};

let currentUser = null;
let activeGame = 'tetris';

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('return_url')) {
  sessionStorage.setItem('calendar_return_url', urlParams.get('return_url'));
}

function jumpToCalendarApp() {
  stopAllGames();
  const targetBaseUrl = sessionStorage.getItem('calendar_return_url') || DEFAULT_CALENDAR_APP_URL;

  if (targetBaseUrl === 'https://example.com/calendar-app') {
    alert(
      '【カレンダー連携インターフェース（開発待機中）】\n\n' +
      'チームのカレンダーWebアプリのURLがまだ未設定です。\n' +
      '完成後、js/app.js の DEFAULT_CALENDAR_APP_URL を書き換えるか、\n' +
      'カレンダー側から ?return_url=カレンダーURL 付きで遷移すると自動で戻れます。'
    );
    return;
  }

  const targetUrl = new URL(targetBaseUrl);
  targetUrl.searchParams.set('from', 'arcade_platform');
  if (currentUser) {
    targetUrl.searchParams.set('user_email', currentUser.email);
  }
  window.location.href = targetUrl.toString();
}

// ==========================================
// 2. ユーザー認証ロジック
// ==========================================
async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    showPlatform();
  }
}

async function handleSignUp() {
  const email = document.getElementById('email-input').value.trim();
  const password = document.getElementById('password-input').value.trim();
  const username = document.getElementById('username-input').value.trim() || email.split('@')[0];
  const msgEl = document.getElementById('auth-msg');

  if (!email || password.length < 6) {
    msgEl.textContent = '有効なメールアドレスと6文字以上のパスワードを入力してください。';
    return;
  }
  msgEl.textContent = 'アカウントを作成中...';
  const { data, error } = await supabaseClient.auth.signUp({
    email, password, options: { data: { display_name: username } }
  });
  if (error) msgEl.textContent = '登録エラー: ' + error.message;
  else { currentUser = data.user; showPlatform(); }
}

async function handleLogin() {
  const email = document.getElementById('email-input').value.trim();
  const password = document.getElementById('password-input').value.trim();
  const msgEl = document.getElementById('auth-msg');
  msgEl.textContent = 'ログイン中...';
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) msgEl.textContent = 'ログインエラー: ' + error.message;
  else { currentUser = data.user; showPlatform(); }
}

async function handleLogout() {
  stopAllGames();
  await supabaseClient.auth.signOut();
  currentUser = null;
  document.getElementById('auth-view').classList.remove('hidden');
  document.getElementById('platform-view').classList.add('hidden');
  document.getElementById('user-bar').classList.add('hidden');
  document.getElementById('top-nav-links').classList.add('hidden');
}

function showPlatform() {
  const displayName = currentUser.user_metadata?.display_name || currentUser.email;
  document.getElementById('user-display').textContent = `ようこそ、${displayName} さん`;
  document.getElementById('profile-email').textContent = `メールアドレス：${currentUser.email} ｜ プレイヤー名：${displayName}`;
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('platform-view').classList.remove('hidden');
  document.getElementById('user-bar').classList.remove('hidden');
  document.getElementById('top-nav-links').classList.remove('hidden');
  selectGame('tetris');
}

// ==========================================
// 3. ナビゲーション＆ゲーム切り替え（Canvas / Iframe 両対応）
// ==========================================
function switchTopTab(tab) {
  ['games', 'profile', 'about'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== tab);
    document.getElementById(`nav-${t}`).classList.toggle('active', t === tab);
  });
  if (tab === 'profile') loadProfileStats();
}

function stopAllGames() {
  Object.values(window.ArcadeGames).forEach(gameModule => {
    if (gameModule && typeof gameModule.stop === 'function') {
      gameModule.stop();
    }
  });
  const frame = document.getElementById('external-game-frame');
  if (frame) frame.src = 'about:blank';
}

function selectGame(gameKey) {
  stopAllGames();
  activeGame = gameKey;
  switchTopTab('games');

  GAME_KEYS.forEach(g => {
    const menuEl = document.getElementById(`menu-${g}`);
    if (menuEl) menuEl.classList.toggle('active', g === gameKey);
  });

  const isExternal = Boolean(EXTERNAL_GAMES[gameKey]);
  const tetrisCanvas = document.getElementById('tetris-canvas');
  const extWrapper = document.getElementById('external-frame-wrapper');
  const extFrame = document.getElementById('external-game-frame');
  const localStats = document.getElementById('local-stats-bar');
  const extStats = document.getElementById('external-stats-bar');
  const startBtn = document.getElementById('start-btn');
  const fsBtn = document.getElementById('fullscreen-btn');

  if (!isExternal) {
    // ローカルCanvasゲーム（テトリス）
    tetrisCanvas.classList.remove('hidden');
    extWrapper.classList.add('hidden');
    localStats.classList.remove('hidden');
    extStats.classList.add('hidden');
    fsBtn.classList.add('hidden');
    startBtn.textContent = 'ゲーム開始';
    document.getElementById('score-val').textContent = '0';

    const module = window.ArcadeGames[gameKey];
    if (module) {
      document.getElementById('current-game-title').textContent = module.title;
      document.getElementById('rank-title').textContent = module.rankTitle;
      document.getElementById('controls-hint').innerHTML = module.controlsHint;
      if (typeof module.initIdle === 'function') module.initIdle();
    }
  } else {
    // 外部オープンソース大作（Iframe内嵌・ページ遷移なし）
    const ext = EXTERNAL_GAMES[gameKey];
    tetrisCanvas.classList.add('hidden');
    extWrapper.classList.remove('hidden');
    localStats.classList.add('hidden');
    extStats.classList.remove('hidden');
    fsBtn.classList.remove('hidden');
    startBtn.textContent = 'ゲーム再読込';

    document.getElementById('current-game-title').textContent = ext.title;
    document.getElementById('rank-title').textContent = ext.rankTitle;
    document.getElementById('controls-hint').innerHTML = ext.controlsHint;
    extFrame.src = ext.url;
  }

  loadLeaderboard();
}

function startCurrentGame() {
  if (EXTERNAL_GAMES[activeGame]) {
    const extFrame = document.getElementById('external-game-frame');
    extFrame.src = EXTERNAL_GAMES[activeGame].url;
    return;
  }

  stopAllGames();
  document.getElementById('score-val').textContent = '0';
  document.getElementById('start-btn').textContent = 'リスタート';

  const module = window.ArcadeGames[activeGame];
  if (module && typeof module.start === 'function') {
    module.start({
      onScoreUpdate: (newScore) => {
        document.getElementById('score-val').textContent = newScore;
      },
      onGameOver: (finalScore) => {
        document.getElementById('start-btn').textContent = 'もう一度プレイ';
        setTimeout(() => {
          alert(`ゲームオーバー！スコア: ${finalScore} 点`);
          saveScoreToCloud(activeGame, finalScore);
        }, 30);
      }
    });
  }
}

function toggleExternalFullscreen() {
  const wrapper = document.getElementById('external-frame-wrapper');
  if (wrapper && wrapper.requestFullscreen) {
    wrapper.requestFullscreen();
  }
}

async function recordExternalPlay() {
  if (!EXTERNAL_GAMES[activeGame]) return;
  await saveScoreToCloud(activeGame, 100);
  alert(`${EXTERNAL_GAMES[activeGame].title} のプレイ実績（+100pt）をクラウドに記録しました！`);
}

// ==========================================
// 4. クラウドスコア保存 & ランキング取得
// ==========================================
async function saveScoreToCloud(gameName, finalScore) {
  if (!currentUser || finalScore <= 0) return;
  const displayName = currentUser.user_metadata?.display_name || currentUser.email.split('@')[0];

  const { error } = await supabaseClient
    .from('tetris_scores')
    .insert([{
      user_id: currentUser.id,
      username: displayName,
      score: finalScore,
      game_name: gameName
    }]);

  if (!error) loadLeaderboard();
}

async function loadLeaderboard() {
  const listEl = document.getElementById('rank-list');
  const { data, error } = await supabaseClient
    .from('tetris_scores')
    .select('username, score')
    .eq('game_name', activeGame)
    .order('score', { ascending: false })
    .limit(10);

  if (error) {
    listEl.innerHTML = `<li class="rank-item">読み込みエラー</li>`;
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = `<li class="rank-item" style="color:var(--muted);">まだ記録がありません</li>`;
  } else {
    listEl.innerHTML = data.map((row, idx) => `
      <li class="rank-item">
        <span>#${idx + 1} ${escapeHtml(row.username)}</span>
        <strong>${row.score} 点</strong>
      </li>
    `).join('');
  }

  if (currentUser) {
    const { data: myData } = await supabaseClient
      .from('tetris_scores')
      .select('score')
      .eq('user_id', currentUser.id)
      .eq('game_name', activeGame)
      .order('score', { ascending: false })
      .limit(1);

    const best = (myData && myData.length > 0) ? myData[0].score : 0;
    if (EXTERNAL_GAMES[activeGame]) {
      document.getElementById('ext-play-count').textContent = `${best} pt`;
    } else {
      document.getElementById('best-val').textContent = best;
    }
  }
}

async function loadProfileStats() {
  if (!currentUser) return;
  for (const g of GAME_KEYS) {
    const { data } = await supabaseClient
      .from('tetris_scores')
      .select('score')
      .eq('user_id', currentUser.id)
      .eq('game_name', g)
      .order('score', { ascending: false })
      .limit(1);
    const best = (data && data.length > 0) ? data[0].score : 0;
    const el = document.getElementById(`profile-${g}-best`);
    if (el) el.textContent = `${best} 点`;
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

checkSession();