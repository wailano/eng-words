'use strict';

/* ════════════════════════════════════════════
   앱 초기화 & 네비게이션
════════════════════════════════════════════ */
let _db, _auth, _currentUser = null;

function isInAppBrowser() {
  const ua = navigator.userAgent;
  return /KAKAOTALK|NAVER|Line|Instagram|FB_IAB|FBAN|Twitter|Weibo|MicroMessenger/i.test(ua);
}

window.addEventListener('DOMContentLoaded', () => {
  // 인앱 브라우저 감지
  if (isInAppBrowser()) {
    document.getElementById('loginStatus').textContent = '';
    document.getElementById('loginError').textContent =
      '⚠️ 인앱 브라우저에서는 로그인이 안 됩니다.\nChrome 앱을 직접 열고 주소창에\nwailano.github.io/eng-words\n를 입력해주세요.';
    return;
  }

  firebase.initializeApp(FIREBASE_CONFIG);
  _db   = firebase.firestore();
  _auth = firebase.auth();
  DB.init(_db);

  _auth.onAuthStateChanged(async user => {
    if (!user) { showScreen('login'); return; }
    try {
      const approved = await DB.users.isApproved(user.email);
      if (!approved) { showPending(user); return; }
      _currentUser = user;
      DB.users.ensureAdmin().catch(e => console.warn('ensureAdmin:', e));
      DB.words.seedIfEmpty().catch(e => console.warn('seedIfEmpty:', e));
      initApp(user);
      navigate('dashboard');
    } catch(e) {
      showScreen('login');
      document.getElementById('loginError').textContent = '오류: ' + e.message;
    }
  });

  document.getElementById('googleBtn').addEventListener('click', doLogin);
  document.getElementById('logoutBtn').addEventListener('click', doLogout);
  document.getElementById('pendingLogout').addEventListener('click', doLogout);
});

async function doLogin() {
  const provider = new firebase.auth.GoogleAuthProvider();
  document.getElementById('loginStatus').textContent = '로그인 중...';
  document.getElementById('loginError').textContent  = '';
  try {
    await _auth.signInWithPopup(provider);
  } catch(e) {
    document.getElementById('loginStatus').textContent = '';
    document.getElementById('loginError').textContent  = e.message;
  }
}

function doLogout() {
  _auth.signOut();
}

function showScreen(name) {
  ['loginScreen','pendingScreen','appScreen'].forEach(id => {
    document.getElementById(id).classList.toggle('hidden', id !== name + 'Screen');
  });
}

function showPending(user) {
  document.getElementById('pendingEmail').textContent = user.email;
  showScreen('pending');
}

function initApp(user) {
  document.getElementById('headerEmail').textContent = user.email;
  if (user.email === ADMIN_EMAIL) {
    document.querySelector('.admin-tab').style.display = '';
  }
  showScreen('app');
}

/* ── 탭 네비 ── */
function navigate(page) {
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page)
  );
  document.querySelectorAll('.page').forEach(el =>
    el.classList.toggle('hidden', el.id !== 'page-' + page)
  );

  if (page === 'dashboard') DashboardModule.render(_currentUser.email, _currentUser.email === ADMIN_EMAIL);
  if (page === 'learning')  LearningModule.render();
  if (page === 'quiz')      QuizModule.render();
  if (page === 'admin' && _currentUser.email === ADMIN_EMAIL) AdminModule.render();
}

/* ── 토스트 ── */
function showToast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

/* ── TTS ── */
function speak(word) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US'; u.rate = 0.85;
  window.speechSynthesis.speak(u);
}
