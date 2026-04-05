#!/usr/bin/env python3
"""
9명 MD(가이드라인_2차_질문별_응답정리_9명.md)에 참여자 J(이명욱), K(박지성) 열을 추가하고
11명 MD + 통합 CSV를 생성합니다.
"""

import csv
import re

from poc2_new_jk_columns import NEW_JK

BASE_PATH = "/Users/churryboy/proby-chris/proby-chris/60. 유저인사이트팀/LG Uplus/Poc2/"


def update_md():
    md_path = BASE_PATH + "가이드라인_2차_질문별_응답정리_9명.md"
    with open(md_path, "r", encoding="utf-8") as f:
        lines = f.read().split("\n")

    new_lines = []
    for line in lines:
        if "`9 - 알 수 없는 그룹.txt` (김건우)" in line and "응답 원본" in line:
            line = line.replace(
                "`9 - 알 수 없는 그룹.txt` (김건우)",
                "`9 - 알 수 없는 그룹.txt` (김건우), `10 - 알 수 없는 그룹.txt` (이명욱), `11 - 알 수 없는 그룹.txt` (박지성)",
            )
        elif "참여자 I (김건우)" in line and "| ID |" in line:
            line = line.rstrip()
            if not line.endswith("|"):
                line += " |"
            line = line[:-1] + "| 참여자 J (이명욱) | 참여자 K (박지성) |"
        elif (
            re.match(r"^\|----", line)
            and "참여자" not in line
            and "항목" not in line
            and "표기" not in line
            and "ID" not in line
            and "------" in line
        ):
            if line.count("|") >= 8:
                line = line.rstrip()
                if not line.endswith("|"):
                    line += "|"
                line = line + "-------------------|-------------------|"
        elif re.match(r"^\| \*\*Q", line):
            q_match = re.search(r"\*\*(Q[\d-]+)\*\*", line)
            if q_match:
                q_id = q_match.group(1)
                if q_id in NEW_JK:
                    j_cell = NEW_JK[q_id]["J"]
                    k_cell = NEW_JK[q_id]["K"]
                    line = line.rstrip()
                    if line.endswith("|"):
                        line = line[:-1].rstrip()
                    line += f" | {j_cell} | {k_cell} |"

        new_lines.append(line)

    updated = "\n".join(new_lines)
    updated = updated.replace("질문별 응답 정리 (9명)", "질문별 응답 정리 (11명)")

    out_path = BASE_PATH + "가이드라인_2차_질문별_응답정리_11명.md"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(updated)
    print(f"✅ MD 저장 완료: {out_path}")
    return out_path


def clean_cell(text):
    text = text.replace("<br/>", "\n").replace("<br />", "\n")
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = text.replace("「", '"').replace("」", '"')
    text = text.strip().strip("|").strip()
    return text


def generate_csv(md_11_path):
    section_map = {
        **{f"Q{i}": "Q1~Q10" for i in range(1, 11)},
        **{f"Q{i}": "Q11~Q20" for i in range(11, 21)},
        **{f"Q{i}": "Q21~Q30" for i in range(21, 31)},
        **{f"Q{i}": "Q31~Q39" for i in range(31, 40)},
        **{f"Q{i}": "Q41~Q45" for i in range(41, 46)},
        **{f"Q{i}": "Q46~Q54" for i in range(46, 55)},
        "Q4-1": "Q1~Q10",
        "Q4-2": "Q1~Q10",
    }

    headers = [
        "섹션",
        "ID",
        "질문",
        "전수현(A)",
        "이연진(B)",
        "황수경(C)",
        "김영균(D)",
        "김남호(E)",
        "이민슷(F)",
        "조수정(G)",
        "엄지(H)",
        "김건우(I)",
        "이명욱(J)",
        "박지성(K)",
    ]

    def q_sort_key(q):
        m = re.match(r"Q(\d+)(?:-(\d+))?", q)
        if m:
            main = int(m.group(1))
            sub = int(m.group(2)) if m.group(2) else 0
            return (main, sub)
        return (999, 0)

    with open(md_11_path, "r", encoding="utf-8") as f:
        content = f.read()

    full_rows = {}
    for line in content.split("\n"):
        m = re.match(r"^\| \*\*(Q[\d-]+)\*\* \|(.+)", line)
        if not m:
            continue
        q_id = m.group(1)
        rest = m.group(2)
        parts = [p.strip() for p in rest.split(" | ")]
        while parts and parts[-1] == "":
            parts.pop()
        # 질문 1열 + 참여자 A~K 11열 = 12열
        if len(parts) < 12:
            continue
        full_rows[q_id] = parts

    all_q_ids = sorted(full_rows.keys(), key=q_sort_key)

    csv_path = BASE_PATH + "가이드라인_2차_질문별_응답정리_11명_통합.csv"
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        writer.writerow(headers)

        for q_id in all_q_ids:
            section = section_map.get(q_id, "기타")
            fr = full_rows[q_id]
            question = clean_cell(fr[0])
            cells = [clean_cell(fr[i]) for i in range(1, 12)]
            writer.writerow([section, q_id, question, *cells])

    print(f"✅ CSV 저장 완료: {csv_path}")
    return csv_path


if __name__ == "__main__":
    md11 = update_md()
    csv_out = generate_csv(md11)
    print("\n완료!")
    print(f"  MD  → {md11}")
    print(f"  CSV → {csv_out}")
