#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""LG Poc2 엑셀(분류·질문 2열) → survey-draft.json. 아이폰 빌드와 동일: split_compound_question, probing_plan, branches 스키마."""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

import openpyxl

HERE = Path(__file__).resolve().parent
EXCEL_PATH = HERE / "AI모더2차_가입경험_조건_가이드라인_0326.xlsx"
OUT_JSON = HERE / "AI모더2차_가입경험_조건_가이드라인_0326-survey-draft.json"
NATURAL_JSON = HERE / "lg_poc2_natural_phrases.json"

NATURAL_PHRASES: dict = {}
if NATURAL_JSON.exists():
    NATURAL_PHRASES = json.loads(NATURAL_JSON.read_text(encoding="utf-8"))


def nid() -> str:
    return str(uuid.uuid4())


def split_compound_question(text: str) -> tuple[str, list[str]]:
    """`? `로 이어진 복합 질문을 나눈다. 첫 문장만 content, 나머지는 checklist."""
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


def make_question(
    content: str,
    readable_id: str,
    excel_q: str,
    root_note: str,
    checklist: list[str],
    branches: list[dict],
    probing_guide: str | None,
) -> dict:
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


def infer_probing_plan_generic(excel_q: str, chapter_title: str, raw_snippet: str) -> tuple[str, list[str], list[dict]]:
    root_note = f"[엑셀 {excel_q}] 분류: {chapter_title}"
    if len(raw_snippet) > 120:
        root_note += f" | 원문 일부: {raw_snippet[:117]}..."
    cl = [
        "참여자 발화를 한 줄 인용·확인한 뒤 다음 질문으로 넘어간다",
        "목표 인사이트가 나올 때까지 같은 주제 안에서 추가 질문으로 보완한다",
        "동일하거나 유사한 취지의 질문은 반복하지 않는다",
    ]
    return root_note, cl, []


def is_new_question_line(text: str) -> bool:
    t = text.strip()
    if t.startswith("※"):
        return True
    # 엑셀에 "1.최근에"처럼 점 뒤 공백 없는 경우가 많음
    if re.match(r"^\d+\.\s*", t) or re.match(r"^\d+\.\[", t):
        return True
    if re.match(r"^\d+\)\s*", t):
        return True
    return False


def is_checklist_line(text: str) -> bool:
    t = text.strip()
    return t.startswith("-") or t.startswith("ㄴ") or t.startswith("(e.g.")


def probing_key_for_raw(raw: str, counters: dict) -> tuple[str, str]:
    """(probing_guide 키, excel_q 라벨)"""
    t = raw.strip()
    if t.startswith("※"):
        counters["안내"] += 1
        n = counters["안내"]
        return f"[안내{n}]", f"안내{n}"
    counters["Q"] += 1
    n = counters["Q"]
    return f"[Q{n}]", f"Q{n}"


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


def build_from_excel() -> dict:
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    ws = wb["가이드라인"]
    rows = list(ws.iter_rows(values_only=True))

    interview_chapters: list = []
    ch_idx = 0
    topic_idx = 0
    q_global = 0

    current_chapter_title: str | None = None
    current_questions: list = []
    current_block: str | None = None
    pending_cl: list[str] = []
    counters = {"Q": 0, "안내": 0}

    def flush_open_block():
        nonlocal current_block, pending_cl, q_global, topic_idx
        if not current_block:
            pending_cl = []
            return
        raw = current_block.strip()
        pk, excel_q = probing_key_for_raw(raw, counters)
        natural = NATURAL_PHRASES.get(pk, raw)
        main_q, follow = split_compound_question(natural)
        extra_cl = list(pending_cl)
        pending_cl = []
        current_block = None

        rn, cl, br = infer_probing_plan_generic(excel_q, current_chapter_title or "일반", raw)
        merged = follow + extra_cl + cl
        q_global += 1
        topic_idx = max(topic_idx, 1)
        current_questions.append(
            make_question(
                main_q,
                f"question_{ch_idx}_{topic_idx}_{q_global}",
                excel_q,
                rn,
                merged,
                br,
                pk,
            )
        )

    def flush_chapter():
        nonlocal current_questions, ch_idx, topic_idx, q_global
        flush_open_block()
        if not current_questions:
            return
        interview_chapters.append(
            {
                "id": nid(),
                "readable_id": f"chapter_{ch_idx}",
                "title": current_chapter_title or f"챕터 {ch_idx}",
                "topics": [
                    {
                        "id": nid(),
                        "readable_id": f"topic_{ch_idx}_1",
                        "title": current_chapter_title or "토픽",
                        "questions": current_questions,
                    }
                ],
            }
        )
        current_questions = []
        topic_idx = 0
        q_global = 0

    for ri, row in enumerate(rows):
        if ri == 0:
            continue  # 헤더
        a = row[0] if len(row) > 0 else None
        b = row[1] if len(row) > 1 else None
        if b is None or (isinstance(b, str) and not b.strip()):
            continue
        b = str(b).strip()

        if a is not None and str(a).strip():
            new_title = " ".join(str(a).strip().split())
            if current_chapter_title is not None and new_title != current_chapter_title:
                flush_chapter()
                ch_idx += 1
            elif current_chapter_title is None:
                ch_idx = 1
            current_chapter_title = new_title

        if is_checklist_line(b):
            if current_block is not None:
                pending_cl.append(b)
            elif current_questions:
                pl = current_questions[-1]["probing_plan"]
                pos = len(pl["root_checklist"])
                pl["root_checklist"].append({"id": nid(), "text": b, "position": pos})
            continue

        if is_new_question_line(b):
            flush_open_block()
            current_block = b
            continue

        # continuation (이전 질문 블록에 합치기)
        if current_block is not None:
            current_block = current_block + "\n" + b
        elif current_questions:
            last = current_questions[-1]
            last["content"] = (last["content"] + "\n" + b).strip()
        else:
            current_block = b

    flush_open_block()
    flush_chapter()

    title = "AI모더 2차 · 가입경험 조건 가이드라인 (0326)"
    return {
        "survey_draft": {
            "title": title,
            "description": "LG U+ Poc2 · 엑셀 `AI모더2차_가입경험_조건_가이드라인_0326.xlsx` 가이드라인 시트 기반. 생성: build_lg_poc2_survey_draft.py",
            "welcome_title": "안녕하세요 인터뷰에 참여해 주셔서 감사합니다",
            "welcome_message": "오늘 인터뷰는 통신사 가입 경험과 가입 직후 경험에 대해 이야기 나눕니다.",
            "goal": "통신사 변경·가입 경로·매장/온라인 가입 경험, 가입 직후 2주간 경험, 안내·온보딩에 대한 인식을 파악한다",
            "target_audience": "최근 통신사를 변경·가입한 경험이 있는 사용자",
            "quota": None,
            "user_groups": [],
            "user_inputs": [{"id": nid(), "readable_id": "user_input_1", "label": "이름을 적어 주세요 (또는 닉네임)"}],
            "screener_questions": [],
            "interview_opening": "안녕하세요. 저는 오늘 인터뷰를 진행하는 AI 인터뷰어입니다.\n정답은 없으며, 경험하신 대로 편하게 말씀해 주시면 됩니다.\n준비되셨으면 '준비되었어요'라고 말씀해 주세요.",
            "interview_chapters": interview_chapters,
            "interview_closing": {
                "closing_message": "오늘 소중한 시간 내어 주셔서 감사합니다. 추가로 하실 말씀이 있으시면 짧게 말씀해 주시고, 없으시면 '없습니다'라고 해 주셔도 됩니다. 감사합니다."
            },
        }
    }


def main():
    data = build_from_excel()
    fix_typos(data)
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    nq = sum(
        len(t["questions"])
        for ch in data["survey_draft"]["interview_chapters"]
        for t in ch["topics"]
    )
    print(f"Wrote {OUT_JSON} ({nq} questions, {len(data['survey_draft']['interview_chapters'])} chapters)")


if __name__ == "__main__":
    main()
