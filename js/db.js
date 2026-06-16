'use strict';

const DB = (() => {
  let _db = null;

  function init(firestoreInstance) { _db = firestoreInstance; }

  /* ── 단어 ── */
  const words = {
    async getByDay(level, dayGroup, type) {
      let q = _db.collection('word_library')
        .where('level', '==', level)
        .where('day_group', '==', dayGroup);
      if (type && type !== 'all') q = q.where('type', '==', type);
      const snap = await q.get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async getMaxDay(level) {
      const snap = await _db.collection('word_library')
        .where('level', '==', level).get();
      const days = snap.docs.map(d => d.data().day_group || 1);
      return days.length ? Math.max(...days) : 1;
    },
    async seedIfEmpty() {
      const snap = await _db.collection('word_library')
        .where('level', '==', 'elementary').where('day_group', '==', 1).limit(1).get();
      if (!snap.empty) return;

      const CHOSUNG = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
      const getCs = txt => [...txt].map(ch => {
        const c = ch.charCodeAt(0);
        return (c >= 0xAC00 && c <= 0xD7A3) ? CHOSUNG[(c - 0xAC00) / 588 | 0] : '';
      }).join('');

      const makeHint = (en, ko) => `초성: ${getCs(ko)}  (${[...ko].length}글자)`;

      const elem = [
        ['apple','사과'],['banana','바나나'],['cat','고양이'],['dog','강아지'],
        ['egg','달걀'],['fish','물고기'],['grape','포도'],['house','집'],
        ['ice cream','아이스크림'],['juice','주스'],['kite','연'],['lemon','레몬'],
        ['milk','우유'],['nose','코'],['orange','오렌지'],['park','공원'],
        ['rabbit','토끼'],['sun','태양'],['tiger','호랑이'],['umbrella','우산'],
        ['water','물'],['yellow','노란색'],['zoo','동물원'],['bird','새'],
        ['flower','꽃'],['tree','나무'],['cloud','구름'],['moon','달'],
      ].map(([en,ko]) => ({word_en:en,word_ko:ko,level:'elementary',type:'word',day_group:1,hint_ko:makeHint(en,ko)}));
      const elemIdioms = [
        ['get up','일어나다'],['go to bed','자러 가다'],
      ].map(([en,ko]) => ({word_en:en,word_ko:ko,level:'elementary',type:'idiom',day_group:1,hint_ko:makeHint(en,ko)}));

      const mid = [
        ['abandon','버리다/포기하다'],['ability','능력'],['absence','결석/부재'],
        ['absorb','흡수하다'],['accurate','정확한'],['achieve','성취하다'],
        ['adapt','적응하다'],['adequate','적절한'],['adjust','조정하다'],
        ['advance','발전하다'],['advantage','이점'],['affect','영향을 미치다'],
        ['afford','여유가 있다'],['agency','기관/대리점'],['aggressive','공격적인'],
        ['agreement','합의'],['agriculture','농업'],['alert','경계하는'],
        ['allow','허락하다'],['alternative','대안'],['analyze','분석하다'],
        ['ancient','고대의'],['argue','논쟁하다'],['aspect','측면'],
        ['assume','가정하다'],['atmosphere','분위기/대기'],['attach','붙이다'],
        ['attempt','시도하다'],
      ].map(([en,ko]) => ({word_en:en,word_ko:ko,level:'middle',type:'word',day_group:1,hint_ko:makeHint(en,ko)}));
      const midIdioms = [
        ['at first glance','첫눈에'],['break out','발생하다'],
      ].map(([en,ko]) => ({word_en:en,word_ko:ko,level:'middle',type:'idiom',day_group:1,hint_ko:makeHint(en,ko)}));

      const batch = _db.batch();
      [...elem, ...elemIdioms, ...mid, ...midIdioms].forEach(item => {
        batch.set(_db.collection('word_library').doc(), item);
      });
      await batch.commit();
      console.log('[DB] 샘플 단어 업로드 완료');
    }
  };

  /* ── 승인 사용자 ── */
  const users = {
    async isApproved(email) {
      if (email === ADMIN_EMAIL) return true;
      const doc = await _db.collection('approved_users').doc(email).get();
      return doc.exists && doc.data().is_approved === true;
    },
    async ensureAdmin() {
      const ref = _db.collection('approved_users').doc(ADMIN_EMAIL);
      const doc = await ref.get();
      if (!doc.exists) {
        await ref.set({ email: ADMIN_EMAIL, is_approved: true,
                        created_at: firebase.firestore.FieldValue.serverTimestamp() });
      }
    },
    async add(email) {
      await _db.collection('approved_users').doc(email).set({
        email, is_approved: true,
        approved_at: firebase.firestore.FieldValue.serverTimestamp()
      });
    },
    async revoke(email) {
      await _db.collection('approved_users').doc(email).update({ is_approved: false });
    },
    async list() {
      const snap = await _db.collection('approved_users').where('is_approved','==',true).get();
      return snap.docs.map(d => d.data());
    }
  };

  /* ── 성적 ── */
  const scores = {
    async save(email, level, score) {
      await _db.collection('test_history').add({
        user_email: email, level, score,
        test_date: new Date().toISOString().slice(0,10),
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      });
    },
    async list(email) {
      const snap = await _db.collection('test_history')
        .where('user_email','==',email).get();
      return snap.docs.map(d => d.data()).sort((a,b) => a.test_date > b.test_date ? 1 : -1);
    }
  };

  return { init, words, users, scores };
})();
