#!/usr/bin/env python3
"""
나이스디앤알 인터뷰 녹취록에서 응답자(사용자) 발화량이 많은 순으로 상위 20개 파일을 추립니다.
발화량 = [사용자]: 뒤에 오는 텍스트의 총 글자 수(공백 포함).
"""

import re
from pathlib import Path

BASE = Path(__file__).resolve().parent


def is_interview_file(name: str) -> bool:
    if not name.endswith(".md"):
        return False
    stem = name[:-3]
    if stem in ("가이드라인", "나이스디앤알_인터뷰_통합_보고서", "나이스디앤알_인터뷰_통합_보고서_v2",
                "나이스디앤알_인터뷰_통합_보고서_v3", "나이스디앤알_인터뷰_통합_보고서_v4",
                "나이스디앤알_인터뷰_통합_보고서_v4-1", "나이스디앤알_인터뷰_분석_보고서",
                "나이스디앤알_반복질문_집계"):
        return False
    if stem.startswith("나이스디앤알_"):
        return False
    return stem.isdigit() or (len(stem) <= 4 and stem.isdigit())


def count_respondent_utterance(content: str) -> int:
    """[사용자]: 뒤의 텍스트만 합쳐서 총 글자 수 반환."""
    total = 0
    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("[사용자]:"):
            text = line[len("[사용자]:"):].strip()
            total += len(text)
    return total


def main():
    files_volume = []
    for p in sorted(BASE.iterdir(), key=lambda x: x.name):
        if not p.is_file() or not is_interview_file(p.name):
            continue
        try:
            content = p.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        chars = count_respondent_utterance(content)
        files_volume.append((p.name, chars))

    # 발화량 내림차순 정렬
    files_volume.sort(key=lambda x: -x[1])
    top20 = files_volume[:20]

    print("=== 응답자(사용자) 발화량 상위 20개 파일 ===\n")
    print(f"{'순위':<4} {'파일명':<12} {'발화량(글자수)':>14}")
    print("-" * 34)
    for i, (name, chars) in enumerate(top20, 1):
        print(f"{i:<4} {name:<12} {chars:>14,}")
    return top20


if __name__ == "__main__":
    main()
