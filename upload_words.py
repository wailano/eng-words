# ============================================================
# upload_words.py — 대량 단어 데이터 Firestore 일괄 업로드
# 실행: python upload_words.py
# 의존성: pip install firebase-admin
# ============================================================

import firebase_admin
from firebase_admin import credentials, firestore
import time

# ── Firebase 초기화 ──────────────────────────────────────────
# Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
# 다운로드한 JSON 파일을 이 파일과 같은 폴더에 serviceAccountKey.json 으로 저장
SERVICE_ACCOUNT_PATH = "serviceAccountKey.json"

if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)

db = firestore.client()


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


# ── 업로드 함수 ──────────────────────────────────────────────
def upload_words(words: list, batch_size: int = 400):
    """
    words 리스트 형식:
    [
      {
        "word_en":   "apple",
        "word_ko":   "사과",
        "level":     "elementary",   # elementary / middle
        "type":      "word",         # word / idiom
        "day_group": 1,              # 1 ~ 100
      },
      ...
    ]
    hint_ko 필드는 자동 생성됩니다.
    """
    total    = len(words)
    uploaded = 0

    for start in range(0, total, batch_size):
        chunk = words[start : start + batch_size]
        batch = db.batch()

        for item in chunk:
            if "hint_ko" not in item:
                item["hint_ko"] = make_hint_ko(item["word_en"], item["word_ko"])
            ref = db.collection("word_library").document()
            batch.set(ref, item)

        batch.commit()
        uploaded += len(chunk)
        print(f"✅ {uploaded}/{total} 업로드 완료")
        time.sleep(0.3)

    print(f"\n🎉 전체 {total}개 단어 업로드 완료!")


def upload_if_not_exists(words: list):
    """level + day_group 조합이 이미 있으면 해당 day 스킵 (중복 방지)"""
    existing_keys = set()
    for d in db.collection("word_library").stream():
        dd = d.to_dict()
        existing_keys.add((dd.get("level"), dd.get("day_group")))

    filtered = [w for w in words if (w["level"], w["day_group"]) not in existing_keys]

    if not filtered:
        print("이미 모든 데이터가 업로드되어 있습니다.")
        return

    print(f"신규 업로드 대상: {len(filtered)}개")
    upload_words(filtered)


# ── ▼ 여기에 단어 데이터를 추가하세요 ────────────────────────
# level    : "elementary" (초등) / "middle" (중등)
# type     : "word" (단어) / "idiom" (숙어/표현)
# day_group: 1 ~ 100 (Day 번호)

WORDS_DATA = [
    # ── 초등 Day 2 예시 ──────────────────────────────────────
    {"word_en": "book",    "word_ko": "책",    "level": "elementary", "type": "word", "day_group": 2},
    {"word_en": "chair",   "word_ko": "의자",  "level": "elementary", "type": "word", "day_group": 2},
    {"word_en": "desk",    "word_ko": "책상",  "level": "elementary", "type": "word", "day_group": 2},
    {"word_en": "pencil",  "word_ko": "연필",  "level": "elementary", "type": "word", "day_group": 2},
    {"word_en": "eraser",  "word_ko": "지우개","level": "elementary", "type": "word", "day_group": 2},
    # 여기에 계속 추가...

    # ── 중등 Day 2 예시 ──────────────────────────────────────
    {"word_en": "benefit",   "word_ko": "이익/혜택", "level": "middle", "type": "word", "day_group": 2},
    {"word_en": "challenge", "word_ko": "도전",       "level": "middle", "type": "word", "day_group": 2},
    {"word_en": "compare",   "word_ko": "비교하다",   "level": "middle", "type": "word", "day_group": 2},
    # 여기에 계속 추가...
]


# ── 실행 ─────────────────────────────────────────────────────
if __name__ == "__main__":
    if not WORDS_DATA:
        print("WORDS_DATA 리스트에 데이터를 먼저 채워주세요.")
    else:
        upload_if_not_exists(WORDS_DATA)
