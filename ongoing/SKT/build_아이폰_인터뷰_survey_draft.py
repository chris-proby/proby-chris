#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""엑셀 가이드라인 → survey-draft.json (오디오 양식: branches = if/note/position/checklist/branches)."""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

import openpyxl

EXCEL_PATH = Path("/Users/churryboy/Downloads/아이폰 고객 인터뷰_가이드라인_초안_0319_0.5 (2).xlsx")
OUT_JSON = Path(__file__).resolve().parent / "아이폰-고객-인터뷰-가이드라인-초안-survey-draft.json"
NATURAL_JSON = Path(__file__).resolve().parent / "iphone_natural_phrases.json"

CHAPTERS = [
    (1, 10, "오프닝 · 아이폰 및 통신사 기초"),
    (10, 57, "통신사 가입 여정"),
    (57, 92, "통신사 이용 경험 · 심화"),
]

NATURAL_PHRASES: dict = json.loads(NATURAL_JSON.read_text(encoding="utf-8"))


def nid() -> str:
    return str(uuid.uuid4())


def cell(r, i: int):
    if r is None or i >= len(r):
        return None
    v = r[i]
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        return s if s else None
    return v


def is_empty_row(r) -> bool:
    if not r:
        return True
    return all(cell(r, i) is None for i in range(6))


def split_compound_question(text: str) -> tuple[str, list[str]]:
    """`? `로 이어진 복합 질문을 나눈다. 첫 문장만 질문 content로, 나머지는 checklist(추가 질문)로."""
    text = (text or "").strip()
    if not text or "?" not in text:
        return text, []
    parts = re.split(r"\?\s+", text)
    if len(parts) == 1:
        return text, []

    main = parts[0].strip() + "?"

    followups: list[str] = []

    def flush_segment(seg: str) -> None:
        seg = seg.strip()
        if not seg:
            return
        sub = re.split(r"\?\s+", seg)
        if len(sub) == 1:
            followups.append(seg)
        else:
            followups.append(sub[0].strip() + "?")
            for s in sub[1:]:
                flush_segment(s)

    for segment in parts[1:]:
        flush_segment(segment)

    return main, followups


def make_branch(if_str: str, position: int, checklist_texts: list[str], note: str = "") -> dict:
    """오디오 플랫폼 survey-draft와 동일: if, note, position, checklist[], branches []."""
    return {
        "id": nid(),
        "if": if_str,
        "note": note,
        "position": position,
        "checklist": [{"id": nid(), "text": t, "position": i} for i, t in enumerate(checklist_texts)],
        "branches": [],
    }


def infer_probing_plan(excel_q: str, content: str, b: str | None, c: str | None, note_f: str | None) -> tuple[str, list[str], list[dict]]:
    t = content or ""
    rn_parts: list[str] = [f"[엑셀 {excel_q}]"]
    if b:
        rn_parts.append(f"분류: {b}")
    if c:
        rn_parts.append(f"상세: {c}")
    if note_f:
        rn_parts.append(f"비고: {note_f}")
    root_note = " ".join(rn_parts)

    cl: list[str] = []
    br: list[dict] = []

    if excel_q == "Q1":
        cl = [
            "아이폰을 쓰기 시작한 시점이 말로 특정된다",
            "아이폰을 택한 이유·전환 계기가 한 가지 이상 구체적으로 나온다",
        ]
    elif excel_q == "Q2":
        cl = [
            "아이폰 외 애플 기기 보유 여부와 유료 구독 서비스가 각각 정리되어 말해진다",
        ]
    elif excel_q == "Q3":
        cl = [
            "기변 주기·이번에 바꾼 계기·이전 단말 처리 방식(보상판매·중고 등)이 빠지지 않았는지 확인한다",
        ]
    elif excel_q == "Q4":
        cl = [
            "데이터 이전·백업·관리 방식이 실제 행동 수준으로 설명된다",
        ]
    elif excel_q == "Q9":
        br = [
            make_branch(
                "통신사를 먼저 정했다고 말한 경우",
                0,
                [
                    "통신사 인지·탐색(Q12~Q16)을 단말기 결정보다 먼저 깊게 진행한다",
                    "첫 접점(Q10)과 연결해 순서를 재확인한다",
                ],
            ),
            make_branch(
                "아이폰(단말)을 먼저 정했다고 말한 경우",
                1,
                [
                    "단말기 결정(Q17~Q24)을 통신사 인지·탐색(Q12~Q16)보다 먼저 깊게 진행한다",
                ],
            ),
            make_branch(
                "두 가지를 동시에·반복하며 정했다고 말한 경우",
                2,
                [
                    "실제 시간 순서대로 경험을 재구성해 질문 순서를 맞춘다",
                ],
            ),
        ]
        cl = [
            "결정 순서(통신사 우선 vs 단말 우선)가 한 문장으로 드러나는지 확인한다",
            "그 순서를 택한 이유·고민이 구체적으로 나올 때까지 추가 질문한다",
            "첫 접점 채널(Q10)과 연결해 ‘가장 먼저 한 행동’이 말로 확보되면 다음으로 넘어간다",
        ]
    elif excel_q == "Q15":
        br = [
            make_branch(
                "가입혜택·NW·멤버십·이슈 등 특정 키워드가 답에 나온 경우",
                0,
                [
                    "해당 키워드가 실제 의사결정에서 얼마나 가중됐는지 한 가지씩 깊게 묻는다",
                ],
            ),
        ]
        cl = [
            "지금 통신사를 선택한 ‘결정적 이유’가 1개 이상 명확히 말해질 때까지 프로빙한다",
            "엑셀 괄호에 있는 후보(가입혜택·사건·NW·멤버십 등) 중 해당하는 것이 있는지 확인한다",
        ]
    elif excel_q == "Q25":
        br = [
            make_branch(
                "온라인(공홈·앱·비대면)으로 가입했다고 말한 경우",
                0,
                [
                    "배송·수령·지연·안내(Q29~Q36) 블록을 심층 진행한다",
                ],
            ),
            make_branch(
                "매장·오프라인 위주로 가입했다고 말한 경우",
                1,
                [
                    "배송 블록은 축소하고 매장 대면·수령 경험으로 질문을 대체한다",
                ],
            ),
        ]
        cl = [
            "가입에 사용한 채널(온라인/오프라인·공식/대리)이 구체적으로 밝혀질 때까지 추가 질문한다",
            "최종적으로 가입을 마친 경로가 한 줄로 설명되면 다음 단계로 넘어간다",
        ]
    elif excel_q == "Q29":
        br = [
            make_branch(
                "온라인 가입이 아니었다고 확인된 경우",
                0,
                [
                    "Q29~Q36은 생략·축소하고 매장 수령·현장 개통 경험으로 전환한다",
                ],
            ),
        ]
        cl = [
            "가입신청부터 단말기 수령까지 실제 소요 시간이 구간별로 말로 특정된다",
            "지연이 있었다면 불만 강도 척도(①~④)와 통신사 케어 기대가 연결되어 나온다",
        ]
    elif excel_q in ("Q6", "Q8"):
        cl = [
            "추천 의향(NPS) 점수를 숫자(또는 명확한 척도)로 말하게 한다",
            "그 점수를 준 이유를 최소 한 가지 이상 구체적으로 말하게 한다",
            "점수를 올리려면 통신사가 무엇을 해야 하는지(또는 어떤 경험이 필요했는지)를 묻는다",
        ]
    elif excel_q in ("Q5", "Q7"):
        cl = [
            "이용 기간·요금제·결합·납부 방식이 각각 말로 정리될 때까지 추가 질문한다",
            "이전(Q7)·현재(Q5)를 구분해 말하도록 유도한다",
            "숫자·기간이 애매하면 대략 시점으로라도 특정한다",
        ]
    elif excel_q == "Q18":
        cl = [
            "단말기 구매의 1순위 결정 요인이 한 가지로 특정된다",
            "그 요인만 충족되면 다른 모델·OS도 수용 가능했는지 여부가 밝혀진다",
            "재고·배송일·색상·용량·혜택 등 실무 조건과의 트레이드오프가 언급되면 추가 질문한다",
        ]
    elif excel_q == "Q42":
        cl = [
            "개통 직후 ‘가장 먼저’ 받은 안내의 채널·내용·느낌이 구체적으로 나온다",
            "가입 후 2주 안에 받은 안내를 가능한 한 많이 열거하게 하고, 그중 효과적이었던 것을 고른다",
            "엑셀 예시(설정·데이터이전·요금·결합·구독·멤버십·보안 등) 중 해당 경험이 있는지 확인한다",
        ]
    elif excel_q == "Q48":
        cl = [
            "이전 통신사 이용 기간과 현재 통신사 이용 기간이 말 속에서 정리된다",
            "통신서비스에서 ‘가장 중요한 가치’가 OPEN으로 먼저 나온 뒤, 필요 시 보조 카테고리(NW·혜택 등)로 좁힌다",
            "이전 통신사와 비교해 무엇이 달라졌는지 한 문장 이상 나온다",
        ]
    elif excel_q == "추가":
        if "아이폰 고객만" in t:
            cl = [
                "‘아이폰 전용’ 혜택이 있다고 느끼는지 여부와 근거가 말로 나온다",
                "없다고 하면 왜 그렇게 인지하는지 한 가지 이상 묻는다",
            ]
        else:
            cl = [
                "질문 의도(아이폰 활용·혜택 니즈)가 말로 확보될 때까지 추가 질문한다",
            ]
    elif excel_q == "Q80":
        br = [
            make_branch(
                "익시오와 에이닷을 둘 다 써 봤다고 말한 경우",
                0,
                [
                    "Q82 비교 질문(차이·선호)을 반드시 진행한다",
                ],
            ),
            make_branch(
                "한쪽만 써 봤다고 말한 경우",
                1,
                [
                    "비교 질문은 생략하고 긍정·부정 경험 한 가지씩만 확보한다",
                ],
            ),
        ]
        cl = [
            "앱 인지 여부·실제 사용 여부가 명확히 구분되어 말해진다",
            "사용 경험이 있다면 부정·긍정 사례를 각각 한 가지 이상 확보한다",
        ]
    elif "NPS" in t or "추천의향" in t:
        cl = [
            "점수·척도와 이유가 한 흐름으로 연결되도록 추가 질문한다",
            "사전에 다른 질문에서 준 점수와의 일관성을 필요 시 확인한다",
        ]
    elif "이전" in t and "현재" in t and "각각" in t:
        cl = [
            "이전 통신사와 현재 통신사에 대해 각각 한 가지 이상 사례가 나오도록 한다",
            "두 경험을 한 문장으로 비교할 수 있게 정리해 보도록 유도한다",
        ]
    elif "불편" in t or "불만" in t or "긍정" in t:
        cl = [
            "사건의 시점·장소·강도(척도)가 가능하면 구체적으로 나오게 한다",
            "원인을 통신사·단말·환경 중 어디에 두는지 확인한다",
        ]
    else:
        cl = [
            "이 시드만으로 목표 정보가 부족하면, 같은 주제 안에서 추가 질문으로 보완한다",
            "참여자 발화를 한 줄 인용·확인한 뒤 다음 질문으로 넘어간다",
        ]

    return root_note, cl, br


def parse_rows(ws):
    return list(ws.iter_rows(values_only=True))


def build_survey(rows):
    interview_chapters = []
    for ch_idx, (start, end, ch_title) in enumerate(CHAPTERS, start=1):
        topics = parse_chapter_rows(rows, start, end, ch_idx)
        if topics:
            interview_chapters.append(
                {
                    "id": nid(),
                    "readable_id": f"chapter_{ch_idx}",
                    "title": ch_title,
                    "topics": topics,
                }
            )

    return {
        "survey_draft": {
            "title": "아이폰 고객 인터뷰 가이드라인 (초안 0319)",
            "description": "엑셀 가이드라인_0319 + checklist·branch(오디오 양식). 생성: build_아이폰_인터뷰_survey_draft.py / iphone_natural_phrases.json",
            "welcome_title": "안녕하세요 인터뷰에 참여해 주셔서 감사합니다",
            "welcome_message": "오늘 인터뷰는 약 2시간 분량으로 설계되어 있으며, 구간별로 나누어 진행될 수 있습니다.",
            "goal": "아이폰 이용 맥락과 통신사 가입·이용 여정에서의 인지·탐색·구매·개통·온보딩·이용 경험을 파악하고, 이전·현재 통신사 비교 관점에서 니즈와 NPS·추천에 영향을 준 요인을 이해한다",
            "target_audience": "아이폰을 주 단말로 사용 중이거나 최근 가입·기변한 통신사 고객",
            "quota": None,
            "user_groups": [],
            "user_inputs": [{"id": nid(), "readable_id": "user_input_1", "label": "이름을 적어 주세요 (또는 닉네임)"}],
            "screener_questions": [],
            "interview_opening": "안녕하세요. 저는 오늘 인터뷰를 진행하는 AI 인터뷰어입니다.\n정답은 없으며, 경험하신 대로 편하게 말씀해 주시면 됩니다. 이전 통신사와 현재 통신사를 비교해 답해 주시는 구간이 있습니다.\n준비되셨으면 '준비되었어요'라고 말씀해 주세요.",
            "interview_chapters": interview_chapters,
            "interview_closing": {
                "closing_message": "오늘 소중한 시간 내어 주셔서 감사합니다. 추가로 하실 말씀이 있으시면 짧게 말씀해 주시고, 없으시면 '없습니다'라고 해 주셔도 됩니다. 감사합니다."
            },
        }
    }


def make_question(content, readable_id, excel_q: str, root_note: str, checklist: list[str], branches: list[dict], probing_guide: str | None):
    pp = {"root_note": root_note, "root_checklist": [], "branches": branches or []}
    for pos, text in enumerate(checklist):
        pp["root_checklist"].append({"id": nid(), "text": text, "position": pos})
    return {
        "id": nid(),
        "readable_id": readable_id,
        "content": content.strip(),
        "question_type": "open_text",
        "options": None,
        "rating_min": None,
        "rating_max": None,
        "probing_guide": probing_guide,
        "probing_plan": pp,
        "response_type": "episode",
        "duration_sec": 45,
        "media": [],
    }


def parse_chapter_rows(rows, start_row: int, end_row: int, ch_num: int):
    current_questions: list = []
    current_title = None
    topics: list = []
    topic_counter = 0
    q_counter = 0
    prev_anchor = None
    last_q = None
    counters = {"안내": 0, "추가": 0, "보조": 0}

    def flush_topic():
        nonlocal current_questions, current_title, topic_counter
        if not current_questions:
            return
        topic_counter += 1
        topics.append(
            {
                "id": nid(),
                "readable_id": f"topic_{ch_num}_{topic_counter}",
                "title": current_title or f"토픽 {topic_counter}",
                "questions": current_questions,
            }
        )
        current_questions = []

    def probing_key_for(excel_q_infer: str) -> str:
        if excel_q_infer == "안내":
            counters["안내"] += 1
            return f"[안내{counters['안내']}]"
        if excel_q_infer == "추가":
            counters["추가"] += 1
            return f"[추가{counters['추가']}]"
        if excel_q_infer == "보조":
            counters["보조"] += 1
            return f"[보조{counters['보조']}]"
        return f"[{excel_q_infer}]"

    def push_question(raw_content: str, excel_q_infer: str, b, c, f):
        nonlocal q_counter, last_q
        q_counter += 1
        pk = probing_key_for(excel_q_infer)
        natural = NATURAL_PHRASES.get(pk, raw_content)
        main_q, followup_qs = split_compound_question(natural)
        rn, cl, br = infer_probing_plan(excel_q_infer, raw_content, b, c, f)
        merged_checklist = followup_qs + cl
        last_q = make_question(
            main_q,
            f"question_{ch_num}_{topic_counter+1}_{q_counter}",
            excel_q_infer,
            rn,
            merged_checklist,
            br,
            pk,
        )
        current_questions.append(last_q)

    for ri in range(start_row, end_row):
        r = rows[ri]
        if is_empty_row(r):
            continue
        a, b, c, d, e, f = [cell(r, i) for i in range(6)]
        qid = str(a).strip() if a else ""
        is_q = bool(re.match(r"^(Q\d+|추가)\b", qid, re.I)) or (a and str(a).strip() == "추가")

        if is_q and d:
            excel_q = qid if qid else "Q?"
            anchor = b or c
            if anchor and anchor != prev_anchor:
                flush_topic()
                prev_anchor = anchor
                current_title = anchor
            elif not current_questions:
                current_title = anchor or prev_anchor or "일반"
                if anchor:
                    prev_anchor = anchor
            push_question(str(d), excel_q, b, c, f)
            continue

        if not is_q and d:
            text = str(d).strip()
            anchor = b or c
            if anchor and anchor != prev_anchor:
                flush_topic()
                prev_anchor = anchor
                current_title = anchor
            elif not current_questions:
                current_title = anchor or prev_anchor or "일반"
                if anchor:
                    prev_anchor = anchor

            if text.startswith("-"):
                if last_q is None:
                    push_question(text.lstrip("- ").strip(), "보조", b, c, f)
                else:
                    pl = last_q["probing_plan"]
                    pos = len(pl["root_checklist"])
                    pl["root_checklist"].append({"id": nid(), "text": text.lstrip("- ").strip(), "position": pos})
                continue

            push_question(text, "안내", b, c, f)

    flush_topic()
    return topics


def fix_typos(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "content" and isinstance(v, str):
                obj[k] = v.replace("무엇기 가장", "무엇이 가장").replace("무엇기 ", "무엇이 ")
            else:
                fix_typos(v)
    elif isinstance(obj, list):
        for x in obj:
            fix_typos(x)


def main():
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    rows = parse_rows(wb["가이드라인_0319"])
    data = build_survey(rows)
    fix_typos(data)
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    qc = sum(len(t["questions"]) for ch in data["survey_draft"]["interview_chapters"] for t in ch["topics"])
    print(f"Wrote {OUT_JSON} ({qc} questions)")


if __name__ == "__main__":
    main()
