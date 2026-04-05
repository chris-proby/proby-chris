#!/usr/bin/env python3
"""
profile.md에서 7명 참여자의 신청서 정보를 추출하여
기존 가이드라인_2차_질문별_응답정리_7명.csv 파일 앞에
프로필 섹션을 붙인 통합 CSV를 생성합니다.
"""

import csv
import re

BASE_PATH = "/Users/churryboy/proby-chris/proby-chris/60. 유저인사이트팀/LG Uplus/Poc2/"

# 7명 참여자 이름 → 참여자 코드
PARTICIPANTS = {
    "전수현": "A",
    "이연진": "B",
    "황수경": "C",
    "김영균": "D",
    "김남호": "E",
    "이민승": "F",   # profile.md 원본 이름
    "조수정": "G",
}

# profile.md 열 인덱스 (파이프 분할 기준, 실제 파일 선행 | 포함)
COL = {
    "timestamp": 1,
    "변경계기": 2,
    "현재기종": 3,
    "현재통신사": 4,
    "이전통신사": 5,
    "변경시기": 6,
    "번호변경": 7,
    "NPS추천점수": 8,
    "네트워크만족도": 9,
    "멤버십앱이용빈도": 10,
    "통신사앱이용빈도": 11,
    "AI서비스이용": 12,
    "월요금": 13,
    "품질문의경험": 14,
    "품질보상및조치": 15,
    "커뮤니티": 16,
    "이름": 17,
    "나이": 18,
    "성별": 19,
    "직업": 20,
    "이전기종": 23,
    "단말기확보방식": 24,
    "통신사변경방식": 25,
    "가입채널": 26,
    "결합상품": 27,
    "부가서비스": 28,
    "멤버십이용빈도": 29,
}

# 프로필 항목 출력 순서 (화면에 표시될 순서)
PROFILE_FIELDS_ORDER = [
    "나이", "성별", "직업",
    "현재통신사", "이전통신사", "변경시기", "번호변경",
    "변경계기",
    "현재기종", "이전기종", "단말기확보방식", "통신사변경방식",
    "가입채널", "결합상품", "부가서비스",
    "NPS추천점수", "네트워크만족도",
    "멤버십앱이용빈도", "통신사앱이용빈도", "멤버십이용빈도",
    "AI서비스이용", "월요금",
    "품질문의경험", "품질보상및조치",
    "커뮤니티",
]

FIELD_LABEL = {
    "나이": "나이",
    "성별": "성별",
    "직업": "직업",
    "현재통신사": "현재 통신사 (가입)",
    "이전통신사": "이전 통신사 (변경 전)",
    "변경시기": "통신사 변경 시기",
    "번호변경": "번호 변경 여부",
    "변경계기": "통신사 변경 계기",
    "현재기종": "현재 스마트폰 기종",
    "이전기종": "변경 전 스마트폰 기종",
    "단말기확보방식": "단말기 확보 방식",
    "통신사변경방식": "통신사 변경 방식",
    "가입채널": "가입 채널",
    "결합상품": "결합 상품",
    "부가서비스": "부가서비스",
    "NPS추천점수": "NPS 추천 점수 (0~10)",
    "네트워크만족도": "통화/네트워크 품질 만족도",
    "멤버십앱이용빈도": "멤버십 앱 이용 빈도",
    "통신사앱이용빈도": "통신사 앱 이용 빈도",
    "멤버십이용빈도": "멤버십 혜택 실제 이용 빈도",
    "AI서비스이용": "AI 서비스 이용 여부",
    "월요금": "현재 월 요금",
    "품질문의경험": "네트워크 품질 문의/민원 경험",
    "품질보상및조치": "고객센터 보상/조치 경험",
    "커뮤니티": "주로 이용하는 커뮤니티",
}


def parse_profile_md():
    """profile.md에서 참여자 데이터 추출"""
    profile_path = BASE_PATH + "profile.md"
    with open(profile_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    participant_rows = {}

    for line in lines:
        # 데이터 행만 처리 (타임스탬프 패턴으로 시작하는 행)
        if not re.search(r'\d{1,2}/\d{1,2}/\d{4}', line):
            continue

        cells = [c.strip() for c in line.split("|")]

        # 이름 컬럼 확인
        if len(cells) <= COL["이름"]:
            continue

        name = cells[COL["이름"]].strip()
        if name in PARTICIPANTS:
            # 이미 추가된 경우 첫 번째만 사용
            if name not in participant_rows:
                participant_rows[name] = {
                    field: cells[idx].strip() if len(cells) > idx else ""
                    for field, idx in COL.items()
                }

    return participant_rows


def generate_combined_csv(profile_data):
    """프로필 + Q&A 통합 CSV 생성"""

    # 참여자 순서 (A~G)
    ordered_names = sorted(
        PARTICIPANTS.keys(),
        key=lambda n: PARTICIPANTS[n]
    )

    # 열 헤더
    participant_headers = [
        f"{n}({PARTICIPANTS[n]})" for n in ordered_names
    ]

    out_path = BASE_PATH + "가이드라인_2차_질문별_응답정리_7명_통합.csv"

    with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)

        # ── 프로필 섹션 헤더 ──────────────────────────────
        writer.writerow(["[프로필 섹션]"] + [""] * (len(participant_headers) + 1))
        writer.writerow(["항목"] + participant_headers + ["비고"])

        # 프로필 행 기록
        for field in PROFILE_FIELDS_ORDER:
            label = FIELD_LABEL.get(field, field)
            row = [label]
            for name in ordered_names:
                pdata = profile_data.get(name, {})
                val = pdata.get(field, "-")
                # 긴 텍스트 정리 (HTML 태그 및 줄바꿈 제거)
                val = val.replace("<br>", " / ").replace("  <br>", " ").strip()
                row.append(val)
            row.append("")  # 비고 열 빈칸
            writer.writerow(row)

        # 구분 행
        writer.writerow([""] * (len(participant_headers) + 2))
        writer.writerow([""] * (len(participant_headers) + 2))

        # ── Q&A 섹션 ──────────────────────────────────────
        writer.writerow(["[Q&A 섹션] 질문별 응답 정리"] + [""] * (len(participant_headers) + 1))

        # 기존 Q&A CSV 읽어서 추가
        qa_path = BASE_PATH + "가이드라인_2차_질문별_응답정리_7명.csv"
        with open(qa_path, "r", encoding="utf-8-sig") as qf:
            reader = csv.reader(qf)
            for r in reader:
                writer.writerow(r)

    print(f"✅ 통합 CSV 저장 완료: {out_path}")
    return out_path


def generate_profile_only_csv(profile_data):
    """프로필만 담은 별도 CSV (가로 레이아웃: 참여자가 열)"""
    ordered_names = sorted(PARTICIPANTS.keys(), key=lambda n: PARTICIPANTS[n])
    participant_headers = [f"{n}({PARTICIPANTS[n]})" for n in ordered_names]

    out_path = BASE_PATH + "참여자_프로필_7명.csv"
    with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        writer.writerow(["항목"] + participant_headers)

        for field in PROFILE_FIELDS_ORDER:
            label = FIELD_LABEL.get(field, field)
            row = [label]
            for name in ordered_names:
                pdata = profile_data.get(name, {})
                val = pdata.get(field, "-")
                val = val.replace("<br>", " / ").replace("  <br>", " ").strip()
                row.append(val)
            writer.writerow(row)

    print(f"✅ 프로필 단독 CSV 저장 완료: {out_path}")
    return out_path


if __name__ == "__main__":
    print("📋 profile.md 파싱 중...")
    profile_data = parse_profile_md()
    found = list(profile_data.keys())
    print(f"  → 찾은 참여자: {found}")

    # 이민승 → 이민슷 별칭 처리 (인터뷰 파일명 기준)
    if "이민승" in profile_data:
        profile_data["이민슷"] = profile_data["이민승"]

    generate_profile_only_csv(profile_data)
    generate_combined_csv(profile_data)
    print("\n완료!")
