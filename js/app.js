// ==========================================
// 1. Supabase ＆ 外部カレンダーアプリ連携設定
// ==========================================
const SUPABASE_URL = 'https://tijekdtlvaukoftmwmip.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gSiLVFW65_xnHw_u1Hv-TQ_1tF-orL0';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEFAULT_CALENDAR_APP_URL = 'https://example.com/calendar-app';

// 全タイトル一覧
const GAME_KEYS = ['tetris', 'dino', 'kof2002', 'wof', 'nbbatman', 'mslugx'];

// クラシック基板アーケード設定（FBNeoエミュレータ経由）
// ※ 各自のプライベートストレージ等にROM直链がある場合は romUrl に指定すると自動起動します
const ARCADE_ROMS = {
  dino: {
    title: '🦖 恐龍快打 (Cadillacs and Dinosaurs)',
    rankTitle: '🏆 恐龍快打 実績ランキング',
    romHint: 'dino.zip (CPS1 / 約4MB)',
    romUrl: '',
    controlsHint: '対応ROM：<strong>dino.zip</strong> ｜ 画面内のボタンからROMファイルを選択（または設定済み直リンクで自動起動）'
  },
  kof2002: {
    title: '🔥 拳皇2002 風雲再起 (KOF 2002)',
    rankTitle: '🏆 拳皇2002 実績ランキング',
    romHint: 'kof2002.zip (NeoGeo / 約35MB)',
    romUrl: '',
    controlsHint: '対応ROM：<strong>kof2002.zip</strong> ｜ NeoGeo BIOS不要の統合ROMまたは neogeo.zip 同梱版に対応'
  },
  wof: {
    title: '⚔️ 三国志 赤壁の戦い (Warriors of Fate)',
    rankTitle: '🏆 三国志 実績ランキング',
    romHint: 'wof.zip (CPS1 / 約5MB)',
    romUrl: '',
    controlsHint: '対応ROM：<strong>wof.zip</strong> ｜ CPS1基板名作アクション！Shiftでコイン投入、Enterでスタート'
  },
  nbbatman: {
    title: '⚾ 野球小子 (Ninja Baseball Bat Man)',
    rankTitle: '🏆 野球小子 実績ランキング',
    romHint: 'nbbatman.zip (Irem M92 / 約5MB)',
    romUrl: '',
    controlsHint: '対応ROM：<strong>nbbatman.zip</strong> ｜ 4人の忍者バッターから選んで戦う爽快ベルトスクロール！'
  },
  mslugx: {
    title: '🔫 メタルスラッグ X (Metal Slug X)',
    rankTitle: '🏆 メタルスラッグX 実績ランキング',
    romHint: 'mslugx.zip (NeoGeo / 約26MB)',
    romUrl: '',
    controlsHint: '対応ROM：<strong>mslugx.zip</strong> ｜ 横スクロールアクションの金字塔！フルスクリーンでのプレイ推奨'
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
// 3. ナビゲーション＆ゲーム切り替え
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

function buildEmuUrl(arc) {
  const url = new URL('./arcade-emu.html', window.location.href);
  url.searchParams.set('title', arc.title);
  url.searchParams.set('hint', arc.romHint);
  if (arc.romUrl) url.searchParams.set('rom', arc.romUrl);
  return url.toString();
}

function selectGame(gameKey) {
  stopAllGames();
  activeGame = gameKey;
  switchTopTab('games');

  GAME_KEYS.forEach(g => {
    const menuEl = document.getElementById(`menu-${g}`);
    if (menuEl) menuEl.classList.toggle('active', g === gameKey);
  });

  const isArcade = Boolean(ARCADE_ROMS[gameKey]);
  const tetrisCanvas = document.getElementById('tetris-canvas');
  const extWrapper = document.getElementById('external-frame-wrapper');
  const extFrame = document.getElementById('external-game-frame');
  const localStats = document.getElementById('local-stats-bar');
  const extStats = document.getElementById('external-stats-bar');
  const startBtn = document.getElementById('start-btn');
  const fsBtn = document.getElementById('fullscreen-btn');

  if (!isArcade) {
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
    const arc = ARCADE_ROMS[gameKey];
    tetrisCanvas.classList.add('hidden');
    extWrapper.classList.remove('hidden');
    localStats.classList.add('hidden');
    extStats.classList.remove('hidden');
    fsBtn.classList.remove('hidden');
    startBtn.textContent = 'エミュレータ再読込';

    document.getElementById('current-game-title').textContent = arc.title;
    document.getElementById('rank-title').textContent = arc.rankTitle;
    document.getElementById('controls-hint').innerHTML = arc.controlsHint;
    extFrame.src = buildEmuUrl(arc);
  }

  loadLeaderboard();
}

function startCurrentGame() {
  if (ARCADE_ROMS[activeGame]) {
    const extFrame = document.getElementById('external-game-frame');
    extFrame.src = buildEmuUrl(ARCADE_ROMS[activeGame]);
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
  if (!ARCADE_ROMS[activeGame] || !currentUser) return;
  const { data: myData } = await supabaseClient
    .from('tetris_scores')
    .select('score')
    .eq('user_id', currentUser.id)
    .eq('game_name', activeGame)
    .order('score', { ascending: false })
    .limit(1);

  const prevScore = (myData && myData.length > 0) ? myData[0].score : 0;
  const newTotal = prevScore + 100;
  await saveScoreToCloud(activeGame, newTotal);
  alert(`${ARCADE_ROMS[activeGame].title} のプレイ実績 (+100pt) を記録しました！（現在累計: ${newTotal} pt）`);
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
    if (ARCADE_ROMS[activeGame]) {
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