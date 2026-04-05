#!/usr/bin/env python3
"""
나이스디앤알 인터뷰 파일에서 인터뷰어의 반복질문을 분석합니다.
- 90% 이상 유사한 질문을 같은 질문으로 간주
- 참석자의 반복질문 관련 언급도 수집
"""

import os
import re
from pathlib import Path
from collections import defaultdict
from difflib import SequenceMatcher

# 인터뷰 파일만 (숫자명 .md, 보고서/가이드라인 제외)
BASE = Path(__file__).resolve().parent

# 반복질문 유사도 기준 (이 비율 이상이면 같은 질문으로 간주)
SIMILARITY_THRESHOLD = 0.95

def is_interview_file(name: str) -> bool:
    if not name.endswith(".md"):
        return False
    stem = name[:-3]
    if stem in ("가이드라인", "나이스디앤알_인터뷰_통합_보고서", "나이스디앤알_인터뷰_통합_보고서_v2",
                "나이스디앤알_인터뷰_통합_보고서_v3", "나이스디앤알_인터뷰_통합_보고서_v4",
                "나이스디앤알_인터뷰_통합_보고서_v4-1", "나이스디앤알_인터뷰_분석_보고서"):
        return False
    if stem.startswith("나이스디앤알_"):
        return False
    return stem.isdigit() or (len(stem) <= 4 and stem.isdigit())


def normalize_question(text: str) -> str:
    """타임스탬프·여백 제거, 소문자화 없이 공백만 정규화."""
    if not text or not text.strip():
        return ""
    t = text.strip()
    # [00:00] 또는 00:00 형태 제거
    t = re.sub(r'\[\d{1,2}:\d{2}\]', '', t)
    t = re.sub(r'^\d{1,2}:\d{2}\s*', '', t)
    t = re.sub(r'\s+', ' ', t)
    return t.strip()


def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def _is_role_line(line: str) -> bool:
    s = line.strip()
    if re.match(r"^(AI 인터뷰어|참여자)(\s*\d{1,2}:\d{2})?\s*$", s):
        return True
    if s.startswith("[AI 인터뷰어]:") or s.startswith("[사용자]:"):
        return True
    return False


def parse_format_a(content: str) -> list[tuple[str, str]]:
    """형식: 'AI 인터뷰어00:00' 또는 '참여자01:03' 다음 줄에 대화 내용."""
    pairs = []
    lines = content.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        if re.match(r"^AI 인터뷰어\d*", line.strip()) or re.match(r"^AI 인터뷰어\s*\d{1,2}:\d{2}", line.strip()):
            role = "interviewer"
            i += 1
            while i < len(lines) and not lines[i].strip():
                i += 1
            block = []
            while i < len(lines) and not _is_role_line(lines[i]):
                block.append(lines[i])
                i += 1
            text = " ".join(block).strip()
            if text:
                pairs.append((role, text))
            continue
        if re.match(r"^참여자\d*", line.strip()) or re.match(r"^참여자\s*\d{1,2}:\d{2}", line.strip()):
            role = "participant"
            i += 1
            while i < len(lines) and not lines[i].strip():
                i += 1
            block = []
            while i < len(lines) and not _is_role_line(lines[i]):
                block.append(lines[i])
                i += 1
            text = " ".join(block).strip()
            if text:
                pairs.append((role, text))
            continue
        m = re.match(r"^\[(AI 인터뷰어)\]:\s*(.*)", line.strip())
        if m:
            text = m.group(2).strip()
            if text:
                pairs.append(("interviewer", text))
            i += 1
            continue
        m = re.match(r"^\[(사용자)\]:\s*(.*)", line.strip())
        if m:
            text = m.group(2).strip()
            if text:
                pairs.append(("participant", text))
            i += 1
            continue
        i += 1
    return pairs


def parse_format_b(content: str) -> list[tuple[str, str]]:
    """[AI 인터뷰어]: ... / [사용자]: ... 한 줄 형식."""
    pairs = []
    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("[AI 인터뷰어]:"):
            text = line[len("[AI 인터뷰어]:"):].strip()
            if text:
                pairs.append(("interviewer", text))
        elif line.startswith("[사용자]:"):
            text = line[len("[사용자]:"):].strip()
            if text:
                pairs.append(("participant", text))
    return pairs


def parse_file(path: Path) -> list[tuple[str, str]]:
    content = path.read_text(encoding="utf-8", errors="replace")
    if "[AI 인터뷰어]:" in content or "[사용자]:" in content:
        return parse_format_b(content)
    return parse_format_a(content)


# 참석자 반복질문 관련 키워드 (반복질문 유추 가능 표현)
COMPLAINT_PATTERNS = [
    r"반복\s*질문", r"같은\s*질문", r"똑같은\s*질문", r"반복적인\s*질문", r"몇\s*번째\s*같은\s*질문",
    r"같은\s*거\s*(물어|묻)", r"또\s*(물어|묻)", r"계속\s*(물어|묻)",
    r"꼬리에\s*꼬리를\s*물고", r"반복적인\s*질문과\s*대답",
    r"너무\s*반복", r"질문\s*반복", r"다시\s*질문해보세요", r"인식이\s*안\s*되",
    r"짜증", r"짜증나", r"짜증스럽", r"불쾌", r"같은\s*말\s*(반복|다시)",
]


def has_complaint(text: str) -> bool:
    for pat in COMPLAINT_PATTERNS:
        if re.search(pat, text, re.IGNORECASE):
            return True
    return False


def cluster_questions(questions: list[str], threshold: float = None) -> list[list[int]]:
    threshold = threshold if threshold is not None else SIMILARITY_THRESHOLD
    """질문 인덱스 리스트를 유사도 threshold로 클러스터링. 각 클러스터는 인덱스 리스트.
    속도 개선: 앞 50자 동일/유사한 것끼리만 비교."""
    n = len(questions)
    parent = list(range(n))

    def find(i):
        if parent[i] != i:
            parent[i] = find(parent[i])
        return parent[i]

    def union(i, j):
        pi, pj = find(i), find(j)
        if pi != pj:
            parent[pi] = pj

    # 앞 50자 기준 버킷으로 나눠서 같은/비슷한 버킷 내에서만 비교
    def bucket_key(s: str) -> str:
        return (s[:50] if len(s) >= 50 else s)[:35]

    buckets = defaultdict(list)
    for i in range(n):
        buckets[bucket_key(questions[i])].append(i)
    for b in buckets.values():
        for idx, i in enumerate(b):
            for j in b[idx + 1 :]:
                if similarity(questions[i], questions[j]) >= threshold:
                    union(i, j)

    clusters = defaultdict(list)
    for i in range(n):
        clusters[find(i)].append(i)
    return list(clusters.values())


def main():
    files = sorted([f for f in BASE.iterdir() if f.is_file() and is_interview_file(f.name)],
                   key=lambda f: (not f.stem.isdigit(), int(f.stem) if f.stem.isdigit() else 0))

    # (file_id, question_normalized) -> raw question (대표용)
    all_questions = []  # (file_id, normalized, raw)
    participant_complaints = []  # (file_id, participant_text)

    for path in files:
        fid = path.stem
        pairs = parse_file(path)
        for role, text in pairs:
            if role == "interviewer":
                norm = normalize_question(text)
                if len(norm) > 5:  # 너무 짧은 건 제외
                    all_questions.append((fid, norm, text))
            else:
                if has_complaint(text):
                    participant_complaints.append((fid, text))

    # 전역 질문 풀에서 유사 질문 클러스터링 (대표 문장 선정용)
    norm_to_raw = {}
    for fid, norm, raw in all_questions:
        if norm not in norm_to_raw or len(raw) > len(norm_to_raw.get(norm, "")):
            norm_to_raw[norm] = raw

    unique_norms = list(norm_to_raw.keys())
    clusters = cluster_questions(unique_norms, threshold=SIMILARITY_THRESHOLD)

    # 클러스터 id -> 대표 질문(원문에 가깝게), 클러스터 내 정규화 문장들
    cluster_repr = {}
    cluster_norms = {}
    for c in clusters:
        # 대표: 가장 긴 원문
        best_raw = ""
        best_norm = ""
        for idx in c:
            n = unique_norms[idx]
            r = norm_to_raw[n]
            if len(r) > len(best_raw):
                best_raw = r
                best_norm = n
        cid = id(c)
        cluster_repr[cid] = best_raw
        cluster_norms[cid] = [unique_norms[i] for i in c]

    # 각 (file, cluster)별로 해당 파일 내에서 이 클러스터에 속하는 질문이 몇 번 나왔는지
    # norm -> cluster id
    norm_to_cid = {}
    for c in clusters:
        cid = id(c)
        for idx in c:
            norm_to_cid[unique_norms[idx]] = cid

    # file_id -> cluster_id -> count
    file_cluster_count = defaultdict(lambda: defaultdict(int))
    # cluster_id -> list of (file_id, count) for files where count >= 2
    cluster_repetition = defaultdict(list)
    # cluster_id -> total occurrences
    cluster_total = defaultdict(int)

    for fid, norm, raw in all_questions:
        cid = norm_to_cid.get(norm)
        if cid is None:
            best_ratio = 0.0
            best_cid = None
            for n in unique_norms:
                r = similarity(norm, n)
                if r >= SIMILARITY_THRESHOLD and r > best_ratio:
                    best_ratio = r
                    best_cid = norm_to_cid[n]
            if best_cid is not None:
                cid = best_cid
            else:
                cid = None
                for c in clusters:
                    for idx in c:
                        if similarity(norm, unique_norms[idx]) >= SIMILARITY_THRESHOLD:
                            cid = norm_to_cid[unique_norms[idx]]
                            break
                    if cid is not None:
                        break
        if cid is not None:
            file_cluster_count[fid][cid] += 1
            cluster_total[cid] += 1

    for fid, ccounts in file_cluster_count.items():
        for cid, cnt in ccounts.items():
            if cnt >= 2:
                cluster_repetition[cid].append((fid, cnt))

    def resolve_cid(norm: str):
        cid = norm_to_cid.get(norm)
        if cid is not None:
            return cid
        best_ratio = 0.0
        best_cid = None
        for n in unique_norms:
            r = similarity(norm, n)
            if r >= SIMILARITY_THRESHOLD and r > best_ratio:
                best_ratio = r
                best_cid = norm_to_cid[n]
        if best_cid is not None:
            return best_cid
        for c in clusters:
            for idx in c:
                if similarity(norm, unique_norms[idx]) >= SIMILARITY_THRESHOLD:
                    return norm_to_cid[unique_norms[idx]]
        return None

    # 95% 유사도 반복질문 대화 추출: (fid, cid) -> [(인터뷰어 발화, 참여자 응답), ...]
    file_repeated_dialogues = defaultdict(list)
    files_with_95_repetition = sorted(
        set(fid for rep_list in cluster_repetition.values() for fid, _ in rep_list),
        key=lambda x: (int(x) if str(x).isdigit() else 999999, str(x)),
    )
    for fid in files_with_95_repetition:
        path = BASE / f"{fid}.md"
        if not path.is_file():
            continue
        pairs = parse_file(path)
        for i, (role, text) in enumerate(pairs):
            if role != "interviewer":
                continue
            norm = normalize_question(text)
            if len(norm) <= 5:
                continue
            cid = resolve_cid(norm)
            if cid is None or file_cluster_count[fid][cid] < 2:
                continue
            part_text = ""
            if i + 1 < len(pairs) and pairs[i + 1][0] == "participant":
                part_text = pairs[i + 1][1]
            file_repeated_dialogues[(fid, cid)].append((text.strip(), part_text.strip()))

    # 참석자 불만을 해당 파일에서 반복이 있었던 클러스터와 연결 (파일 단위로만)
    file_has_complaint = set(fid for fid, _ in participant_complaints)

    # 테이블: 대표 질문, 총 발화 횟수, 반복 발현 횟수(같은 파일 내 2회 이상), 반복된 파일 수, 참석자 반복 불만(파일 수), 반복된 파일 예시
    rows = []
    for c in clusters:
        cid = id(c)
        repr_q = cluster_repr[cid]
        total = cluster_total[cid]
        rep_list = cluster_repetition[cid]
        repetition_count = sum(cnt - 1 for _, cnt in rep_list)  # 반복분만 (2번 물으면 1번 반복)
        files_with_repetition = len(rep_list)
        complaint_files = sum(1 for fid, _ in rep_list if fid in file_has_complaint)
        example_fids = [fid for fid, _ in sorted(rep_list, key=lambda x: -x[1])[:5]]
        rows.append({
            "question": repr_q,
            "total": total,
            "repetition_count": repetition_count,
            "files_with_repetition": files_with_repetition,
            "participant_complaint_in_those_files": complaint_files,
            "example_file_ids": ", ".join(example_fids),
        })

    # 반복이 있거나 참석자 불만이 있는 것 위주로 정렬 (반복 횟수 내림차순)
    rows.sort(key=lambda x: (-x["repetition_count"], -x["total"]))

    # 마크다운 테이블 생성 (대표 질문은 길면 자르기)
    md_lines = [
        "# 나이스디앤알 인터뷰 반복질문 집계",
        "",
        "## 분석 대상",
        f"- 인터뷰 파일 수: {len(files)}개",
        f"- 참석자 반복질문 관련 언급이 있는 파일: {len(file_has_complaint)}개",
        "",
        "## 질문별 반복질문 집계 (반복 다발 순)",
        "",
        "| 순번 | 대표 질문 (요약) | 총 발화 횟수 | 반복 발현 횟수 | 반복된 파일 수 | 참석자 반복 언급 | 반복 발생 파일(예시) |",
        "|---:|:---|---:|---:|---:|---:|:---|",
    ]

    def shorten(s: str, max_len: int = 80) -> str:
        s = s.replace("\n", " ")
        if len(s) <= max_len:
            return s
        return s[: max_len - 2] + "…"

    for i, r in enumerate(rows, 1):
        if r["repetition_count"] == 0 and r["participant_complaint_in_those_files"] == 0:
            continue  # 반복 없고 불만도 없으면 표에서 생략 가능. 일단 전부 출력하되 상위만 강조해도 됨
        q_short = shorten(r["question"], 75)
        md_lines.append(f"| {i} | {q_short} | {r['total']} | {r['repetition_count']} | {r['files_with_repetition']} | {r['participant_complaint_in_those_files']} | {r.get('example_file_ids', '')} |")

    # 반복 0인 것도 포함한 전체 테이블을 원하면 위에서 continue 제거. 여기서는 반복 있거나 불만 있는 것만
    # 전체 질문 유형 수를 알려주기 위해 상위 50개만 표시하고, 나머지는 "기타"로 요약할 수 있음
    if len(md_lines) > 5 + 60:  # 헤더 + 60행 넘으면
        md_lines = md_lines[: 5 + 60] + ["| ... | (이하 생략) | | | | | |"]
    elif not any("| 1 |" in line for line in md_lines[6:]):
        # 반복/불만 있는 행이 하나도 없을 수 있음
        md_lines.append("| - | 해당 없음 | - | - | - | - | - |")

    md_lines.extend([
        "",
        "---",
        "## 참석자 반복질문 관련 발화 예시",
        "",
    ])
    for fid, text in participant_complaints[:15]:
        snippet = text.strip()[:120] + ("…" if len(text) > 120 else "")
        md_lines.append(f"- **{fid}**: {snippet}")
    if not participant_complaints:
        md_lines.append("- (없음)")

    out_path = BASE / "나이스디앤알_반복질문_집계.md"
    out_path.write_text("\n".join(md_lines), encoding="utf-8")

    # 별도 md: 95% 유사도 반복질문 대화 정리
    dialogue_lines = [
        "# 나이스디앤알 95% 유사도 반복질문 대화 정리",
        "",
        f"- 유사도 기준: {int(SIMILARITY_THRESHOLD * 100)}%",
        f"- 대상 녹취 파일 수: {len(files_with_95_repetition)}개",
        "",
    ]
    for fid in files_with_95_repetition:
        cids_for_file = [cid for (f, cid) in file_repeated_dialogues if f == fid]
        if not cids_for_file:
            continue
        dialogue_lines.append(f"## 녹취 파일 {fid}")
        dialogue_lines.append("")
        for cid in cids_for_file:
            repr_q = cluster_repr[cid]
            q_short = repr_q.replace("\n", " ").strip()
            if len(q_short) > 100:
                q_short = q_short[:97] + "…"
            dialogue_lines.append(f"### 반복 질문 (대표): {q_short}")
            dialogue_lines.append("")
            for n, (q_text, a_text) in enumerate(file_repeated_dialogues[(fid, cid)], 1):
                dialogue_lines.append(f"- **인터뷰어 ({n}차):** {q_text.replace(chr(10), ' ')}")
                if a_text:
                    dialogue_lines.append(f"  - **참여자:** {a_text.replace(chr(10), ' ')}")
                dialogue_lines.append("")
        dialogue_lines.append("---")
        dialogue_lines.append("")
    dialogue_path = BASE / "나이스디앤알_95_반복질문_대화정리.md"
    dialogue_path.write_text("\n".join(dialogue_lines), encoding="utf-8")

    print(f"저장: {out_path}")
    print(f"95% 반복질문 대화 정리: {dialogue_path}")
    print(f"분석한 인터뷰 파일: {len(files)}개")
    print(f"반복 발현이 1회 이상인 질문 유형 수: {sum(1 for r in rows if r['repetition_count'] > 0)}")
    print(f"참석자 반복 관련 언급: {len(participant_complaints)}건")
    complaint_fids = sorted(
        set(fid for fid, _ in participant_complaints),
        key=lambda x: (int(x) if str(x).isdigit() else 999999, str(x)),
    )
    print(f"\n[반복질문 유추 가능 참석자 발화가 있는 파일] (예: 반복 질문, 똑같은 질문, 짜증 등) ({len(complaint_fids)}개)")
    print(", ".join(complaint_fids) if complaint_fids else "(없음)")
    print(f"\n[95% 이상 유사도로 반복질문이 발생한 녹취파일 번호] ({len(files_with_95_repetition)}개)")
    print(", ".join(files_with_95_repetition))

    # 반복질문 없이 원활했던 인터뷰 샘플 5개
    rep_set = set(files_with_95_repetition)
    no_rep = sorted(
        [f.stem for f in files if f.stem not in rep_set],
        key=lambda x: (int(x) if str(x).isdigit() else 999999, str(x)),
    )
    sample_5 = no_rep[:5] if len(no_rep) >= 5 else no_rep
    print(f"\n[반복질문 없이 원활했던 인터뷰 샘플 5개] (총 {len(no_rep)}개 중)")
    print(", ".join(sample_5))


if __name__ == "__main__":
    main()
