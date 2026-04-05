#!/usr/bin/env python3
"""
프로젝트 루트의 UserResponses *.txt 파일을 읽어
참석자 ID를 추출하고, 나이스디앤알 폴더에 <ID>.md 로 저장한 뒤 원본 .txt 삭제.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent  # proby-sync
OUT_DIR = Path(__file__).resolve().parent  # 나이스디앤알

def main():
    pattern = re.compile(r"부여받으신 ID를 입력해주세요\.?\s*:\s*(\d+)", re.IGNORECASE)
    txt_files = list(ROOT.glob("* - UserResponses.table.table.unknownGroup.txt"))
    done = []
    for p in txt_files:
        text = p.read_text(encoding="utf-8", errors="replace")
        m = pattern.search(text)
        if not m:
            print(f"건너뜀 (ID 없음): {p.name}")
            continue
        pid = m.group(1)
        out_path = OUT_DIR / f"{pid}.md"
        suffix = 1
        while out_path.exists():
            suffix += 1
            out_path = OUT_DIR / f"{pid}_{suffix}.md"
        out_path.write_text(text, encoding="utf-8")
        done.append((str(p), out_path.name))
        p.unlink()
    for old, new in done:
        print(f"변환: {Path(old).name} -> {OUT_DIR.name}/{new}")
    print(f"총 {len(done)}개 변환 완료.")

if __name__ == "__main__":
    main()
