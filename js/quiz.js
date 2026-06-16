'use strict';

const QuizModule = (() => {
  const TOTAL = 30;
  let _words = [], _qList = [], _current = 0;
  let _score = 0, _wrongs = [];
  let _level = 'elementary', _type = 'all', _hintOn = false, _dir = 'en_to_ko';
  let _answered = false;

  function render() {
    const el = document.getElementById('page-quiz');
    el.innerHTML = `
      <h2 style="margin-bottom:16px">📝 테스트 모드</h2>
      <div class="filter-bar">
        <select id="qlv" onchange="QuizModule.onFilter()">
          <option value="elementary">초등</option>
          <option value="middle">중등</option>
        </select>
        <select id="qt" onchange="QuizModule.onFilter()">
          <option value="all">전체</option>
          <option value="word">단어</option>
          <option value="idiom">숙어</option>
        </select>
        <select id="qdir" onchange="QuizModule.onFilter()">
          <option value="en_to_ko">영→한</option>
          <option value="ko_to_en">한→영</option>
        </select>
        <label style="display:flex;align-items:center;gap:6px;font-size:.9rem;white-space:nowrap;">
          <input type="checkbox" id="qhint" onchange="QuizModule.onFilter()"> 힌트
        </label>
        <button class="btn btn-primary" style="white-space:nowrap" onclick="QuizModule.startQuiz()">시작</button>
      </div>
      <div id="quizArea">
        <div class="empty-state">
          <i class="fas fa-pencil-alt"></i>
          <p>설정 후 <b>시작</b>을 누르세요.<br>${TOTAL}문제 랜덤 출제</p>
        </div>
      </div>`;

    document.getElementById('qlv').value  = _level;
    document.getElementById('qt').value   = _type;
    document.getElementById('qdir').value = _dir;
    document.getElementById('qhint').checked = _hintOn;
  }

  function onFilter() {
    _level  = document.getElementById('qlv').value;
    _type   = document.getElementById('qt').value;
    _dir    = document.getElementById('qdir').value;
    _hintOn = document.getElementById('qhint').checked;
  }

  async function startQuiz() {
    onFilter();
    document.getElementById('quizArea').innerHTML =
      `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>단어 불러오는 중...</p></div>`;

    const maxDay = await DB.words.getMaxDay(_level);
    let allWords = [];
    for (let d = 1; d <= maxDay; d++) {
      const ws = await DB.words.getByDay(_level, d, _type);
      allWords = allWords.concat(ws);
    }

    if (allWords.length < 5) {
      document.getElementById('quizArea').innerHTML =
        `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>단어가 부족합니다. (최소 5개 필요)</p></div>`;
      return;
    }

    _words = shuffle(allWords);
    _qList = _words.slice(0, Math.min(TOTAL, _words.length));
    _current = 0; _score = 0; _wrongs = [];
    renderQuestion();
  }

  function renderQuestion() {
    if (_current >= _qList.length) { renderResult(); return; }

    const w   = _qList[_current];
    const pct = Math.round(_current / _qList.length * 100);
    _answered = false;

    const isEnToKo = _dir === 'en_to_ko';
    const question  = isEnToKo ? w.word_en : w.word_ko;
    const qLang     = isEnToKo ? '영어' : '한글';
    const choiceLbl = isEnToKo ? '한글 뜻을 고르세요' : '영어 단어를 고르세요';
    const bg        = isEnToKo ? '#EBF8FF' : '#FFF0F8';

    // 힌트: 영→한이면 초성힌트, 한→영이면 영어 첫 글자+길이
    const hintText = isEnToKo
      ? (w.hint_ko || '')
      : `영어 ${w.word_en.length}글자, '${w.word_en[0]}'로 시작`;

    const choicePool = shuffle(_words.filter(x => x.id !== w.id)).slice(0, 3);
    const choices    = shuffle([w, ...choicePool]);

    document.getElementById('quizArea').innerHTML = `
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="progress-label">${_current+1} / ${_qList.length} &nbsp;|&nbsp; 점수: ${_score}</div>

      <div class="flashcard" style="background:${bg};cursor:default">
        <div class="lang-label">${qLang}</div>
        <div class="word">${question}</div>
        ${isEnToKo ? `<div style="margin-top:8px"><button class="btn btn-ghost btn-sm" onclick="speak('${w.word_en.replace(/'/g,"\\'")}')">🔊</button></div>` : ''}
        ${_hintOn && hintText ? `<div class="hint-box" style="margin-top:12px">💡 ${hintText}</div>` : ''}
      </div>

      <div style="margin-top:16px">
        <p style="font-weight:600;margin-bottom:10px;color:var(--text-sub)">${choiceLbl}</p>
        <div class="choices" id="choices">
          ${choices.map((c,i) => `
            <button class="choice-btn" id="choice-${i}"
              onclick="QuizModule.checkAnswer('${c.id}','${w.id}',${i})">
              ${isEnToKo ? c.word_ko : c.word_en}
            </button>`).join('')}
        </div>
      </div>

      <div id="qFeedback"></div>
      <div id="qNextWrap"></div>`;

    if (isEnToKo) speak(w.word_en);
  }

  function checkAnswer(selectedId, correctId, btnIdx) {
    if (_answered) return;
    _answered = true;

    const correct   = selectedId === correctId;
    const w         = _qList[_current];
    const isEnToKo  = _dir === 'en_to_ko';
    const correctAns = isEnToKo ? w.word_ko : w.word_en;

    if (correct) _score++;
    else         _wrongs.push(w);

    document.querySelectorAll('.choice-btn').forEach((btn, i) => {
      btn.disabled = true;
      if (btn.id === `choice-${btnIdx}`) btn.classList.add(correct ? 'correct' : 'wrong');
    });

    document.getElementById('qFeedback').innerHTML =
      `<div class="answer-box" style="background:${correct?'#C6F6D5':'#FED7D7'};color:#2D3748;margin-top:12px">
        ${correct ? '✅ 정답!' : `❌ 오답 — 정답: <b>${correctAns}</b>`}
      </div>`;

    document.getElementById('qNextWrap').innerHTML =
      `<div style="margin-top:12px;text-align:center">
        <button class="btn btn-primary" onclick="QuizModule.nextQuestion()">
          ${_current+1 < _qList.length ? '다음 문제 ➡' : '결과 보기 📊'}
        </button>
      </div>`;
  }

  function nextQuestion() { _current++; renderQuestion(); }

  async function renderResult() {
    const pct      = Math.round(_score / _qList.length * 100);
    const dirLabel = _dir === 'en_to_ko' ? '영→한' : '한→영';

    document.getElementById('quizArea').innerHTML = `
      <div class="card" style="text-align:center">
        <div style="font-size:3rem;margin-bottom:8px">${pct>=80?'🎉':pct>=60?'👍':'💪'}</div>
        <h2>${_score} / ${_qList.length}</h2>
        <p style="font-size:1.1rem;color:var(--text-sub);margin:4px 0">${pct}점</p>
        <p style="color:var(--text-sub);font-size:.9rem">
          ${_level==='elementary'?'초등':'중등'} · ${_type==='all'?'전체':_type==='word'?'단어':'숙어'} · ${dirLabel}
        </p>
        <div id="saveStatus" style="margin:12px 0;color:var(--primary)"></div>
        <button class="btn btn-primary" style="margin-top:8px" onclick="QuizModule.startQuiz()">다시 시험</button>
      </div>
      ${_wrongs.length ? `
        <div class="card" style="margin-top:16px">
          <div class="card-title">틀린 단어 (${_wrongs.length}개)</div>
          ${_wrongs.map(w => `
            <div style="display:flex;justify-content:space-between;align-items:center;
                        padding:9px 0;border-bottom:1px solid #EDF2F7">
              <div>
                <b>${w.word_en}</b>
                <span style="font-size:.85rem;color:var(--text-sub);margin-left:8px">${w.word_ko}</span>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="speak('${w.word_en.replace(/'/g,"\\'")}')">🔊</button>
            </div>`).join('')}
        </div>` : ''}`;

    const email = typeof _currentUser !== 'undefined' && _currentUser ? _currentUser.email : null;
    if (email) {
      try {
        await DB.scores.save(email, _level, _score);
        document.getElementById('saveStatus').textContent = '✅ 성적이 저장되었습니다';
      } catch(e) {
        document.getElementById('saveStatus').textContent = '⚠️ 저장 실패: ' + e.message;
      }
    }
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length-1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i+1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return { render, onFilter, startQuiz, checkAnswer, nextQuestion };
})();
