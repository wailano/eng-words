'use strict';

const AdminModule = (() => {

  function render() {
    const el = document.getElementById('page-admin');
    el.innerHTML = `
      <h2 style="margin-bottom:16px">⚙️ 관리자 패널</h2>

      <div class="card">
        <div class="card-title">사용자 승인</div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <input id="newEmail" type="email" class="input-field" placeholder="승인할 이메일 입력"
                 style="flex:1;padding:10px 12px;border:1px solid #CBD5E0;border-radius:8px;font-size:.95rem">
          <button class="btn btn-primary" onclick="AdminModule.approveEmail()">승인</button>
        </div>
        <div id="userList"><div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div></div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-title">단어 업로드 (CSV)</div>
        <p style="font-size:.85rem;color:var(--text-sub);margin-bottom:10px">
          형식: <code>영어,한글뜻,level(elementary/middle),type(word/idiom),day_group(숫자)</code><br>
          예: <code>apple,사과,elementary,word,1</code>
        </p>
        <textarea id="csvInput" rows="8"
          style="width:100%;padding:10px;border:1px solid #CBD5E0;border-radius:8px;
                 font-size:.85rem;font-family:monospace;box-sizing:border-box;resize:vertical"
          placeholder="한 줄에 단어 하나씩 입력..."></textarea>
        <div id="uploadStatus" style="margin-top:8px;font-size:.9rem"></div>
        <button class="btn btn-primary" style="margin-top:10px;width:100%" onclick="AdminModule.uploadCSV()">
          단어 업로드
        </button>
      </div>`;

    loadUsers();
  }

  async function loadUsers() {
    try {
      const users = await DB.users.list();
      if (!users.length) {
        document.getElementById('userList').innerHTML =
          `<div class="empty-state"><i class="fas fa-users"></i><p>승인된 사용자 없음</p></div>`;
        return;
      }
      document.getElementById('userList').innerHTML = users.map(u => `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 0;border-bottom:1px solid #EDF2F7">
          <span style="font-size:.9rem;word-break:break-all">${u.email}</span>
          ${u.email !== ADMIN_EMAIL
            ? `<button class="btn btn-ghost btn-sm" style="color:#E53E3E;border-color:#FC8181"
                onclick="AdminModule.revokeEmail('${u.email}')">취소</button>`
            : `<span class="badge badge-green">관리자</span>`}
        </div>`).join('');
    } catch(e) {
      document.getElementById('userList').innerHTML =
        `<div class="empty-state"><p>불러오기 실패: ${e.message}</p></div>`;
    }
  }

  async function approveEmail() {
    const emailEl = document.getElementById('newEmail');
    const email   = emailEl.value.trim();
    if (!email || !email.includes('@')) { showToast('올바른 이메일을 입력하세요'); return; }
    try {
      await DB.users.add(email);
      emailEl.value = '';
      showToast(`✅ ${email} 승인 완료`);
      loadUsers();
    } catch(e) {
      showToast('오류: ' + e.message);
    }
  }

  async function revokeEmail(email) {
    if (!confirm(`${email} 의 승인을 취소하시겠습니까?`)) return;
    try {
      await DB.users.revoke(email);
      showToast(`🚫 ${email} 승인 취소`);
      loadUsers();
    } catch(e) {
      showToast('오류: ' + e.message);
    }
  }

  async function uploadCSV() {
    const raw = document.getElementById('csvInput').value.trim();
    if (!raw) { showToast('내용을 입력하세요'); return; }

    const CHOSUNG = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
    const getCs = txt => [...txt].map(ch => {
      const c = ch.charCodeAt(0);
      return (c >= 0xAC00 && c <= 0xD7A3) ? CHOSUNG[(c - 0xAC00) / 588 | 0] : '';
    }).join('');
    const makeHint = ko => `초성: ${getCs(ko)}  (${[...ko].length}글자)`;

    const lines  = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const errors = [];
    const items  = [];

    lines.forEach((line, i) => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 5) { errors.push(`줄 ${i+1}: 필드 부족`); return; }
      const [word_en, word_ko, level, type, dayStr] = parts;
      const day_group = parseInt(dayStr);
      if (!word_en || !word_ko) { errors.push(`줄 ${i+1}: 빈 값`); return; }
      if (!['elementary','middle'].includes(level)) { errors.push(`줄 ${i+1}: level 오류`); return; }
      if (!['word','idiom'].includes(type)) { errors.push(`줄 ${i+1}: type 오류`); return; }
      if (isNaN(day_group) || day_group < 1) { errors.push(`줄 ${i+1}: day_group 오류`); return; }
      items.push({ word_en, word_ko, level, type, day_group, hint_ko: makeHint(word_ko) });
    });

    const statusEl = document.getElementById('uploadStatus');

    if (errors.length) {
      statusEl.innerHTML = `<span style="color:#E53E3E">오류:<br>${errors.join('<br>')}</span>`;
      return;
    }

    statusEl.textContent = '업로드 중...';
    try {
      const _db = firebase.firestore();
      const CHUNK = 450;
      for (let i = 0; i < items.length; i += CHUNK) {
        const batch = _db.batch();
        items.slice(i, i + CHUNK).forEach(item =>
          batch.set(_db.collection('word_library').doc(), item)
        );
        await batch.commit();
      }
      document.getElementById('csvInput').value = '';
      statusEl.innerHTML = `<span style="color:#38A169">✅ ${items.length}개 단어 업로드 완료!</span>`;
      showToast(`${items.length}개 업로드 완료`);
    } catch(e) {
      statusEl.innerHTML = `<span style="color:#E53E3E">❌ 업로드 실패: ${e.message}</span>`;
    }
  }

  return { render, approveEmail, revokeEmail, uploadCSV };
})();
