#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""`가이드라인_2차_md.md`(전체질문 필드정리 형식) → `survey_draft` JSON."""

from __future__ import annotations

import importlib.util
import json
import re
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent

_build_path = HERE / "build_lg_guideline_2nd_survey_draft.py"
_spec = importlib.util.spec_from_file_location("_lg_build", _build_path)
assert _spec and _spec.loader
_lg = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_lg)
SEGMENT_BRIDGE_CONTENT = _lg.SEGMENT_BRIDGE_CONTENT
strip_leading_segment_lines = _lg.strip_leading_segment_lines
split_compound_question = _lg.split_compound_question
MD_PATH = HERE / "가이드라인_2차_md.md"
BASE_JSON = HERE / "가이드라인_2차-survey-draft.json"
OUT_JSON = HERE / "가이드라인_2차-survey-draft.json"

ROOT_NOTE = "동일하거나 유사한 취지의 질문은 반복하지 않는다"
QUOTA = 10


def nid() -> str:
    return str(uuid.uuid4())


def extract_content(body: str) -> str:
    m = re.search(r"### content\s*\n\n```text\n(.*?)```", body, re.DOTALL)
    return m.group(1).strip() if m else ""


def extract_checklist(body: str) -> list[str]:
    m = re.search(r"### root_checklist\s*\n\n(.*?)(?=### 조사자 참고)", body, re.DOTALL)
    if not m:
        return []
    block = m.group(1).strip()
    if "_(없음)_" in block or not block:
        return []
    items: list[str] = []
    for line in block.splitlines():
        line = line.strip()
        if re.match(r"^\d+\.\s+", line):
            items.append(re.sub(r"^\d+\.\s+", "", line).strip())
    return items


def extract_branches(body: str) -> list[tuple[str, str]]:
    m = re.search(r"### branches[^\n]*\n\n(.*)", body, re.DOTALL)
    if not m:
        return []
    block = m.group(1)
    if "\n---" in block:
        block = block.split("\n---", 1)[0]
    block = block.strip()
    pairs: list[tuple[str, str]] = []
    for m2 in re.finditer(
        r"(\d+)\.\s+\*\*if:\*\*\s*(.+?)\n\s*\*\*팔로업:\*\*\s*(.+?)(?=\n\d+\.\s+\*\*if:\*\*|\Z)",
        block,
        re.DOTALL,
    ):
        iff = m2.group(2).strip().replace("\n", " ")
        fu = m2.group(3).strip().replace("\n", " ")
        pairs.append((iff, fu))
    return pairs


def parse_sections(md: str) -> list[dict]:
    pat = re.compile(r"^## (\d+)\. `([^`]+)` — (.+)$", re.MULTILINE)
    matches = list(pat.finditer(md))
    out: list[dict] = []
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(md)
        body = md[start:end]
        out.append(
            {
                "ord": int(m.group(1)),
                "excel_q": m.group(2).strip(),
                "chapter_title": m.group(3).strip(),
                "body": body,
            }
        )
    return out


def build_question(
    content: str,
    readable_id: str,
    excel_q: str,
    checklist_texts: list[str],
    branch_pairs: list[tuple[str, str]],
    segment_note: str = "",
) -> dict:
    branches: list[dict] = []
    for pos, (iff, fu) in enumerate(branch_pairs):
        branches.append(
            {
                "id": nid(),
                "if": iff,
                "note": segment_note,
                "position": pos,
                "checklist": [{"id": nid(), "text": fu, "position": 0}],
                "branches": [],
            }
        )
    rc = [{"id": nid(), "text": t, "position": j} for j, t in enumerate(checklist_texts)]
    return {
        "id": nid(),
        "readable_id": readable_id,
        "content": content,
        "question_type": "open_text",
        "options": None,
        "rating_min": None,
        "rating_max": None,
        "probing_guide": f"[{excel_q}]",
        "probing_plan": {
            "root_note": ROOT_NOTE,
            "root_checklist": rc,
            "branches": branches,
        },
        "response_type": "episode",
        "duration_sec": 45,
        "media": [],
    }


def main() -> None:
    md = MD_PATH.read_text(encoding="utf-8")
    sections = parse_sections(md)
    if not sections:
        raise SystemExit(f"No sections found in {MD_PATH}")

    chapters: list[dict] = []
    ch_idx = 0
    current_title: str | None = None
    current_questions: list[dict] = []
    q_in_ch = 0

    def flush() -> None:
        nonlocal ch_idx, current_title, current_questions, q_in_ch
        if not current_questions or current_title is None:
            current_questions = []
            q_in_ch = 0
            return
        ch_idx = max(ch_idx, 1)
        chapters.append(
            {
                "id": nid(),
                "readable_id": f"chapter_{ch_idx}",
                "title": current_title,
                "topics": [
                    {
                        "id": nid(),
                        "readable_id": f"topic_{ch_idx}_1",
                        "title": current_title,
                        "questions": current_questions,
                    }
                ],
            }
        )
        current_questions = []
        q_in_ch = 0

    for sec in sections:
        title = sec["chapter_title"]
        if current_title is None:
            current_title = title
            ch_idx = max(ch_idx, 1)
        elif title != current_title:
            flush()
            ch_idx += 1
            current_title = title

        body = sec["body"]
        content = extract_content(body)
        if not content:
            continue
        checklist = extract_checklist(body)
        branch_pairs = extract_branches(body)
        segment_note, body_after = strip_leading_segment_lines(content)
        segment_note = segment_note.strip()
        display_content = content
        seg_note_for_branches = ""
        if segment_note:
            display_content = SEGMENT_BRIDGE_CONTENT
            main_q, probes_body, _ = split_compound_question(body_after)
            forced = main_q.strip()
            branch_pairs = [(iff, forced) for iff, _ in branch_pairs]
            for p in probes_body:
                if p and p not in checklist:
                    checklist.append(p)
            seg_note_for_branches = segment_note
        q_in_ch += 1
        rid = f"question_{ch_idx}_{1}_{q_in_ch}"
        current_questions.append(
            build_question(
                display_content,
                rid,
                sec["excel_q"],
                checklist,
                branch_pairs,
                segment_note=seg_note_for_branches,
            )
        )

    flush()

    base = json.loads(BASE_JSON.read_text(encoding="utf-8"))
    sd = base["survey_draft"]
    sd["interview_chapters"] = chapters
    sd["quota"] = QUOTA
    sd["description"] = (
        "LG U+ Poc2 · `가이드라인_2차_md.md`(전체질문 필드정리)에서 파싱. "
        "생성: md_layout_to_survey_draft.py · %가이드라인 규칙(root_note·branch 스키마·quota=10)."
    )

    OUT_JSON.write_text(json.dumps(base, ensure_ascii=False, indent=2), encoding="utf-8")
    nq = sum(len(t["questions"]) for ch in chapters for t in ch["topics"])
    print(f"Wrote {OUT_JSON} ({nq} questions, {len(chapters)} chapters, quota={QUOTA})")


if __name__ == "__main__":
    main()
