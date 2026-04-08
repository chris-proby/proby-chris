# -*- coding: utf-8 -*-
"""sk-2: self.csv + metadata.csv -> 2차/{이름}_{GUID}.md (대표 성공경험 + 에세이 6문항)"""
import csv
import os
import re
from difflib import SequenceMatcher

BASE = os.path.dirname(os.path.abspath(__file__))
META = os.path.join(BASE, "metadata.csv")
INPUT = os.path.join(BASE, "self.csv")
OUT_DIR = os.path.join(BASE, "2차")
os.makedirs(OUT_DIR, exist_ok=True)

REF_SK2 = re.compile(
    r"앞서\s|앞\s*단에\s*내용이\s*상당\s*부분\s*중복|앞에서\s*여러\s*차례\s*기술한|위에서\s*설명|위에서\s*기술|앞의\s",
    re.I,
)


def parse_metadata():
    level_meta = {}
    essay_meta = {}
    check_meta_by_sub = {}
    check_meta_by_exp = {}

    with open(META, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))

    for r in rows:
        if len(r) < 2:
            continue
        k = r[1].strip() if len(r) > 1 else ""
        if k.startswith("성공경험수준") and len(r) >= 4:
            key = k.replace("성공경험수준", "")
            level_meta[key] = (
                r[3].strip() if len(r) > 3 else "",
                r[4].strip() if len(r) > 4 else "",
            )
        if k.startswith("ESSAY_Q") and len(r) > 4 and (r[4] or "").strip():
            essay_meta[k] = (
                (r[3].strip() if len(r) > 3 else ""),
                r[4].strip(),
            )
        if "세부항목체크" in k:
            m_full = re.search(r"세부항목체크(\d+)_(\d+)", k)
            m_exp = re.search(r"체크(\d+)_", k)
            letters = {}
            for cell in r[3:]:
                if not cell or not str(cell).strip():
                    continue
                cell = str(cell).strip()
                letter = cell[0].upper()
                if letter not in "ABCD":
                    continue
                label = cell[2:].strip() if len(cell) > 2 else cell
                letters[letter] = label
            if letters and m_full:
                sub_key = f"{m_full.group(1)}_{m_full.group(2)}"
                check_meta_by_sub[sub_key] = letters
            if letters and m_exp:
                exp_key = m_exp.group(1)
                check_meta_by_exp[exp_key] = letters

    return level_meta, essay_meta, check_meta_by_sub, check_meta_by_exp


def expand_type(type_str, check_key_sub, check_meta_by_sub, check_meta_by_exp):
    if not type_str or not str(type_str).strip():
        return "—"
    exp = check_key_sub.split("_")[0] if "_" in check_key_sub else check_key_sub
    letters_map = check_meta_by_sub.get(check_key_sub) or check_meta_by_exp.get(exp, {})
    parts = []
    for piece in re.split(r"[\^/,\s]+", str(type_str).strip()):
        piece = piece.strip().upper()
        if len(piece) != 1 or piece not in "ABCD":
            continue
        parts.append(letters_map.get(piece, piece))
    return " / ".join(parts) if parts else str(type_str).strip()


def collect_slots(row):
    slots = []
    for exp in range(1, 6):
        for sub in range(1, 5):
            ti = f"경험시기{exp}_{sub}"
            co = f"경험내용{exp}_{sub}"
            ck = f"성공경험 세부항목체크{exp}_{sub}"
            if ti not in row:
                continue
            title = (row.get(ti) or "").strip()
            content = (row.get(co) or "").strip()
            type_raw = (row.get(ck) or "").strip()
            if not title and not content:
                continue
            slots.append(
                {
                    "exp": exp,
                    "sub": sub,
                    "title": title,
                    "content": content,
                    "type_raw": type_raw,
                    "check_key": f"{exp}_{sub}",
                }
            )
    return slots


def is_ref_content(text):
    return bool(text and REF_SK2.search(text))


def match_representative(rep_text, slots):
    rep_text = (rep_text or "").strip()
    if not rep_text:
        return None
    best = None
    best_score = 0.0
    for s in slots:
        t = s["title"]
        if not t:
            continue
        sc = SequenceMatcher(None, rep_text, t).ratio()
        if sc >= 0.5 and sc > best_score:
            best_score = sc
            best = {**s, "_match_score": sc}
    return best


def resolve_content(matched, slots):
    if not matched:
        return matched
    content = matched["content"]
    title = matched["title"]
    if not is_ref_content(content):
        return matched
    same_title = [
        s
        for s in slots
        if s["title"] == title and s["content"] and not is_ref_content(s["content"])
    ]
    if same_title:
        best = max(same_title, key=lambda x: len(x["content"]))
        return {**matched, "content": best["content"], "type_raw": best.get("type_raw", matched["type_raw"]), "check_key": best["check_key"], "sub": best["sub"]}
    similar = [
        s
        for s in slots
        if s["title"]
        and SequenceMatcher(None, title, s["title"]).ratio() >= 0.88
        and s["content"]
        and not is_ref_content(s["content"])
    ]
    if similar:
        best = max(similar, key=lambda x: len(x["content"]))
        return {
            **matched,
            "title": best["title"],
            "content": best["content"],
            "type_raw": best.get("type_raw", matched["type_raw"]),
            "check_key": best["check_key"],
            "sub": best["sub"],
            "exp": best["exp"],
        }
    return matched


def level_summary_for_exp(row, exp, level_meta):
    prefix = f"성공경험수준{exp}_"
    bits = []
    for col in sorted(row.keys()):
        if not col.startswith(prefix):
            continue
        key = col.replace("성공경험수준", "")
        raw = (row.get(col) or "").strip()
        if not raw:
            continue
        area = level_meta.get(key, ("", ""))[0] or key
        bits.append(f"{area}: {raw}점")
    return " / ".join(bits) if bits else "—"


def main():
    level_meta, essay_meta, check_meta_by_sub, check_meta_by_exp = parse_metadata()
    report = []

    with open(INPUT, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            guid = (row.get("GUID") or "").strip()
            name = (row.get("성명") or "").strip()
            if not guid:
                continue

            company = (row.get("멤버사명") or "").strip()
            org = (row.get("조직") or "").strip()
            job = (row.get("직책") or "").strip()
            rep_raw = (row.get("대표성공경험") or "").strip()

            slots = collect_slots(row)
            matched = match_representative(rep_raw, slots)
            matched = resolve_content(matched, slots) if matched else None

            lines = [
                f"# {name} — 대표 성공경험 & 에세이",
                "",
                f"**소속:** {company}  **조직:** {org}  **직책:** {job}",
                "",
                "---",
                "",
                "## 대표 성공경험",
                "",
            ]

            if not matched:
                lines.append("*대표 성공경험이 지정되지 않았습니다.*")
                matched_title = "(매칭 없음)"
            else:
                exp = matched["exp"]
                title = matched["title"] or "(제목 없음)"
                content = matched["content"] or "(내용 없음)"
                type_expanded = expand_type(
                    matched["type_raw"],
                    matched["check_key"],
                    check_meta_by_sub,
                    check_meta_by_exp,
                )
                lvl = level_summary_for_exp(row, exp, level_meta)

                lines.append(f"### {title}")
                lines.append("")
                lines.append(f"**성공경험 {exp} 수준:** {lvl}")
                lines.append("")
                lines.append(f"**유형:** {type_expanded}")
                lines.append("")
                lines.append(content)
                matched_title = title

            lines.extend(["", "---", "", "## 에세이", ""])

            for qk in sorted(essay_meta.keys()):
                comp, qtext = essay_meta[qk]
                ans = (row.get(qk) or "").strip()
                if not ans:
                    continue
                lines.append(f"### {qtext}")
                lines.append("")
                lines.append(f"*역량: {comp}*")
                lines.append("")
                lines.append(ans)
                lines.append("")

            safe_name = re.sub(r'[\\/:*?"<>|]', "_", name)
            out_path = os.path.join(OUT_DIR, f"{safe_name}_{guid}.md")
            with open(out_path, "w", encoding="utf-8") as out:
                out.write("\n".join(lines).rstrip() + "\n")

            print(f"Wrote {out_path} | 대표 매칭: {matched_title}")
            report.append((out_path, matched_title))

    return report


if __name__ == "__main__":
    main()
