#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
구매 고려·긍정(3.1) / 비고려·망설임(3.2) 응답에서 "이유" 블록을 추출해 요인별 빈도를 집계.
aggregate_purchase_intent.py의 분류 결과(긍정/부정 파일 목록)를 사용.
"""

import os
import re
from collections import defaultdict

# aggregate_purchase_intent.py와 동일한 ID 목록 및 분류 로직 간소화
DIR = os.path.dirname(os.path.abspath(__file__))
IDS = [
    1, 5, 7, 9, 16, 28, 31, 41, 42, 43, 45, 47, 48, 56, 57, 58, 62, 69, 72, 73, 74, 75, 78, 80, 85,
    105, 120, 121, 126, 131, 134, 140, 141, 142, 147, 163, 190, 200,
    301, 302, 303, 304, 305, 306, 307, 308, 310, 311, 312, 313, 314, 316, 317, 318, 319, 320, 321, 322,
    324, 325, 326, 327, 328, 329, 330, 332, 333, 334, 336, 337, 338, 339, 340, 341, 342, 343, 345, 346, 347, 348,
    350, 351, 352, 353, 405, 406, 500
]

# 구매 의향 분류 결과 (aggregate_purchase_intent.py 실행 결과와 동기화)
POSITIVE_IDS = {1, 5, 7, 9, 16, 28, 31, 41, 42, 43, 45, 56, 57, 62, 72, 74, 75, 80, 85, 126, 131, 134, 140, 141, 142, 147, 163, 190, 200, 303, 304, 305, 306, 307, 308, 311, 312, 314, 316, 317, 318, 319, 320, 321, 322, 324, 325, 326, 327, 329, 333, 334, 336, 337, 338, 342, 343, 345, 346, 351, 353, 405, 406, 500}
NEGATIVE_IDS = {47, 48, 69, 73, 78, 120, 121, 302, 310, 339, 340, 341, 347, 348, 350, 352}

def get_reason_for_positive(content: str) -> str:
    """구매 긍정 이유: 구매 고려 질문 ~ 신기술 질문 전까지의 모든 [사용자]/참여자 응답을 합쳐 반환."""
    # 구매 고려 질문 위치부터 "신기술" 질문 전까지 잘라서, 그 안의 사용자 발화만 추출
    start = re.search(r"구매를\s*고려해\s*보실\s*것\s*같으신가요", content, re.IGNORECASE)
    if not start:
        return ""
    segment = content[start.end():][:3500]
    end = re.search(r"SDV|OTA|FoD|신기술.*적용", segment, re.IGNORECASE)
    if end:
        segment = segment[:end.start()]
    # [사용자]: ... 또는 참여자\d* \n ... 블록들 추출
    blocks = re.findall(r"(?:\[사용자\]|참여자\d*)\s*:?\s*([^\[]+?)(?=\[AI 인터뷰어\]|참여자\d*|$)", segment, re.DOTALL)
    return re.sub(r"\s+", " ", " ".join(b.strip() for b in blocks if b.strip()))[:1200]

def get_reason_for_negative(content: str) -> str:
    """구매 비고려 이유: 구매 고려 질문 ~ 신기술 질문 전까지의 모든 사용자 발화."""
    start = re.search(r"구매를\s*고려해\s*보실\s*것\s*같으신가요", content, re.IGNORECASE)
    if not start:
        return ""
    segment = content[start.end():][:3500]
    end = re.search(r"SDV|OTA|FoD|신기술.*적용", segment, re.IGNORECASE)
    if end:
        segment = segment[:end.start()]
    blocks = re.findall(r"(?:\[사용자\]|참여자\d*)\s*:?\s*([^\[]+?)(?=\[AI 인터뷰어\]|참여자\d*|$)", segment, re.DOTALL)
    return re.sub(r"\s+", " ", " ".join(b.strip() for b in blocks if b.strip()))[:1200]

# 3.1 긍정 요인 키워드 (요인명: [키워드 리스트])
POSITIVE_FACTORS = {
    "가격·가성비": ["가격", "가성비", "저렴", "합리", "비용", "금액", "차량재필 가격", "가격대비", "가격 대비"],
    "실내 공간·디스플레이·시트": ["실내", "공간", "디스플레이", "화면", "시트", "천연가죽", "센터피스", "센터페시아", "내비", "인테리어", "넓", "확장성"],
    "디자인·스포티·미래지향": ["디자인", "외관", "스포티", "미래", "트렌디", "세련", "고급", "강인", "젊", "차별", "혁신"],
    "브랜드·신뢰": ["브랜드", "신뢰", "평판", "현대"],
    "실용성·운전 편의": ["실용", "편의", "편리", "운전", "주차", "크기", "적당"],
    "연비·경제성": ["연비", "경제", "성능"],
    "안전·사양": ["안전", "에어백", "기능", "옵션", "사양", "편의 옵션"],
}

# 3.2 부정 요인 키워드
NEGATIVE_FACTORS = {
    "디자인·외관 불만": ["디자인", "외관", "쉐입", "계기판", "스타일", "못생", "올드", "맞지 않"],
    "가격 부담": ["가격", "비싸", "금액", "부담", "가격대", "생각했던 금액"],
    "후면·뒷모습·물리버튼": ["뒷모습", "뒷", "후면", "후진", "깜빡이", "번호판", "물리", "버튼", "터치"],
    "SUV 대비·안전성 인식": ["SUV", "안전", "준중형"],
    "바디타입·용도 불일치": ["바디", "타입", "용도", "가족", "크기", "작"],
    "기타·미확인": ["완성차", "보지 않", "차별성", "스포티하지"],
}

def count_factors(text: str, factors_dict: dict) -> dict:
    """텍스트에서 요인별 키워드 매칭 여부(1건 1회만) 집계."""
    counts = defaultdict(int)
    text_lower = text.lower()
    for factor_name, keywords in factors_dict.items():
        for kw in keywords:
            if kw in text or kw in text_lower:
                counts[factor_name] += 1
                break
    return counts

def main():
    pos_reason_counts = defaultdict(int)
    neg_reason_counts = defaultdict(int)
    pos_total_with_reason = 0
    neg_total_with_reason = 0

    for i in IDS:
        path = os.path.join(DIR, f"{i}.md")
        if not os.path.isfile(path):
            continue
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        if i in POSITIVE_IDS:
            reason = get_reason_for_positive(content)
            if reason:
                pos_total_with_reason += 1
                for factor, c in count_factors(reason, POSITIVE_FACTORS).items():
                    if c:
                        pos_reason_counts[factor] += 1
        elif i in NEGATIVE_IDS:
            reason = get_reason_for_negative(content)
            if reason:
                neg_total_with_reason += 1
                for factor, c in count_factors(reason, NEGATIVE_FACTORS).items():
                    if c:
                        neg_reason_counts[factor] += 1

    print("=== 3.1 구매 고려·긍정 — 요인별 빈도 (n=64, 이유 응답 있는 건만 요인 매칭) ===\n")
    print("| 요인 | 빈도 |")
    print("|------|------|")
    for factor in ["가격·가성비", "실내 공간·디스플레이·시트", "디자인·스포티·미래지향", "브랜드·신뢰", "실용성·운전 편의", "연비·경제성", "안전·사양"]:
        print(f"| {factor} | {pos_reason_counts[factor]}건 |")
    print(f"\n(이유 추출 성공 건수: {pos_total_with_reason}건)")

    print("\n\n=== 3.2 비고려·망설임 — 요인별 빈도 (n=16) ===\n")
    print("| 요인 | 빈도 |")
    print("|------|------|")
    for factor in ["디자인·외관 불만", "가격 부담", "후면·뒷모습·물리버튼", "SUV 대비·안전성 인식", "바디타입·용도 불일치", "기타·미확인"]:
        print(f"| {factor} | {neg_reason_counts[factor]}건 |")
    print(f"\n(이유 추출 성공 건수: {neg_total_with_reason}건)")

    return pos_reason_counts, neg_reason_counts

if __name__ == "__main__":
    main()
