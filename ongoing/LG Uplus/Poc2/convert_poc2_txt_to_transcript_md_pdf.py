#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LG U+ POC2 폴더의 원시 .txt 인터뷰를 녹취록 형식 .md + PDF로 변환합니다.
"""

from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE / "녹취록_정리"
FONT_PATH = Path("/System/Library/Fonts/Supplemental/AppleGothic.ttf")
FONT_NAME = "AppleGothic"

TURN_RE = re.compile(r"^\s*\[(AI 인터뷰어|사용자)\]:\s*(.*)$")
NAME_RE = re.compile(r"이름을\s*적어\s*주세요[^:：]*[:：]\s*(.+)$")


def extract_name(lines: list[str]) -> str:
    name = "참여자"
    for line in lines[:40]:
        nm = NAME_RE.search(line)
        if nm:
            name = nm.group(1).strip()
    return name


def dialogue_lines_only(text: str) -> list[str]:
    lines = text.splitlines()
    out: list[str] = []
    passed_sep = False
    for line in lines:
        if re.match(r"^-{10,}$", line.strip()):
            passed_sep = True
            continue
        if not passed_sep:
            continue
        out.append(line)
    if not out:
        out = lines
    return out


def parse_turns(lines: list[str]) -> list[tuple[str, str]]:
    turns: list[tuple[str, str]] = []
    role: str | None = None
    buf: list[str] = []
    for line in lines:
        m = TURN_RE.match(line)
        if m:
            if role is not None:
                turns.append((role, "\n".join(buf).strip()))
            role = "인터뷰어" if m.group(1) == "AI 인터뷰어" else "참여자"
            buf = [m.group(2)] if m.group(2) else []
        elif role is not None:
            buf.append(line.rstrip())
    if role is not None:
        turns.append((role, "\n".join(buf).strip()))
    return turns


DOC_TITLE = "LG U+ POC2"


def build_markdown(
    name: str,
    turns: list[tuple[str, str]],
) -> str:
    title = DOC_TITLE
    lines = [
        f"# {title}",
        "",
        "## 참여자 정보",
        "",
        f"- **이름(닉네임):** {name}",
        "",
        "---",
        "",
        "## 녹취 본문",
        "",
    ]
    for role, body in turns:
        if not body:
            continue
        label = "**인터뷰어**" if role == "인터뷰어" else "**참여자**"
        lines.append(f"### {label}")
        lines.append("")
        for para in body.split("\n\n"):
            p = para.strip()
            if p:
                lines.append(p)
                lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def register_font() -> None:
    if FONT_PATH.is_file():
        pdfmetrics.registerFont(TTFont(FONT_NAME, str(FONT_PATH)))


def build_pdf(
    pdf_path: Path,
    name: str,
    turns: list[tuple[str, str]],
) -> None:
    register_font()
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "T",
        parent=styles["Normal"],
        fontName=FONT_NAME,
        fontSize=14,
        leading=20,
        spaceAfter=12,
    )
    meta_style = ParagraphStyle(
        "M",
        parent=styles["Normal"],
        fontName=FONT_NAME,
        fontSize=10,
        leading=14,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "B",
        parent=styles["Normal"],
        fontName=FONT_NAME,
        fontSize=10,
        leading=15,
        spaceAfter=8,
    )
    label_style = ParagraphStyle(
        "L",
        parent=styles["Normal"],
        fontName=FONT_NAME,
        fontSize=11,
        leading=16,
        spaceBefore=10,
        spaceAfter=6,
    )

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
    )
    story: list = []

    story.append(Paragraph(_esc(DOC_TITLE), title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(_esc("참여자 정보"), label_style))
    story.append(Paragraph(_esc(f"이름(닉네임): {name}"), meta_style))
    story.append(Spacer(1, 8))
    story.append(Paragraph(_esc("녹취 본문"), label_style))

    for role, body in turns:
        if not body:
            continue
        lab = "인터뷰어" if role == "인터뷰어" else "참여자"
        story.append(Paragraph(_esc(f"【{lab}】"), label_style))
        for para in body.split("\n\n"):
            p = para.strip()
            if not p:
                continue
            # 줄바꿈은 <br/>로
            html = _esc(p).replace("\n", "<br/>")
            story.append(Paragraph(html, body_style))

    doc.build(story)


def txt_files_sorted() -> list[Path]:
    files = list(HERE.glob("*.txt"))
    # "N - ..." 번호로 정렬
    def key(p: Path) -> tuple[int, str]:
        m = re.match(r"^(\d+)\s*-\s*", p.name)
        return (int(m.group(1)) if m else 999, p.name)

    return sorted(files, key=key)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    files = txt_files_sorted()
    if not files:
        raise SystemExit("Poc2 폴더에 .txt 파일이 없습니다.")

    pdf_stems_used: set[str] = set()

    for idx, path in enumerate(files, start=1):
        raw = path.read_text(encoding="utf-8")
        lines = raw.splitlines()
        name = extract_name(lines)
        dlines = dialogue_lines_only(raw)
        turns = parse_turns(dlines)
        if not turns:
            print(f"경고: 턴을 찾지 못함 — {path.name}")
            continue

        safe_name = re.sub(r'[\\/:*?"<>|]', "_", name).strip()[:80] or "참여자"
        base = f"POC2_알수없는그룹_{idx:02d}_{safe_name}"
        md_path = OUT_DIR / f"{base}_녹취록.md"

        # PDF 파일명: {이름}.pdf (동명이인·충돌 시 {이름}_{번호})
        pdf_stem = safe_name
        if pdf_stem in pdf_stems_used:
            pdf_stem = f"{safe_name}_{idx}"
        pdf_stems_used.add(pdf_stem)
        pdf_path = OUT_DIR / f"{pdf_stem}.pdf"

        md_path.write_text(
            build_markdown(name, turns),
            encoding="utf-8",
        )
        build_pdf(pdf_path, name, turns)
        print(f"OK: {path.name} → {md_path.name}, {pdf_path.name}")


if __name__ == "__main__":
    main()
