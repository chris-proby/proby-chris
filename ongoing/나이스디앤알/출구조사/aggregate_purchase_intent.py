#!/usr/bin/env python3
"""
나이스디앤알 폴더 내 인터뷰 .md 전부에서
'VEHICLE-I가 향후 시장에 출시된다면 구매를 고려해 보실 것 같으신가요?' 질문에 대한
첫 [사용자] 응답을 추출하여 구매 고려·비고려·조건부로 분류·집계.
"""
import re
import os
from pathlib import Path
from collections import defaultdict
from typing import Optional

BASE = Path(__file__).resolve().parent
EXCLUDE_PREFIXES = ("나이스디앤알_", "가이드라인", "금융행태조사", "출구조사", "반복질문")
Q_PATTERNS = [
    "구매를 고려해 보실 것 같으신가요",
    "시장에 출시된다면",
]

def is_interview_md(path: Path) -> bool:
    name = path.name
    if not name.endswith(".md"):
        return False
    for ex in EXCLUDE_PREFIXES:
        if name.startswith(ex):
            return False
    # 숫자로만 또는 숫자_숫자 (예: 388_2.md)
    stem = name[:-3]
    if re.match(r"^\d+$", stem):
        return True
    if re.match(r"^\d+_\d+$", stem):
        return True
    return False

def get_file_id(path: Path) -> str:
    return path.stem

def extract_first_user_response_after_question(content: str) -> Optional[str]:
    """구매 의향 질문 직후 나오는 첫 [사용자]/참여자 블록 텍스트 반환."""
    lines = content.split("\n")
    for i, line in enumerate(lines):
        if not any(p in line for p in Q_PATTERNS):
            continue
        # 질문 라인 발견 → 다음 사용자 블록 찾기
        j = i + 1
        while j < len(lines):
            stripped = lines[j].strip()
            # [사용자]: 형식
            if stripped.startswith("[사용자]:") or stripped.startswith("[사용자 ]:"):
                text = re.sub(r"^\[사용자\s*\]:?", "", lines[j]).strip()
                j += 1
                while j < len(lines):
                    next_s = lines[j].strip()
                    if next_s.startswith("[사용자]:") or next_s.startswith("[AI 인터뷰어]") or next_s.startswith("[인터뷰어]") or re.match(r"^참여자\d", next_s) or next_s.startswith("AI 인터뷰어"):
                        break
                    if next_s:
                        text += " " + next_s
                    j += 1
                return text if text else None
            # 참여자02:38 형식 (다음 비어있지 않은 줄이 응답)
            if re.match(r"^참여자\d", stripped):
                j += 1
                user_lines = []
                while j < len(lines):
                    next_s = lines[j].strip()
                    if not next_s:
                        j += 1
                        continue
                    if next_s.startswith("AI 인터뷰어") or re.match(r"^참여자\d", next_s):
                        break
                    user_lines.append(next_s)
                    j += 1
                return " ".join(user_lines) if user_lines else None
            # 질문이 단독 줄에 있는 경우 (예: 1.md)
            if stripped and not stripped.startswith("AI 인터뷰어") and not stripped.startswith("[AI"):
                if "구매" in stripped or "고려" in stripped or "출시" in stripped:
                    j += 1
                    continue
                return stripped
            j += 1
        return None
    return None

def classify_intent(text: str) -> str:
    """'구매 고려' | '비고려' | '조건부'"""
    if not text or not text.strip():
        return "미응답"
    t = text.strip()
    # 조건부: 가격/디자인/보완 등이 충족되면 고려
    if re.search(r"(가격|저렴|납득|개선|보완|된다면|되면|된다고 하면).*고려", t):
        return "조건부"
    if re.search(r"고려.*(가격|저렴|된다면|되면|보고)", t):
        return "조건부"
    if re.search(r"할인|혜택에 따라|차이가 있을 거 같아", t):
        return "조건부"
    if re.search(r"보완이 된다고 하면|보완.*되면", t):
        return "조건부"
    if re.search(r"저렴하다면 구매|납득할 만한 가격.*구매 고려", t):
        return "조건부"
    # 비고려
    if re.search(r"고려하지 않|고려 안 할|고려를 안 할|구매 안 할|구매하지 않|구매하지 않을", t):
        return "비고려"
    if re.search(r"안 할 것 같|안 할거 같", t):
        return "비고려"
    if re.search(r"와닿지 않|와닿지는 않", t):
        return "비고려"
    if re.search(r"비싸서 구매하지 않|가격이 너무 비싸", t):
        return "비고려"
    if re.search(r"망설이|선택하지 않", t):
        return "비고려"
    # 구매 고려·긍정 (앞에서 조건부/비고려 걸러짐)
    if re.search(r"고려할 것|고려해 볼|고려해 보겠|고려해 보시겠|고려는 해보겠|고려해 보시겠다고|긍정적으로 고려", t):
        return "구매 고려"
    if re.search(r"고려해 보시겠다|고려하겠다|고려하겠습니다", t):
        return "구매 고려"
    if re.search(r"무조건 고려|구매를 고려|구매 고려 의사", t):
        return "구매 고려"
    if re.search(r"나쁘지 않을 것 같|괜찮으면|만족스러우면.*구매", t):
        return "구매 고려"  # 긍정적 결론
    # 짧은 긍정
    if re.search(r"^(네|응|예|그렇습니다|그래요|맞아요)", t):
        return "구매 고려"
    if re.search(r"가격을 보고 구매를 고려", t):
        return "구매 고려"
    if re.search(r"항상 이용하는 차가 아반떼", t):  # 415
        return "구매 고려"
    # 추가 긍정 패턴
    if re.search(r"구매할 의향이 있습니다|구매할 것 같습니다|구매를 할 것 같습니다|구매해보고 싶습니다|구매할 거 같아요|구매할 이야기|구매를 하고 싶습니다|무조건 구매", t):
        return "구매 고려"
    if re.search(r"고려를 하고 있습니다|고려할 것 같긴 해|비교 차량군에는 들어갈|염두할 것 같아요|염도할 것 같아요", t):
        return "구매 고려"
    if re.search(r"보정해 볼|구매로 고려한 거 같아요|구매를 보려할 것 같아요|고려해 보았습니다", t):  # 오타 포함
        return "구매 고려"
    if re.search(r"물론이죠|사고 싶은 생각이 있네요|충분히 구매할|구매하겠습니다", t):
        return "구매 고려"
    if re.search(r"구매는 그거를 볼 것 같아|경쟁력이 있는 것 같습니다|우려를 해볼|우려할 것 같아요", t):  # 우려=고려
        return "구매 고려"
    if re.search(r"긍정적으로 느끼면서", t):
        return "구매 고려"
    if re.search(r"선호하는 디자인이에요|디자인으로써 되게 좋을 것 같아요", t) and "안" not in t[:10]:
        return "구매 고려"
    # 추가 비고려 패턴
    if re.search(r"^(아니요|아닙니다|아니오)\s*[.!]?$|^아니요\s*$", t):
        return "비고려"
    if re.search(r"그렇지 않을 것 같습니다|아직은 없을 것 같습니다|나은 것 같아요.*아반떼|아반떼가 훨씬 나은 것 같아요", t):
        return "비고려"
    if re.search(r"보류를 해볼 거 같아요", t):
        return "비고려"
    if re.match(r"^(아니요|아닙니다|아니오)\s*[.\s]*$", t) or (len(t) < 15 and re.search(r"^아니요|^아닙니다", t)):
        return "비고려"
    # 조건부 추가
    if re.search(r"내부를 바꾸면은|다른 모델이랑 비교해볼 것 같긴 해|고민은 해보겠는데 썩 긍정적|책정 가격에 따라서", t):
        return "조건부"
    if re.search(r"고성능에 적합한 모델이", t):
        return "조건부"
    # 추가 보강
    if re.search(r"꼭 사고 싶어요|사고 싶어요", t):
        return "구매 고려"
    if re.search(r"별로 고려하지는 않을|고려하지는 않을", t):
        return "비고려"
    if re.search(r"아이들 크고 나서|보통으로 생각하고", t):
        return "조건부"
    if re.search(r"^있습니다\.$|^생각합니다\.$", t):
        return "구매 고려"
    if re.search(r"로딩이 멈춘|센터패실", t):
        return "미분류"
    return "미분류"

def main():
    files = sorted([f for f in BASE.iterdir() if f.is_file() and is_interview_md(f)])
    print(f"분석 대상 파일 수: {len(files)}")

    by_category = defaultdict(list)  # category -> [file_id]
    raw = []

    for path in files:
        fid = get_file_id(path)
        try:
            content = path.read_text(encoding="utf-8")
        except Exception as e:
            print(f"Read error {path.name}: {e}")
            continue
        resp = extract_first_user_response_after_question(content)
        if resp is None:
            by_category["미응답"].append(fid)
            raw.append((fid, "", "미응답"))
            continue
        cat = classify_intent(resp)
        by_category[cat].append(fid)
        raw.append((fid, resp[:80], cat))

    n_total = len(files)
    n_consider = len(by_category["구매 고려"])
    n_no = len(by_category["비고려"])
    n_cond = len(by_category["조건부"])
    n_other = len(by_category["미응답"]) + len(by_category["미분류"])

    print("\n=== 구매 의향 응답 분류 (1건 1응답) ===")
    print(f"총 파일(건) 수: n = {n_total}")
    print(f"구매 고려·긍정: {n_consider}건 ({100*n_consider/n_total:.1f}%)")
    print(f"구매 비고려·망설임: {n_no}건 ({100*n_no/n_total:.1f}%)")
    print(f"조건부: {n_cond}건 ({100*n_cond/n_total:.1f}%)")
    if n_other:
        print(f"미응답/미분류: {n_other}건")

    print("\n--- 미분류/미응답 샘플 ---")
    for fid, r, c in raw:
        if c in ("미분류", "미응답"):
            print(f"  {fid}: {c} | {r}")

    # 요인별 재집계는 별도 스크립트로 할 수 있음. 여기서는 n, 건수, 비율만 출력
    return {
        "n": n_total,
        "구매 고려": n_consider,
        "비고려": n_no,
        "조건부": n_cond,
        "by_category": dict(by_category),
        "raw": raw,
    }

if __name__ == "__main__":
    main()
