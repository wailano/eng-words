'use strict';

/* ════════════════════════════════════════════
   앱 초기화 & 네비게이션
════════════════════════════════════════════ */
let _db, _auth, _currentUser = null;

window.addEventListener('DOMContentLoaded', () => {
  firebase.initializeApp(FIREBASE_CONFIG);
  _db   = firebase.firestore();
  _auth = firebase.auth();
  DB.init(_db);

  _auth.onAuthStateChanged(async user => {
    if (!user) { showScreen('login'); return; }
    const approved = await DB.users.isApproved(user.email);
    if (!approved) { showPending(user); return; }
    _currentUser = user;
    await DB.users.ensureAdmin();
    await DB.words.seedIfEmpty();
    initApp(user);
    navigate('dashboard');
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

  if (page === 'dashboard') DashboardModule.render(_currentUser.email);
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
