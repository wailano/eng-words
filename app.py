# ============================================================
# app.py — Firebase 기반 초·중등 영단어 학습 시스템 v1.0
# 실행: streamlit run app.py
# 의존성: pip install streamlit firebase-admin pandas
# ============================================================

import streamlit as st
import streamlit.components.v1 as components
import firebase_admin
from firebase_admin import credentials, firestore, auth as fb_auth
import json, random, datetime, pandas as pd

st.set_page_config(
    page_title="영단어 학습 시스템",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="expanded",
)

ADMIN_EMAIL = "wailano@naver.com"


# ── Firebase Admin SDK 초기화 ─────────────────────────────────
@st.cache_resource
def init_firebase():
    if not firebase_admin._apps:
        try:
            sa_info = dict(st.secrets["firebase_service_account"])
            cred = credentials.Certificate(sa_info)
            firebase_admin.initialize_app(cred)
        except Exception as exc:
            st.error(f"🔥 Firebase 초기화 실패: {exc}")
            st.stop()
    return firestore.client()

db = init_firebase()


# ── 관리자 계정 자동 승인 ─────────────────────────────────────
def ensure_admin_approved():
    ref = db.collection("approved_users").document(ADMIN_EMAIL)
    if not ref.get().exists:
        ref.set({"email": ADMIN_EMAIL, "is_approved": True,
                 "created_at": firestore.SERVER_TIMESTAMP})

ensure_admin_approved()


# ── 힌트 자동 생성 ────────────────────────────────────────────
def get_chosung(text: str) -> str:
    CHOSUNG = list("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")
    result = []
    for ch in text:
        code = ord(ch)
        if 0xAC00 <= code <= 0xD7A3:
            result.append(CHOSUNG[(code - 0xAC00) // 588])
    return "".join(result)

def make_hint_ko(word_en: str, word_ko: str) -> str:
    cs = get_chosung(word_ko)
    return f"초성: {cs}  ({len(word_ko)}글자)"

def make_hint_en(word_en: str) -> str:
    return f"영어 {len(word_en)}글자, '{word_en[0]}'로 시작함"


# ── 샘플 데이터 자동 세팅 ─────────────────────────────────────
@st.cache_data(ttl=86400)
def seed_sample_data():
    existing = list(
        db.collection("word_library")
          .where("day_group", "==", 1)
          .where("level", "==", "elementary")
          .limit(1).get()
    )
    if existing:
        return

    elementary_day1 = [
        ("apple","사과","word"),        ("banana","바나나","word"),
        ("cat","고양이","word"),         ("dog","강아지","word"),
        ("egg","달걀","word"),           ("fish","물고기","word"),
        ("grape","포도","word"),         ("house","집","word"),
        ("ice cream","아이스크림","word"),("juice","주스","word"),
        ("kite","연","word"),            ("lemon","레몬","word"),
        ("milk","우유","word"),          ("nose","코","word"),
        ("orange","오렌지","word"),      ("park","공원","word"),
        ("queen","여왕","word"),         ("rabbit","토끼","word"),
        ("sun","태양","word"),           ("tiger","호랑이","word"),
        ("umbrella","우산","word"),      ("violet","보라색","word"),
        ("water","물","word"),           ("yellow","노란색","word"),
        ("zoo","동물원","word"),         ("bird","새","word"),
        ("flower","꽃","word"),          ("tree","나무","word"),
        ("get up","일어나다","idiom"),   ("go to bed","자러 가다","idiom"),
    ]
    middle_day1 = [
        ("abandon","버리다/포기하다","word"),  ("ability","능력","word"),
        ("absence","결석/부재","word"),         ("absorb","흡수하다","word"),
        ("accurate","정확한","word"),            ("achieve","성취하다","word"),
        ("adapt","적응하다","word"),             ("adequate","적절한","word"),
        ("adjust","조정하다","word"),            ("advance","발전하다","word"),
        ("advantage","이점","word"),             ("affect","영향을 미치다","word"),
        ("afford","여유가 있다","word"),          ("agency","기관/대리점","word"),
        ("aggressive","공격적인","word"),         ("agreement","합의","word"),
        ("agriculture","농업","word"),            ("alert","경계하는","word"),
        ("allow","허락하다","word"),             ("alternative","대안","word"),
        ("analyze","분석하다","word"),            ("ancient","고대의","word"),
        ("argue","논쟁하다","word"),              ("aspect","측면","word"),
        ("assume","가정하다","word"),             ("atmosphere","분위기/대기","word"),
        ("attach","붙이다","word"),               ("attempt","시도하다","word"),
        ("at first glance","첫눈에","idiom"),    ("break out","발생하다","idiom"),
    ]

    batch = db.batch()
    for (w_en, w_ko, w_type) in elementary_day1:
        ref = db.collection("word_library").document()
        batch.set(ref, {"word_en": w_en, "word_ko": w_ko,
                        "level": "elementary", "type": w_type, "day_group": 1,
                        "hint_ko": make_hint_ko(w_en, w_ko)})
    for (w_en, w_ko, w_type) in middle_day1:
        ref = db.collection("word_library").document()
        batch.set(ref, {"word_en": w_en, "word_ko": w_ko,
                        "level": "middle", "type": w_type, "day_group": 1,
                        "hint_ko": make_hint_ko(w_en, w_ko)})
    batch.commit()

seed_sample_data()


# ── Google 소셜 로그인 페이지 ─────────────────────────────────
def show_login_page():
    st.title("📚 영단어 학습 시스템")
    st.markdown("Google 계정으로 로그인하세요. **관리자 승인** 후 이용 가능합니다.")

    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.markdown("<br>", unsafe_allow_html=True)
        # 현재 호스트 감지 → window.top 으로 최상위 창 직접 이동 (모바일 대응)
        try:
            host = st.context.headers.get("host", "localhost:8501")
            protocol = "https" if "streamlit.app" in host else "http"
            auth_url = f"{protocol}://{host}/app/static/auth.html"
        except Exception:
            auth_url = "http://localhost:8501/app/static/auth.html"

        components.html(f"""
<style>
  body {{ margin:0; display:flex; justify-content:center; }}
  #btn {{
    width:100%; max-width:480px; padding:13px 20px;
    background:white; color:#444; border:1.5px solid #ddd;
    border-radius:8px; cursor:pointer; font-size:15px;
    display:flex; align-items:center; justify-content:center; gap:10px;
    box-shadow:0 2px 6px rgba(0,0,0,.1); font-family:'Segoe UI',sans-serif;
    transition:box-shadow .2s;
  }}
  #btn:hover {{ box-shadow:0 4px 14px rgba(0,0,0,.2); }}
  #btn img {{ width:20px; }}
</style>
<button id="btn" onclick="window.top.location.href='{auth_url}'">
  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg">
  Google 계정으로 로그인
</button>
""", height=60)


# ── 쿼리 파라미터 → 토큰 검증 ────────────────────────────────
def process_auth_callback() -> bool:
    params = st.query_params
    if "auth_token" not in params or "auth_email" not in params:
        return False

    raw_token = params["auth_token"]
    raw_email = params["auth_email"]

    try:
        decoded   = fb_auth.verify_id_token(raw_token)
        ver_email = decoded.get("email", "").lower()

        if ver_email != raw_email.lower():
            st.error("토큰-이메일 불일치. 다시 로그인해 주세요.")
            st.query_params.clear()
            return False

        st.session_state.update({
            "authenticated": True,
            "user_email":    ver_email,
        })
        st.query_params.clear()
        return True

    except Exception as exc:
        st.error(f"토큰 검증 실패: {exc}")
        st.query_params.clear()
        return False


# ── 승인 여부 확인 ────────────────────────────────────────────
def is_approved(email: str) -> bool:
    if email == ADMIN_EMAIL:
        return True
    try:
        doc = db.collection("approved_users").document(email).get()
        return doc.exists and doc.to_dict().get("is_approved", False)
    except Exception:
        return False


# ── Firestore 데이터 로드 ─────────────────────────────────────
@st.cache_data(ttl=300)
def load_words(level: str, word_type: str, day_group: int) -> list:
    try:
        q = (db.collection("word_library")
               .where("level",     "==", level)
               .where("day_group", "==", day_group))
        if word_type != "all":
            q = q.where("type", "==", word_type)
        return [{"id": d.id, **d.to_dict()} for d in q.get()]
    except Exception as exc:
        st.error(f"단어 로드 오류: {exc}")
        return []

@st.cache_data(ttl=60)
def load_history(email: str) -> pd.DataFrame:
    try:
        docs = (db.collection("test_history")
                  .where("user_email", "==", email)
                  .order_by("test_date").get())
        rows = [d.to_dict() for d in docs]
        if not rows:
            return pd.DataFrame(columns=["test_date", "score", "level"])
        df = pd.DataFrame(rows)[["test_date", "score", "level"]]
        df["score"] = pd.to_numeric(df["score"], errors="coerce")
        return df
    except Exception:
        return pd.DataFrame(columns=["test_date", "score", "level"])

def save_score(email: str, level: str, score: int):
    try:
        db.collection("test_history").add({
            "user_email": email,
            "test_date":  datetime.date.today().isoformat(),
            "level":      level,
            "score":      score,
            "created_at": firestore.SERVER_TIMESTAMP,
        })
        load_history.clear()
    except Exception as exc:
        st.error(f"성적 저장 실패: {exc}")


# ── TTS ──────────────────────────────────────────────────────
def speak(word: str):
    safe = word.replace("'", "\\'").replace('"', '\\"')
    components.html(
        f"<script>(()=>{{const u=new SpeechSynthesisUtterance('{safe}');"
        f"u.lang='en-US';u.rate=0.85;"
        f"speechSynthesis.cancel();speechSynthesis.speak(u)}})();</script>",
        height=0,
    )


# ── ① 성적 대시보드 ──────────────────────────────────────────
def page_dashboard(email: str):
    st.subheader("📊 성적 대시보드")
    df = load_history(email)

    if df.empty:
        st.info("아직 시험 기록이 없습니다. 테스트 모드에서 시험을 치르고 오세요!")
        return

    col1, col2 = st.columns(2)
    for col, lv, label in [(col1,"elementary","초등"),(col2,"middle","중등")]:
        with col:
            sub = df[df["level"] == lv]
            if sub.empty:
                st.info(f"{label} 기록 없음")
                continue
            st.markdown(f"**{label} 성적 추이**")
            pivot = sub.groupby("test_date")["score"].mean().rename("점수")
            st.line_chart(pivot)

    st.markdown("---")
    st.markdown("**최근 20회 기록**")
    recent = df.tail(20).sort_values("test_date", ascending=False)
    st.dataframe(
        recent.rename(columns={"test_date":"날짜","score":"점수","level":"레벨"}),
        use_container_width=True, hide_index=True,
    )


# ── ② 플래시카드 학습 모드 ────────────────────────────────────
def page_learning():
    st.subheader("📖 플래시카드 학습 모드")

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        level = st.selectbox("학년", ["elementary","middle"],
            format_func=lambda x: "초등" if x=="elementary" else "중등", key="lv")
    with c2:
        wtype = st.selectbox("종류", ["all","word","idiom"],
            format_func=lambda x: {"all":"전체","word":"단어","idiom":"숙어"}[x], key="wt")
    with c3:
        day = st.selectbox("Day", list(range(1, 101)), key="ld")
    with c4:
        direction = st.selectbox("방향", ["en_to_ko","ko_to_en"],
            format_func=lambda x: "영어→한글" if x=="en_to_ko" else "한글→영어", key="dir")

    words = load_words(level, wtype, day)
    if not words:
        st.warning("해당 조건의 단어가 없습니다. upload_words.py 로 데이터를 먼저 업로드하세요.")
        return

    filter_key = (level, wtype, day, direction)
    if st.session_state.get("_lf") != filter_key:
        st.session_state.update({"_lf": filter_key, "ci": 0,
                                  "show_ans": False, "show_hint": False})

    idx = st.session_state.get("ci", 0)
    w   = words[idx]

    st.progress((idx + 1) / len(words))
    st.caption(f"{idx+1} / {len(words)}")

    if direction == "en_to_ko":
        front, front_label = w["word_en"], "영어"
        back,  back_label  = w["word_ko"], "한글 뜻"
        hint_text = w.get("hint_ko", "힌트 없음")
        speak(w["word_en"])
    else:
        front, front_label = w["word_ko"], "한글"
        back,  back_label  = w["word_en"], "영어 단어"
        hint_text = make_hint_en(w["word_en"])

    bg = "#f0f7ff" if direction == "en_to_ko" else "#fff0f5"
    st.markdown(
        f"<div style='text-align:center;padding:40px;background:{bg};"
        f"border-radius:16px;margin:16px 0;'>"
        f"<p style='color:#999;font-size:.85rem;'>{front_label}</p>"
        f"<h1 style='font-size:2.8rem;color:#1a1a2e;margin:0'>{front}</h1>"
        f"</div>",
        unsafe_allow_html=True,
    )

    b1, b2, b3 = st.columns(3)
    with b1:
        if direction == "en_to_ko" and st.button("🔊 다시 듣기"):
            speak(w["word_en"])
    with b2:
        if st.button("💡 힌트 보기"):
            st.session_state["show_hint"] = not st.session_state.get("show_hint", False)
    with b3:
        lbl = "✅ 뜻 보기" if direction == "en_to_ko" else "✅ 정답 보기"
        if st.button(lbl):
            st.session_state["show_ans"] = not st.session_state.get("show_ans", False)
            if direction == "ko_to_en" and st.session_state["show_ans"]:
                speak(w["word_en"])

    if st.session_state.get("show_hint"):
        st.info(f"💡 힌트: {hint_text}")
    if st.session_state.get("show_ans"):
        st.success(f"**{back_label}:** {back}")

    st.markdown("---")
    p, _, n = st.columns([1, 3, 1])
    with p:
        if st.button("⬅ 이전", disabled=(idx == 0)):
            st.session_state.update({"ci": idx-1, "show_ans": False, "show_hint": False})
            st.rerun()
    with n:
        if st.button("다음 ➡", disabled=(idx >= len(words)-1)):
            st.session_state.update({"ci": idx+1, "show_ans": False, "show_hint": False})
            st.rerun()


# ── ③ 30문항 퀴즈 모드 ───────────────────────────────────────
def page_quiz(email: str):
    st.subheader("✏️ 30문항 테스트 모드")

    if "q_words" not in st.session_state or st.session_state.get("q_done"):
        c1, c2, c3 = st.columns(3)
        with c1:
            ql = st.selectbox("학년", ["elementary","middle"],
                format_func=lambda x: "초등" if x=="elementary" else "중등", key="ql")
        with c2:
            qd = st.selectbox("Day", list(range(1,101)), key="qd")
        with c3:
            qdir = st.selectbox("방향", ["en_to_ko","ko_to_en"],
                format_func=lambda x: "영어→한글" if x=="en_to_ko" else "한글→영어", key="qdir")

        if st.button("🚀 30문제 랜덤 시작!", type="primary"):
            pool = load_words(ql, "all", qd)
            if len(pool) < 5:
                st.error("단어가 부족합니다. upload_words.py 로 데이터를 먼저 업로드해 주세요.")
                return
            picked = random.sample(pool, min(30, len(pool)))
            st.session_state.update({
                "q_words": picked, "q_level": ql,
                "q_dir": qdir, "q_done": False, "q_hints": {},
            })
            st.rerun()
        return

    words = st.session_state["q_words"]
    qdir  = st.session_state["q_dir"]
    qlv   = st.session_state["q_level"]

    st.info(
        f"총 **{len(words)}문제** | "
        f"{'영어→한글' if qdir=='en_to_ko' else '한글→영어'} | "
        f"{'초등' if qlv=='elementary' else '중등'}"
    )

    with st.form("quiz_form"):
        for i, w in enumerate(words):
            question    = w["word_en"] if qdir == "en_to_ko" else w["word_ko"]
            placeholder = "한글 뜻 입력" if qdir == "en_to_ko" else "영어 단어 입력"

            col_q, col_a = st.columns([2, 3])
            with col_q:
                hint_shown = st.checkbox(
                    f"Q{i+1}. {question}  💡힌트",
                    key=f"hc_{i}",
                )
                if hint_shown:
                    ht = w.get("hint_ko","힌트 없음") if qdir=="en_to_ko" else make_hint_en(w["word_en"])
                    st.caption(f"💡 {ht}")
            with col_a:
                st.text_input(f"q{i+1}_ans", placeholder=placeholder,
                              label_visibility="collapsed", key=f"qa_{i}")
            st.divider()

        submitted = st.form_submit_button(
            "📝 최종 제출 및 채점", type="primary", use_container_width=True
        )

    if submitted:
        score = 0
        wrongs = []
        for i, w in enumerate(words):
            user_ans = (st.session_state.get(f"qa_{i}") or "").strip()
            correct  = w["word_ko"] if qdir == "en_to_ko" else w["word_en"]
            if user_ans.lower() == correct.lower():
                score += 1
            else:
                wrongs.append({
                    "문제": w["word_en"] if qdir=="en_to_ko" else w["word_ko"],
                    "내 답": user_ans or "(미입력)",
                    "정답": correct,
                })

        pct = round(score / len(words) * 100, 1)
        st.balloons()

        if pct >= 90:
            st.success(f"🏆 **{score}/{len(words)}점 ({pct}%)** — 훌륭합니다!")
        elif pct >= 70:
            st.warning(f"📈 **{score}/{len(words)}점 ({pct}%)** — 잘 했어요!")
        else:
            st.error(f"📚 **{score}/{len(words)}점 ({pct}%)** — 복습이 필요합니다!")

        save_score(email, qlv, score)

        if wrongs:
            st.markdown("### ❌ 오답 목록")
            st.dataframe(pd.DataFrame(wrongs), use_container_width=True, hide_index=True)

        st.session_state["q_done"] = True
        if st.button("🔄 다시 풀기"):
            for k in ["q_words","q_done","q_hints"]:
                st.session_state.pop(k, None)
            st.rerun()


# ── 관리자 패널 ──────────────────────────────────────────────
def panel_admin():
    with st.expander("🔧 [관리자 전용] 자녀 계정 승인 관리", expanded=False):
        st.markdown("##### ✅ 새 계정 승인 추가")
        new_email = st.text_input("이메일", placeholder="child@gmail.com", key="adm_new")
        if st.button("승인 추가"):
            e = new_email.strip()
            if e and "@" in e:
                db.collection("approved_users").document(e).set(
                    {"email": e, "is_approved": True,
                     "approved_at": firestore.SERVER_TIMESTAMP}
                )
                st.success(f"✅ {e} 승인 완료!")
            else:
                st.warning("올바른 이메일 형식을 입력하세요.")

        st.markdown("---")
        st.markdown("##### 현재 승인된 계정")
        try:
            docs = db.collection("approved_users").where("is_approved","==",True).get()
            rows = [d.to_dict() for d in docs]
            if rows:
                st.dataframe(pd.DataFrame(rows)[["email","is_approved"]],
                             use_container_width=True, hide_index=True)
        except Exception as exc:
            st.error(str(exc))

        st.markdown("---")
        st.markdown("##### 🚫 승인 취소")
        rev = st.text_input("취소할 이메일", key="adm_rev")
        if st.button("승인 취소"):
            r = rev.strip()
            if r == ADMIN_EMAIL:
                st.error("관리자 계정은 취소할 수 없습니다.")
            elif r and "@" in r:
                db.collection("approved_users").document(r).update({"is_approved": False})
                st.success(f"🚫 {r} 취소 완료!")
            else:
                st.warning("올바른 이메일 형식을 입력하세요.")


# ── 메인 ─────────────────────────────────────────────────────
def main():
    if st.session_state.pop("do_logout", False):
        st.session_state.clear()
        st.query_params.clear()
        st.rerun()

    if not st.session_state.get("authenticated"):
        process_auth_callback()
        if not st.session_state.get("authenticated"):
            show_login_page()
            return

    email = st.session_state["user_email"]

    if not is_approved(email):
        st.error(
            f"⛔ **접근 불가**: 관리자({ADMIN_EMAIL})의 승인이 필요합니다.\n\n"
            f"현재 계정: `{email}`"
        )
        if st.button("로그아웃"):
            st.session_state["do_logout"] = True
            st.rerun()
        return

    with st.sidebar:
        st.title("📚 영단어 학습")
        st.markdown(f"👤 `{email}`")
        if st.button("🚪 로그아웃"):
            st.session_state["do_logout"] = True
            st.rerun()
        st.divider()
        menu = st.radio("메뉴 선택", [
            "📊 성적 대시보드",
            "📖 학습 모드",
            "✏️ 테스트 모드",
        ])

    if   menu == "📊 성적 대시보드": page_dashboard(email)
    elif menu == "📖 학습 모드":     page_learning()
    elif menu == "✏️ 테스트 모드":   page_quiz(email)

    if email == ADMIN_EMAIL:
        st.divider()
        panel_admin()


if __name__ == "__main__":
    main()
