# -*- coding: utf-8 -*-
"""전수현.md 인터뷰 스크립트를 유지하고 참여자 발화만 홍길동 모의 샘플로 치환 → .md + 녹취록 .docx"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

DIR = Path(__file__).resolve().parent
SOURCE = DIR / "전수현.md"
OUT_MD = DIR / "홍길동.md"

SPEAKER = re.compile(r"^(AI 인터뷰어|참여자)(\d{2}:\d{2})\s*$")

# 모의 참여자(홍길동) 발화 29턴 — 실제 인물·실제 경험과 무관한 샘플
MOCK_BODIES: list[str] = [
    "네, 시작해도 돼요.",
    "저는 스물아홉이고, IT 스타트업에서 프로덕트 일을 하고 있어요. 퇴근하면 헬스 가거나 집에서 유튜브 쇼츠랑 숏폼 드라마를 자주 틀어놓는 편이에요.",
    "유튜브 쇼츠, 인스타 릴스, 가끔 넷플릭스요. 짧은 건 알고리즘이 계속 이어줘서 시간 가는 줄 모르게 봐요. 장르는 미스터리나 블랙 코미디 쪽이 재밌고, 로맨스는 가볍게 힐링용으로 보고요. 공포는 혼자 보면 잠을 못 자겠더라고요, 잘 안 봐요.",
    "하루 미디어 시간으로 치면 한 이십에서 이십오 퍼센트 정도가 숏폼 드라마 쪽인 것 같아요. 출퇴근이랑 점심시간에 소비가 많아요.",
    "주로 주 삼네 번은 보는 것 같아요. 릴스에서 클립 보고 앱으로 넘어가거나, 드라마박스 들어가서 목록 훑어봐요. 주말에 한 번에 몰아보기도 하고요.",
    "한국 작품 필터가 잘 돼 있고, 무료 회차랑 이벤트 코인이 직관적이라 자주 열게 돼요. 신작 알림도 자주 와서요.",
    "둘 다 해요. 호기심 생기면 삼사 화만 보고 갈아타는 경우도 많고, 진짜 끌리면 끝까지 가요. 정주행 비율은 한 사십 퍼센트, 나머지는 맛보기 쪽에 가깝습니다.",
    "저는 썸네일 색감이랑, 제목에 ‘반전’ ‘미스터리’ 같은 키워드 들어가면 손이 먼저 가요. 배우는 잘 몰라서 이름보다는 톤이 더 중요해요.",
    "제목만 자극적이면 금방 나가요. 회차 넘어갈수록 복선이 쌓이는지, 대사가 억지스럽지 않은지 봐요. 그게 안 되면 이탈합니다.",
    "태그로 장르 먼저 보고, 줄거리 두세 줄짜리만 읽어봐요. 스포일러 안 되게 요약돼 있으면 좋아요.",
    "한 사오 화까지는 보고 결정해요. 첫 화 훅이 약하면 그냥 접는 편이라, 여섯 화를 꼭 채우진 않아요.",
    "미래 도시 배경에 추적·스릴러 느낌 났던 작품이 기억나요. 제목은 정확히 기억 안 나는데, 무료 끊기는 지점이 딱 클라이맥스 직전이라 ‘아 이건 사야겠다’ 싶었어요.",
    "가벼운 코믹 로맨스나 캠퍼스물은 킬링타임으로 좋아요. 재벌물은 설정 설명이 길어지면 지루해서 잘 안 눌러요.",
    "로맨스는 마음 편하게 웃을 수 있으니까요. 재벌물은 대사가 과장되면 현실감이 떨어져서 몰입이 끊겨요.",
    "대중적인 전개 좋아하는 분들이랑, 세계관 디테일 찾는 판타지 팬이랑 다른 것 같아요. 저는 중간쯤인 것 같아요, 둘 다 가끔 봅니다.",
    "판타지인데 현실 파트만 길게 나오면 ‘이거 왜 판타지지’ 싶어요. 규칙이 허술하면 금방 흥미 떨어져요.",
    "시간 루프나 평행 세계 설정이면 일단 눌러봐요. 유료 전환은 다섯 여섯 화 보고 ‘이야기가 살아 있나’ 보고 결정해요.",
    "드라마박스랑 틱톡이요. 비글루는 최근에 테스트로 깔아서 가끔 들어가 봐요.",
    "비글루는 라인업이 드라마박스보다 얇게 느껴지긴 해요. 대신 영상 톤이나 UI는 꽤 세련됐고, 가끔 한글 자막이나 번역 톤이 살짝 어색할 때가 있어요.",
    "드라마박스에선 그냥 가볍게 볼 거 찾을 때, 비글루에선 SF나 AI 태그 달린 카드 위주로 눌러봐요. 기대하는 분위기가 달라요.",
    "아니요, 비키나 아이치이이이는 써본 적 없어요. 이름만 알아요.",
    "처음엔 ‘AI가 감정선을 잘 그릴까’ 반신반의했는데, 편견이었던 것 같아요.",
    "네, 캠페인으로 짧게 본 적 있어요.",
    "연출이 과감하고 컷이 빨라서 지루하진 않았어요. 전개 방향이 제가 보던 한국 숏폼이랑은 좀 달랐고요.",
    "대사가 가끔 번역투처럼 들릴 때가 있어요. 그래도 캐릭터 비주얼이나 색감은 솔직히 놀랐습니다.",
    "첫 화면이 정돈돼 있어서 어디를 눌러야 할지 금방 알겠더라고요.",
    "큰 타이포랑 포스터 비율이 영화 앱 같아서 눈에 들어왔어요. ‘이거 뭐지’ 하고 눌러보게 됐어요.",
    "특별히 거부감은 없었어요. 오히려 AI 뱃지 붙은 썸네일부터 눌러봤어요.",
    "네, 실사랑 애니랑 섞여 있으면 라벨이 있으면 고르기 훨씬 편할 것 같아요. 앞으로 한국어 더빙이나 현지 감성 작품이 늘면 비글루도 자주 켤 것 같고, 지금도 AI 드라마는 생각보다 작품성이 있어서 흥미로웠어요.",
]

assert len(MOCK_BODIES) == 29, len(MOCK_BODIES)


def parse_segments(path: Path) -> list[tuple[str, str, str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    out: list[tuple[str, str, str]] = []
    i = 0
    while i < len(lines):
        m = SPEAKER.match(lines[i])
        if not m:
            i += 1
            continue
        role, ts = m.group(1), m.group(2)
        i += 1
        while i < len(lines) and lines[i].strip() == "":
            i += 1
        body: list[str] = []
        while i < len(lines) and not SPEAKER.match(lines[i]):
            body.append(lines[i])
            i += 1
        out.append((role, ts, "\n".join(body).strip()))
    return out


def main() -> None:
    segs = parse_segments(SOURCE)
    pi = 0
    lines_out: list[str] = [
        "<!-- 모의 인터뷰 샘플: 홍길동은 가상 인물이며 실제 응답과 무관합니다. -->",
        "",
    ]
    for role, ts, body in segs:
        if role == "참여자":
            body = MOCK_BODIES[pi]
            pi += 1
        lines_out.append(f"{role}{ts}")
        lines_out.append("")
        lines_out.append(body)
        lines_out.append("")
    if pi != len(MOCK_BODIES):
        sys.exit(f"참여자 턴 수 불일치: 치환 {pi}개, MOCK {len(MOCK_BODIES)}개")
    OUT_MD.write_text("\n".join(lines_out).rstrip() + "\n", encoding="utf-8")
    print(f"작성: {OUT_MD}")
    r = subprocess.run(
        [sys.executable, str(DIR / "transcriptor.py"), str(OUT_MD), "--participant", "홍길동"],
        cwd=str(DIR),
    )
    if r.returncode != 0:
        sys.exit(r.returncode)
    print(f"완료: {DIR / '홍길동_녹취록.docx'}")


if __name__ == "__main__":
    main()
