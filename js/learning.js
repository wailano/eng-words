'use strict';

const LearningModule = (() => {
  let _words = [], _idx = 0, _showAns = false, _showHint = false;
  let _level = 'elementary', _type = 'all', _day = 1, _dir = 'en_to_ko';

  function render() {
    const el = document.getElementById('page-learning');
    el.innerHTML = `
      <h2 style="margin-bottom:16px">📖 플래시카드 학습</h2>
      <div class="filter-bar">
        <select id="lv" onchange="LearningModule.onFilter()">
          <option value="elementary">초등</option>
          <option value="middle">중등</option>
        </select>
        <select id="lt" onchange="LearningModule.onFilter()">
          <option value="all">전체</option>
          <option value="word">단어</option>
          <option value="idiom">숙어</option>
        </select>
        <select id="ld" onchange="LearningModule.onFilter()">
          ${Array.from({length:10},(_,i)=>`<option value="${i+1}">Day ${i+1}</option>`).join('')}
        </select>
        <select id="ldir" onchange="LearningModule.onFilter()">
          <option value="en_to_ko">영→한</option>
          <option value="ko_to_en">한→영</option>
        </select>
      </div>
      <div id="cardArea"></div>`;

    document.getElementById('lv').value   = _level;
    document.getElementById('lt').value   = _type;
    document.getElementById('ld').value   = _day;
    document.getElementById('ldir').value = _dir;
    loadWords();
  }

  async function onFilter() {
    _level = document.getElementById('lv').value;
    _type  = document.getElementById('lt').value;
    _day   = parseInt(document.getElementById('ld').value);
    _dir   = document.getElementById('ldir').value;
    _idx   = 0; _showAns = false; _showHint = false;
    loadWords();
  }

  async function loadWords() {
    document.getElementById('cardArea').innerHTML =
      `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>`;
    _words = await DB.words.getByDay(_level, _day, _type);
    if (!_words.length) {
      document.getElementById('cardArea').innerHTML =
        `<div class="empty-state"><i class="fas fa-book-open"></i><p>단어가 없습니다.</p></div>`;
      return;
    }
    _idx = 0; _showAns = false; _showHint = false;
    renderCard();
  }

  function renderCard() {
    const w   = _words[_idx];
    const pct = Math.round((_idx + 1) / _words.length * 100);

    const front     = _dir === 'en_to_ko' ? w.word_en : w.word_ko;
    const back      = _dir === 'en_to_ko' ? w.word_ko : w.word_en;
    const frontLbl  = _dir === 'en_to_ko' ? '영어' : '한글';
    const backLbl   = _dir === 'en_to_ko' ? '한글 뜻' : '영어 단어';
    const bg        = _dir === 'en_to_ko' ? '#EBF8FF' : '#FFF0F8';
    const hintText  = _dir === 'en_to_ko'
      ? (w.hint_ko || '힌트 없음')
      : `영어 ${w.word_en.length}글자, '${w.word_en[0]}'로 시작함`;

    document.getElementById('cardArea').innerHTML = `
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="progress-label">${_idx+1} / ${_words.length}</div>

      <div class="flashcard" style="background:${bg}" onclick="LearningModule.toggleAnswer()">
        <div class="lang-label">${frontLbl}</div>
        <div class="word">${front}</div>
        <div class="sub">${(_level==='elementary'?'초등':'중등')} · ${w.type==='word'?'단어':'숙어'} · Day ${w.day_group}</div>
      </div>

      ${_showHint ? `<div class="hint-box">💡 ${hintText}</div>` : ''}
      ${_showAns  ? `<div class="answer-box">✅ ${backLbl}: ${back}</div>` : ''}

      <div class="card-actions">
        ${_dir==='en_to_ko' ? `<button class="btn btn-ghost" onclick="LearningModule.playTts()">🔊 듣기</button>` : ''}
        <button class="btn btn-ghost" onclick="LearningModule.toggleHint()">💡 힌트</button>
        <button class="btn btn-primary" onclick="LearningModule.toggleAnswer()">✅ 정답</button>
      </div>

      <div class="card-nav">
        <button class="btn btn-ghost" onclick="LearningModule.prev()" ${_idx===0?'disabled':''}>⬅ 이전</button>
        <button class="btn btn-primary" onclick="LearningModule.next()" ${_idx>=_words.length-1?'disabled':''}>다음 ➡</button>
      </div>`;

    if (_dir === 'en_to_ko') speak(w.word_en);
  }

  function toggleAnswer() { _showAns = !_showAns; renderCard(); }
  function toggleHint()   { _showHint = !_showHint; renderCard(); }
  function playTts()      { if (_words[_idx]) speak(_words[_idx].word_en); }
  function prev() {
    if (_idx > 0) { _idx--; _showAns = false; _showHint = false; renderCard(); }
  }
  function next() {
    if (_idx < _words.length - 1) { _idx++; _showAns = false; _showHint = false; renderCard(); }
  }

  return { render, onFilter, toggleAnswer, toggleHint, playTts, prev, next };
})();
