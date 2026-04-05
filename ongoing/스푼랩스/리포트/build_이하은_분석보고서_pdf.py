#!/usr/bin/env python3
"""Generate branded PDF for 이하은 interview analysis (Spoon Labs asset logo)."""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

BASE = Path(__file__).resolve().parent.parent
LOGO = BASE / "asset" / "spoonlabs_logo.jpeg"
OUT = BASE / "리포트" / "이하은_인터뷰_분석보고서.pdf"

FONT = "/System/Library/Fonts/Supplemental/AppleGothic.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/AppleGothic.ttf"


def register_fonts():
    pdfmetrics.registerFont(TTFont("Ko", FONT))
    pdfmetrics.registerFont(TTFont("Ko-Bold", FONT_BOLD))


def styles():
    ss = getSampleStyleSheet()
    title = ParagraphStyle(
        "T",
        parent=ss["Normal"],
        fontName="Ko-Bold",
        fontSize=20,
        leading=26,
        textColor=colors.black,
        spaceAfter=8,
        alignment=TA_LEFT,
    )
    meta = ParagraphStyle(
        "M",
        parent=ss["Normal"],
        fontName="Ko",
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#444444"),
        spaceAfter=16,
    )
    h2 = ParagraphStyle(
        "H2",
        parent=ss["Normal"],
        fontName="Ko-Bold",
        fontSize=13,
        leading=18,
        textColor=colors.black,
        spaceBefore=14,
        spaceAfter=8,
    )
    body = ParagraphStyle(
        "B",
        parent=ss["Normal"],
        fontName="Ko",
        fontSize=10,
        leading=15,
        textColor=colors.HexColor("#222222"),
        spaceAfter=8,
    )
    insight = ParagraphStyle(
        "I",
        parent=body,
        leftIndent=8,
        borderColor=colors.HexColor("#cccccc"),
        borderWidth=0,
        borderPadding=8,
        backColor=colors.HexColor("#f7f7f7"),
        spaceBefore=4,
        spaceAfter=10,
    )
    small = ParagraphStyle(
        "S",
        parent=ss["Normal"],
        fontName="Ko",
        fontSize=8,
        textColor=colors.HexColor("#666666"),
        alignment=TA_CENTER,
    )
    return title, meta, h2, body, insight, small


def p(text, style):
    return Paragraph(text.replace("\n", "<br/>"), style)


def build_story(title, meta, h2, body, insight, small):
    story = []
    if LOGO.exists():
        img = Image(str(LOGO), width=44 * mm)
        story.append(img)
        story.append(Spacer(1, 6 * mm))
    story.append(p("스푼라디오 사용자 인터뷰 분석 보고서", title))
    story.append(
        p(
            "<b>대상:</b> 이하은 &nbsp;|&nbsp; <b>원본:</b> AI 인터뷰 트랜스크립트 &nbsp;|&nbsp; <b>형식:</b> 약 20분",
            meta,
        )
    )
    story.append(Spacer(1, 2 * mm))

    s1_title = "1. 요약"
    s1_body = """이하은 님은 <b>유튜버 추천</b>으로 스푼라디오를 처음 설치했고, <b>「듣기만 하는 플랫폼이 아니라 참여·관계 형성이 가능한 커뮤니티」</b>라는 인상을 핵심 가치로 인식합니다. <b>일방적 소비(유튜브 등)에 싫증</b>이 난 상태에서 <b>밤·고민·불면</b> 맥락에서 새로운 오디오 경험을 찾았습니다. 장기 사용 동기는 <b>채팅 참여로 콘텐츠를 같이 만든다는 느낌</b>, <b>특정 DJ·방 분위기·청취자 간 소통</b>입니다. <b>불만으로 이탈한 적은 없고</b>, 바쁠 때 <b>빈도만 줄었을 뿐 완전 중단은 없었다</b>고 합니다."""
    s1_insight = "추천은 <b>「새로움 + 감정적 공백(밤/고민)」</b> 맥락에서 효과적일 수 있으며, Spoon의 차별점은 <b>「듣기 + 참여 + 관계」</b>로 인지되는 경우가 많음."

    story.append(p(s1_title, h2))
    story.append(p(s1_body, body))
    story.append(p(f"<b>인사이트:</b> {s1_insight}", insight))

    story.append(p("2. 유입·첫인상", h2))
    tbl_data = [
        [
            p("<b>항목</b>", body),
            p("<b>내용</b>", body),
        ],
        [p("유입", body), p("유튜버가 스푼라디오를 추천", body)],
        [p("당시 상황", body), p("고민·불면 등으로 유튜브가 식상함, 새로운 시도 욕구", body)],
        [p("첫 매력", body), p("「유행」보다 서비스 자체의 매력 — 참여·관계·커뮤니티", body)],
        [
            p("대안 경험", body),
            p("팟캐스트·유튜브 오디오는 있었으나 적극적 소통·커뮤니티 형성 경험은 없음", body),
        ],
        [
            p("첫 사용 인상", body),
            p(
                "일방적 소비와 달리 실시간 반응·직접 참여·몰입; 익숙한 DJ·청취자가 생기며 습관적으로 접속",
                body,
            ),
        ],
    ]
    t = Table(tbl_data, colWidths=[32 * mm, 118 * mm])
    t.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(t)
    story.append(
        p(
            "<b>인사이트:</b> 추천은 「새로움 + 감정적 공백(밤/고민)」 맥락에서 효과적일 수 있으며, Spoon의 차별점은 「듣기 + 참여 + 관계」로 인지되는 경우가 많음.",
            insight,
        )
    )

    story.append(p("3. 지속 사용 이유(장기 리텐션)", h2))
    for line in [
        "<b>참여감:</b> 듣기만이 아니라 채팅으로 콘텐츠를 함께 만든다는 느낌.",
        "<b>관계·분위기:</b> 특정 DJ를 여러 명 꾸준히 듣되, 방 분위기·청취자 간 소통이 머무는 이유.",
        "<b>콘텐츠 자체:</b> 커뮤니티 참여 외에도, 좋아하는 DJ의 스토리·방송 자체가 재미라서 지속 청취.",
    ]:
        story.append(p(f"• {line}", body))
    story.append(
        p(
            "<b>인사이트:</b> 리텐션은 기능(라이브/채팅)과 감성(스토리·DJ 캐릭터·방 분위기)이 함께 작동한다는 신호.",
            insight,
        )
    )

    story.append(p("4. 사용 맥락·행동", h2))
    story.append(p("<b>시간·상황</b>", body))
    for line in [
        "하루 종일 집중 시청형은 아님.",
        "이동 중, 자기 전, 집에서 쉴 때 위주.",
        "자기 전·가볍게 듣기, 주말 집안일 시 배경음에 자주 사용.",
    ]:
        story.append(p(f"• {line}", body))
    story.append(p("<b>경쟁·대체</b>", body))
    story.append(
        p(
            "• 자기 전에는 대부분 스푼라디오. 집안일 등에는 신나는 노래(다른 음악 앱)도 병행 — 집중이 덜 필요한 활동에서는 음악이 대체.",
            body,
        )
    )
    story.append(p("<b>앱 내 행동</b>", body))
    for i, line in enumerate(
        [
            "메인에서 라이브 중 방송을 보고 제목·분위기·그날 기분으로 선택.",
            "들어가서 취향에 맞으면 유지, 아니면 다른 방으로 이동.",
            "라이브가 최우선; 시간이 안 맞으면 캐스트로 놓친 방송·재청취.",
            "채팅 참여로 소통을 늘리는 경우도 있음.",
        ],
        1,
    ):
        story.append(p(f"{i}. {line}", body))
    story.append(
        p(
            "<b>인사이트:</b> 「자기 전」은 Spoon에 유리한 슬롯으로 보이며, 집안일은 음악과 경쟁한다 — 시나리오별 포지셔닝(집중 vs 배경 vs 관계)이 분리됨.",
            insight,
        )
    )

    story.append(p("5. 불편·개선 요구", h2))
    for line in [
        "라이브 방송이 많아 원하는 스타일을 찾기 어려움.",
        "초기에는 DJ·콘텐츠를 몰라 맞는 콘텐츠를 찾는 데 시간을 많이 씀.",
        "취향 기반 추천을 더 자세하고 정교하게 해 달라는 기대.",
    ]:
        story.append(p(f"• {line}", body))
    story.append(
        p(
            "<b>인사이트:</b> 온보딩·탐색 비용이 실사용자 pain으로 확인됨. 추천·큐레이션·취향 학습이 성장·만족도에 직결될 수 있음.",
            insight,
        )
    )

    story.append(p("6. DJ 탐색·고정화", h2))
    for line in [
        "두루 탐방 + 애청 DJ 2~3명 구조.",
        "새 DJ 클릭 시: 기존과 다른 분위기·콘텐츠, 색다른 소통·재미 기대.",
        "「딱 맞는 DJ」 찾기는 어렵다고 인식 — 추천·입소문·우연 입장이 혼재.",
    ]:
        story.append(p(f"• {line}", body))
    story.append(p("<b>에피소드(고정화 트리거)</b>", body))
    story.append(
        p(
            "• DJ가 청취자 이름을 하나씩 불러 주며 소통한 경험이 인상적. 「양방향 소통의 장점」으로 인식, 채팅 참여 후 바로 반응해 몰입 → 이후 해당 DJ 고정 청취자로 이어짐.",
            body,
        )
    )
    story.append(
        p(
            "<b>인사이트:</b> 개인 호명·즉각 반응 같은 관계 신호가 강한 리텐션 트리거. 추천 알고리즘과 별도로 「관계형 순간」 설계가 가치 있음.",
            insight,
        )
    )

    story.append(p("7. 과금·수익 인식", h2))
    story.append(
        p(
            "• 마음에 드는 방에서 DJ와 소통하고 싶어 소액 후원 경험. 과금을 단순 소비가 아니라 콘텐츠 참여로 인식.",
            body,
        )
    )
    story.append(p("<b>원하는 과금·기능 아이디어</b>", body))
    story.append(
        p(
            "단순 후원 아이템 외에 방송 흐름에 영향을 줄 수 있는 참여형 과금(예: 주제 선택, 질문 투표 등).",
            body,
        )
    )
    story.append(
        p(
            "<b>인사이트:</b> 「참여의 확장」을 과금과 연결하는 수요가 있음 — 투표·주제권 등 인터랙티브 SKU 탐색 여지.",
            insight,
        )
    )

    story.append(p("8. 부록: 숏드라마", h2))
    story.append(
        p(
            "드라마박스를 주로 이용, 몰입해서 시청. 숏드라마에 대해 자극적·작위적 전개도 부담 없이 「마음 내려놓고 보는 콘텐츠」로 수용.",
            body,
        )
    )
    story.append(
        p(
            "<b>인사이트:</b> 본 인터뷰의 핵심은 Spoon이나, 짧고 몰입 가능한 서사 콘텐츠에 대한 수용도가 높음 — 크로스 프로모·콜라보 기획 시 참고 가능.",
            insight,
        )
    )

    story.append(p("9. 제품·리서치 시사점(정리)", h2))
    items9 = [
        "1. <b>가치 제안:</b> 「라디오/팟캐스트의 진화형」보다 참여·관계·커뮤니티가 기억에 남는 축.",
        "2. <b>온보딩:</b> 라이브 과다로 인한 탐색 피로 — 취향·DJ 매칭·초기 큐레이션이 우선 과제로 제기됨.",
        "3. <b>리텐션 레버:</b> DJ 스토리·방 분위기와 채팅·호명 등 관계 이벤트가 병행.",
        "4. <b>수익:</b> 후원을 참여의 연장으로 이해 — 투표·주제 등 방송에 영향을 주는 과금에 대한 자발적 아이디어 제시.",
        "5. <b>경쟁:</b> 같은 「배경 청취」 슬롯에서는 음악 앱과 공존·대체 — 시나리오별 메시지(수면·위로·관계 등)가 유리할 수 있음.",
    ]
    for it in items9:
        story.append(p(it, body))

    story.append(Spacer(1, 8 * mm))
    story.append(p("— Spoon Labs · User Insight —", small))
    return story


def on_page(canv, doc):
    canv.saveState()
    canv.setStrokeColor(colors.HexColor("#e0e0e0"))
    canv.setLineWidth(0.3)
    canv.line(20 * mm, 12 * mm, A4[0] - 20 * mm, 12 * mm)
    canv.setFont("Ko", 8)
    canv.setFillColor(colors.HexColor("#888888"))
    canv.drawRightString(A4[0] - 20 * mm, 10 * mm, str(doc.page))
    canv.restoreState()


def main():
    register_fonts()
    title, meta, h2, body, insight, small = styles()
    story = build_story(title, meta, h2, body, insight, small)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=16 * mm,
        title="이하은 인터뷰 분석 보고서",
        author="Spoon Labs",
    )
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"Wrote: {OUT}")


if __name__ == "__main__":
    main()
