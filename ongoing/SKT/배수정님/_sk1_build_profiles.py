# -*- coding: utf-8 -*-
"""sk-1: self.csv + metadata.csv -> profiles/*.md + metadata.md"""
import csv
import os
import re
from difflib import SequenceMatcher

BASE = os.path.dirname(os.path.abspath(__file__))
META = os.path.join(BASE, "metadata.csv")
INPUT = os.path.join(BASE, "self.csv")
OUTPUT_DIR = os.path.join(BASE, "profiles")
os.makedirs(OUTPUT_DIR, exist_ok=True)

STOP = set(
    "및 또는 등을 이은 의한 있는 대한에서으로부터까지는도만이가을를과로수년월에관한위한통한"
)

REF_PATTERNS = re.compile(
    r"앞서\s|앞\s*단에|위에서\s*설명|위에서\s*기술|앞의\s|동일한\s*내용|상당\s*부분\s*중복",
    re.I,
)


def norm_tokens(text):
    if not text:
        return []
    parts = re.split(r"[\s,/·\[\]()\"'「」]+", text)
    out = []
    for p in parts:
        p = p.strip()
        if len(p) >= 2 and p not in STOP:
            out.append(p)
    return out


def is_similar(a, b):
    ta, ca = a.get("title") or "", a.get("content") or ""
    tb, cb = b.get("title") or "", b.get("content") or ""
    if REF_PATTERNS.search(ca) and len(ca) < 80:
        return False
    if REF_PATTERNS.search(cb) and len(cb) < 80:
        return False
    if ta and tb:
        r = SequenceMatcher(None, ta, tb).ratio()
        if r >= 0.55:
            return True
    wa, wb = set(norm_tokens(ta)), set(norm_tokens(tb))
    inter = wa & wb
    if len(inter) >= 2:
        den = max(1, min(len(wa), len(wb)))
        if len(inter) / den >= 0.50:
            return True
    if not ta and not tb:
        return SequenceMatcher(None, ca[:800], cb[:800]).ratio() >= 0.60
    if not ta or not tb:
        csim = SequenceMatcher(None, ca[:1200], cb[:1200]).ratio()
        if csim >= 0.60:
            return True
    return False


def score_label(n):
    try:
        v = int(float(str(n).strip()))
    except (ValueError, TypeError):
        return "—", str(n).strip() if n is not None else ""
    if v <= 1:
        return "경험없음/보조적", v
    if v <= 3:
        return "실무 수행", v
    if v <= 5:
        return "핵심 주도", v
    if v <= 7:
        return "전사적 성과 창출", v
    if v <= 9:
        return "변혁 주도", v
    return "9점 초과 표기", v


def parse_metadata():
    code_map, parent_map = {}, {}
    level_meta = {}
    essay_meta = {}
    check_meta = {}

    with open(META, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))

    in_codes = False
    for r in rows:
        if not r:
            continue
        if len(r) >= 4 and r[0] == "상위 코드":
            in_codes = True
            continue
        if in_codes and len(r) >= 4 and r[0] and r[1] and r[2] and r[3]:
            c0, c1, c2, name = r[0].strip(), r[1].strip(), r[2].strip(), r[3].strip()
            if not name:
                continue
            if c0 == c1 == c2:
                code_map[c0] = name
                continue
            if c1 == c2 and c0 != c1 and re.match(r"^M\d{4}$", c1):
                code_map[c1] = name
                parent_map[c1] = code_map.get(c0, c0)
                continue
            if c2 != c1 and re.match(r"^S\d{4}$", c2):
                code_map[c2] = name
                if re.match(r"^M\d{4}$", c1):
                    parent_map[c2] = code_map.get(c1, c1)
                continue

    for r in rows:
        if len(r) < 5:
            continue
        k = r[1].strip() if len(r) > 1 else ""
        if k.startswith("성공경험수준"):
            key = k.replace("성공경험수준", "")
            level_meta[key] = (r[3].strip() if len(r) > 3 else "", r[4].strip() if len(r) > 4 else "")
        if k.startswith("ESSAY_Q") and len(r) > 4 and r[4].strip():
            essay_meta[k] = (r[3].strip() if len(r) > 3 else "", r[4].strip())
        if "세부항목체크" in k:
            m = re.search(r"세부항목체크(\d+)_(\d+)", k)
            if not m:
                continue
            exp_key = f"{m.group(1)}_{m.group(2)}"
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
            if letters:
                check_meta[exp_key] = letters

    return code_map, parent_map, level_meta, essay_meta, check_meta


def resolve_code(code, code_map, parent_map):
    if not code or not str(code).strip():
        return "—"
    c = str(code).strip()
    name = code_map.get(c, c)
    par = parent_map.get(c)
    if par:
        return f"{name} ({par})"
    return name


def expand_type(type_str, check_key, check_meta):
    if not type_str or not str(type_str).strip():
        return "—"
    letters_map = check_meta.get(check_key, {})
    parts = []
    for piece in re.split(r"[\^/,\s]+", str(type_str).strip()):
        piece = piece.strip().upper()
        if len(piece) != 1 or piece not in "ABCD":
            continue
        parts.append(letters_map.get(piece, piece))
    return " / ".join(parts) if parts else str(type_str).strip()


def collect_experiences(row_dict, headers):
    items = []
    for exp in range(1, 6):
        for sub in range(1, 5):
            ck = f"성공경험 세부항목체크{exp}_{sub}"
            ti = f"경험시기{exp}_{sub}"
            co = f"경험내용{exp}_{sub}"
            if ck not in row_dict:
                continue
            content = (row_dict.get(co) or "").strip()
            title = (row_dict.get(ti) or "").strip()
            type_raw = (row_dict.get(ck) or "").strip()
            if not content and not title:
                continue
            if REF_PATTERNS.search(content) and len(content) < 100:
                continue
            items.append(
                {
                    "exp": exp,
                    "sub": sub,
                    "check_key": f"{exp}_{sub}",
                    "title": title,
                    "content": content,
                    "type_raw": type_raw,
                }
            )
    return items


def merge_experiences(items):
    if not items:
        return [], 0
    groups = []
    for it in items:
        placed = False
        for g in groups:
            if any(is_similar(it, x) for x in g):
                g.append(it)
                placed = True
                break
        if not placed:
            groups.append([it])
    merged = []
    for g in groups:
        best = max(g, key=lambda x: len(x.get("content") or ""))
        srcs = sorted({(x["exp"], x["sub"]) for x in g})
        merged.append(
            {
                "title": best["title"] or (g[0]["title"] if g else ""),
                "content": best["content"],
                "type_raw": best["type_raw"],
                "check_key": best["check_key"],
                "sources": srcs,
                "merged_count": len(g),
            }
        )
    return merged, len(items)


def level_rows_for_user(row_dict, lm):
    out = []
    for key, (area_name, _desc) in sorted(lm.items(), key=lambda x: x[0]):
        col = f"성공경험수준{key}"
        if col not in row_dict:
            continue
        raw = row_dict.get(col, "").strip()
        if not raw:
            continue
        label, _v = score_label(raw)
        disp_area = area_name or key
        out.append((disp_area, raw, label))
    return out


code_map, parent_map, level_meta, essay_meta, check_meta = parse_metadata()

# metadata.md
md_lines = [
    "# 메타데이터 참조 (metadata.csv 기준)",
    "",
    "## 성공경험 수준 (열 키 → 역량 영역)",
    "",
    "| 키 | 역량 영역 | 척도 안내 |",
    "|---|----------|-----------|",
]
for key, (a, b) in sorted(level_meta.items(), key=lambda x: x[0]):
    b_short = (b[:80] + "…") if len(b) > 80 else b
    md_lines.append(f"| {key} | {a} | {b_short} |")

md_lines.extend(["", "## 세부항목 유형 (성공경험×세부)", ""])
for ek in sorted(check_meta.keys(), key=lambda x: (int(x.split("_")[0]), int(x.split("_")[1]))):
    letters = check_meta[ek]
    md_lines.append(f"### 체크 {ek}")
    md_lines.append("| 코드 | 의미 |")
    md_lines.append("|------|------|")
    for L in "ABCD":
        if L in letters:
            md_lines.append(f"| {L} | {letters[L]} |")
    md_lines.append("")

md_lines.extend(["## 에세이 문항", "", "| 문항 | 역량 | 질문 |", "|------|------|------|"])
for qk in sorted(essay_meta.keys()):
    comp, qq = essay_meta[qk]
    md_lines.append(f"| {qk} | {comp} | {qq} |")

md_lines.extend(["", "## 전문분야 코드 계층", ""])
l_codes = sorted([c for c in code_map if re.match(r"^L\d{4}$", c)])
for lc in l_codes:
    lname = code_map[lc]
    md_lines.append(f"### {lc} — {lname}")
    m_codes = [m for m in code_map if re.match(r"^M\d{4}$", m) and parent_map.get(m) == lname]
    for mc in sorted(m_codes):
        md_lines.append(f"- **{mc}** {code_map[mc]}")
        s_codes = [s for s in code_map if re.match(r"^S\d{4}$", s) and parent_map.get(s) == code_map[mc]]
        for sc in sorted(s_codes):
            md_lines.append(f"  - **{sc}** {code_map[sc]}")
    md_lines.append("")

with open(os.path.join(BASE, "metadata.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(md_lines))

summary_dup = []

with open(INPUT, newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row in reader:
        guid = (row.get("GUID") or "").strip()
        name = (row.get("성명") or "").strip()
        if not guid:
            continue
        company = (row.get("멤버사명") or "").strip()
        org = (row.get("조직") or "").strip()
        title = (row.get("직책") or "").strip()

        prof_lines = [f"# {name}", "", "## 기본 정보", "", f"- **GUID:** {guid}", f"- **소속:** {company}", f"- **조직:** {org}", f"- **직책:** {title}", "", "## 전문분야", "", "### 1~3순위 전문분야", ""]
        for rank, prefix in [(1, "1순위"), (2, "2순위"), (3, "3순위")]:
            code = row.get(f"{prefix} 전문분야", "").strip()
            etc = row.get(f"{prefix} 기타", "").strip()
            years = row.get(f"{prefix} 경험(년)", "").strip()
            duty = row.get(f"{prefix} 업무내역", "").strip()
            ach = row.get(f"{prefix} 대표적 업적", "").strip()
            if not code and not etc and not duty:
                continue
            line = resolve_code(code, code_map, parent_map) if code else (etc or "—")
            if etc and code:
                line = f"{line} ({etc})" if etc not in line else line
            prof_lines.append(f"#### {prefix}")
            prof_lines.append(f"- **분야:** {line}")
            if years:
                prof_lines.append(f"- **경험:** {years}년")
            if duty:
                prof_lines.append(f"- **업무내역:** {duty}")
            if ach:
                prof_lines.append(f"- **대표적 업적:** {ach}")
            prof_lines.append("")

        prof_lines.extend(["## 성공경험 수준", "", "| 역량 영역 | 점수 | 수준 |", "|----------|------|------|"])
        for area, raw, lbl in level_rows_for_user(row, level_meta):
            prof_lines.append(f"| {area} | {raw} | {lbl} |")
        prof_lines.append("")

        raw_items = collect_experiences(row, row.keys())
        merged, n_raw = merge_experiences(raw_items)
        summary_dup.append((name, n_raw, len(merged)))

        prof_lines.extend(["## 세부 경험", ""])
        for i, m in enumerate(merged, 1):
            ttl = m["title"] or f"경험 {i}"
            src_parts = [f"성공경험 {a}_{b}" for a, b in m["sources"]]
            src_str = ", ".join(src_parts)
            extra = f" *(중복 {m['merged_count']}건 통합)*" if m["merged_count"] > 1 else ""
            typ = expand_type(m["type_raw"], m["check_key"], check_meta)
            prof_lines.append(f"### {ttl}")
            prof_lines.append(f"**활용된 성공경험:** {src_str}{extra}")
            prof_lines.append(f"**유형:** {typ}")
            prof_lines.append("")
            prof_lines.append(m["content"] or "(내용 없음)")
            prof_lines.append("")

        rep = (row.get("대표성공경험") or "").strip()
        prof_lines.extend(["## 대표 성공경험", "", rep or "(미기재)", ""])

        prof_lines.extend(["## 에세이", ""])
        for qk in sorted(essay_meta.keys()):
            comp, qtext = essay_meta[qk]
            ans = (row.get(qk) or "").strip()
            if not ans:
                continue
            prof_lines.append(f"### {qtext}")
            prof_lines.append(f"*역량: {comp}*")
            prof_lines.append("")
            prof_lines.append(ans)
            prof_lines.append("")

        safe_name = re.sub(r'[\\/:*?"<>|]', "_", name)
        out_path = os.path.join(OUTPUT_DIR, f"{safe_name}_{guid}.md")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("\n".join(prof_lines))
        print("Wrote", out_path)

print("Wrote", os.path.join(BASE, "metadata.md"))
print("DEDUP_SUMMARY", summary_dup)
