#!/usr/bin/env python3
"""전체 인터뷰 파일을 읽고, 7개 세그별 분석 보고서를 생성하는 스크립트."""

import os, re, json, collections

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ── 1. 프로필 로딩 ──────────────────────────────────────────────
with open(os.path.join(BASE_DIR, '_profiles.json'), 'r', encoding='utf-8') as f:
    PROFILES = json.load(f)

# ── 2. 전체 인터뷰 파일 파싱 ────────────────────────────────────
def parse_interview(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    if content.startswith('---\n'):
        parts = content.split('---\n', 2)
        body = parts[2] if len(parts) >= 3 else content
    else:
        body = content
    qas = []
    current_q = None
    current_a_lines = []
    for line in body.split('\n'):
        stripped = line.strip()
        if re.match(r'^\[AI 인터뷰어\]', stripped) or re.match(r'^AI 인터뷰어', stripped):
            if current_q and current_a_lines:
                answer = ' '.join(current_a_lines).strip()
                if answer and len(answer) > 1:
                    qas.append((current_q, answer))
            q_text = re.sub(r'^\[AI 인터뷰어\]:?\s*', '', stripped)
            q_text = re.sub(r'^AI 인터뷰어\d*:\d*\s*', '', q_text).strip()
            current_q = q_text
            current_a_lines = []
        elif re.match(r'^\[사용자\]', stripped) or re.match(r'^참여자', stripped):
            a_text = re.sub(r'^\[사용자\]:?\s*', '', stripped)
            a_text = re.sub(r'^참여자\d*:\d*\s*', '', a_text).strip()
            if a_text:
                current_a_lines.append(a_text)
        elif current_q and current_a_lines and stripped and not stripped.startswith('[') and not stripped.startswith('---'):
            current_a_lines.append(stripped)
    if current_q and current_a_lines:
        answer = ' '.join(current_a_lines).strip()
        if answer and len(answer) > 1:
            qas.append((current_q, answer))
    return qas

# ── 3. 토픽 분류 ────────────────────────────────────────────────
TOPIC_PATTERNS = [
    ('첫인상', [r'처음 접했을 때', r'처음 보셨을 때', r'가장 먼저 떠오른', r'첫인상', r'첫 느낌', r'이미지는 무엇', r'느낌이나 이미지']),
    ('소개시강조', [r'소개한다', r'소개할', r'가족이나 친구', r'강조해서 이야기', r'뭐라고 소개', r'소개한다고 가정']),
    ('구매의향', [r'구매를 고려', r'구매를 결심', r'구입.*고려', r'출시된다면', r'구매.*해 보실']),
    ('구매이유', [r'구매.*이유', r'구매.*긍정', r'어떤 점 때문에', r'고려하시는지', r'긍정적으로 생각하시는']),
    ('구매비고려', [r'망설여지', r'아쉽게 느껴', r'구매.*하지 않', r'고려하지 않', r'구매 안']),
    ('SDV인상', [r'SDV 기능.*인상', r'SDV.*접하신', r'SDV.*전반적', r'전반적인 인상']),
    ('신기술인지', [r'SDV.*OTA.*FoD', r'신기술.*알고', r'신기술.*잘 알', r'얼마나 잘 알고', r'OTA.*FoD']),
    ('신기술태도', [r'신기술.*추세', r'긍정적.*부정적', r'긍정적으로 느끼', r'신기술이 적용되는 추세', r'긍정적 또는 부정적']),
    ('신기술신뢰', [r'신뢰할 수 있', r'신뢰도', r'얼마나 신뢰']),
    ('신기술체감', [r'차 안에서 보내는 시간', r'다르게 느껴', r'체감.*변화', r'신기술 덕분', r'신기술 적용 이전', r'다르게 느껴지는 부분']),
    ('비교강점', [r'VEHICLE-N 대비.*강점', r'N 대비.*더 낫', r'확실.*더 낫다고 생각되는', r'더 낫다고 생각되는 점']),
    ('비교약점', [r'반대로 아쉬', r'아쉬운 점.*약점', r'약점.*무엇.*말씀']),
    ('결정적요소', [r'결정적.*요소', r'결정.*강점', r'결정지을', r'지금 당장 결정', r'결정적 요소']),
    ('치명적아쉬움', [r'치명적.*아쉬움', r'마음이 바뀔', r'치명적인', r'VEHICLE-N.*VEHICLE-C로 마음', r'N과.*C로 마음']),
    ('USP매력', [r'꼭 알려야', r'매력 포인트', r'USP', r'마케팅 담당자', r'이것만큼은 꼭']),
    ('윗급대체', [r'굳이 SUV.*갈 필요', r'윗급으로 갈 필요', r'이 차면 충분', r'SUV나 윗급', r'준중형 세단인.*보고']),
    ('세단유지', [r'준중형 세단.*유지', r'차급.*유지', r'아반떼.*유일', r'세단 차급.*사라져', r'계속 출시하면서', r'SUV로 대체']),
    ('SUV대비', [r'SUV 대비.*특장', r'SUV.*비교.*차별', r'준중형 세단만의', r'세단에서만 느낄', r'중형 세단 대비']),
]

def classify_topic(question):
    q = question.lower().replace(' ', '')
    for topic, patterns in TOPIC_PATTERNS:
        for p in patterns:
            if re.search(p.replace(' ', ''), q, re.IGNORECASE):
                return topic
    return None  # None = inherit from previous topic

INTERVIEW_FLOW = [
    '첫인상', '소개시강조', '구매의향', '구매이유', '구매비고려',
    'SDV인상', '신기술인지', '신기술태도', '신기술신뢰', '신기술체감',
    '비교강점', '비교약점', '결정적요소', '치명적아쉬움',
    'USP매력', '윗급대체', '세단유지', 'SUV대비',
]

# ── 4. 세그먼트 그룹화 함수 ──────────────────────────────────────
SEGMENT_CONFIGS = {
    '성별': {
        'key': '성별',
        'transform': lambda v: v if v in ('남', '여') else '미상',
        'order': ['남', '여'],
        'filename': '세그별_성별_분석_ver1.md',
    },
    '나이대': {
        'key': '나이',
        'transform': lambda v: ('20대' if int(v) < 30 else '30대' if int(v) < 40 else '40대' if int(v) < 50 else '50대' if int(v) < 60 else '60대+') if v and v.isdigit() else '미상',
        'order': ['20대', '30대', '40대', '50대', '60대+'],
        'filename': '세그별_나이_분석_ver1.md',
    },
    '결혼여부': {
        'key': '결혼여부',
        'transform': lambda v: '미혼' if '미혼' in v else '기혼 무자녀' if '무자녀' in v else '기혼 유자녀(영유아)' if '7세' in v else '기혼 유자녀(학령기)' if '8세' in v else '기혼(성인자녀)' if '성인' in v else ('미상' if not v else v),
        'order': ['미혼', '기혼 무자녀', '기혼 유자녀(영유아)', '기혼 유자녀(학령기)', '기혼(성인자녀)'],
        'filename': '세그별_결혼여부_분석_ver1.md',
    },
    '직업': {
        'key': '직업',
        'transform': lambda v: _job(v),
        'order': ['사무직', '자영업', '전업주부', '기술직', '교육직', '영업직', '전문직/프리랜서', '서비스직', '공무원', '기타'],
        'filename': '세그별_직업_분석_ver1.md',
    },
    '그룹구분': {
        'key': '그룹구분',
        'transform': lambda v: '보유자' if '보유' in v else '의향자' if '의향' in v else '이탈자' if '이탈' in v else ('미상' if not v else v),
        'order': ['보유자', '의향자', '이탈자'],
        'filename': '세그별_그룹구분_분석_ver1.md',
    },
    '보유차엔진': {
        'key': '보유차_엔진타입',
        'transform': lambda v: v.strip() if v and v.strip() in ('가솔린','HEV','디젤','LPG','PHEV','EV') else ('없음(무차)' if not v or not v.strip() else v.strip()),
        'order': ['가솔린', 'HEV', '디젤', '없음(무차)', '기타'],
        'filename': '세그별_보유차_엔진타입_분석_ver1.md',
    },
    '구매의향브랜드': {
        'key': '전기차_1순위_브랜드',
        'transform': lambda v: '테슬라' if '테슬라' in v else '현대' if '현대' in v else '기아' if '기아' in v else 'BYD' if 'byd' in v.lower() else ('없음/무응답' if not v else v),
        'order': ['현대', '기아', '테슬라', 'BYD', '없음/무응답'],
        'filename': '세그별_구매의향_브랜드_분석_ver1.md',
    },
}

def _job(v):
    if not v: return '미상'
    j = v.lower()
    if '사무' in j or 'it' in j or '관리' in j or '중권' in j or '국방' in j or '물류' in j or '소방' in j: return '사무직'
    if '자영' in j: return '자영업'
    if '주부' in j: return '전업주부'
    if '기술' in j or '수질' in j: return '기술직'
    if '교육' in j or '교사' in j or '강사' in j or '보육' in j: return '교육직'
    if '영업' in j: return '영업직'
    if '전문' in j or '프리' in j or '작곡' in j: return '전문직/프리랜서'
    if '서비스' in j: return '서비스직'
    if '공무' in j: return '공무원'
    if '학생' in j: return '학생'
    return '기타'

# ── 5. 데이터 수집 ──────────────────────────────────────────────
SECTION_MAP = {
    '첫인상': 'I. VEHICLE-I 인상',
    '소개시강조': 'I. VEHICLE-I 인상',
    'SDV인상': 'III. 신기술 인식',
    '구매의향': 'II. 구매 의향',
    '구매이유': 'II. 구매 의향',
    '구매비고려': 'II. 구매 의향',
    '신기술인지': 'III. 신기술 인식',
    '신기술태도': 'III. 신기술 인식',
    '신기술신뢰': 'III. 신기술 인식',
    '신기술체감': 'III. 신기술 인식',
    '비교강점': 'IV. N vs I 비교',
    '비교약점': 'IV. N vs I 비교',
    '결정적요소': 'V. 상품성 평가',
    '치명적아쉬움': 'V. 상품성 평가',
    'USP매력': 'VI. USP',
    '윗급대체': 'VI. USP',
    '세단유지': 'VII. 기타',
    'SUV대비': 'VII. 기타',
    '기타': 'VIII. 미분류',
}

SUBSECTION_MAP = {
    '첫인상': '첫인상 (느낌·이미지)',
    '소개시강조': '가족·친구 소개 시 강조점',
    '구매의향': '구매 고려 여부',
    '구매이유': '구매 고려 이유',
    '구매비고려': '구매 비고려·망설임 이유',
    'SDV인상': 'SDV 기능 전반적 인상',
    '신기술인지': '신기술 인지도 (SDV·OTA·FoD)',
    '신기술태도': '신기술 추세에 대한 태도',
    '신기술신뢰': '신기술 신뢰도',
    '신기술체감': '신기술 적용 후 체감 변화',
    '비교강점': 'N 대비 I 강점',
    '비교약점': 'N 대비 I 약점(아쉬운 점)',
    '결정적요소': '결정적 요소 (강점)',
    '치명적아쉬움': '치명적 아쉬움 (약점)',
    'USP매력': '꼭 알려야 할 매력 포인트',
    '윗급대체': 'SUV·윗급 대신 준중형으로 충분한 이유',
    '세단유지': '준중형 세단 차급 유지 의견',
    'SUV대비': 'SUV 대비 준중형 세단 특장점',
    '기타': '기타 응답',
}

SECTION_ORDER = ['I. VEHICLE-I 인상', 'II. 구매 의향', 'III. 신기술 인식',
                 'IV. N vs I 비교', 'V. 상품성 평가', 'VI. USP', 'VII. 기타']

SUBSECTION_ORDER_IN = {
    'I. VEHICLE-I 인상': ['첫인상', '소개시강조'],
    'II. 구매 의향': ['구매의향', '구매이유', '구매비고려'],
    'III. 신기술 인식': ['SDV인상', '신기술인지', '신기술태도', '신기술신뢰', '신기술체감'],
    'IV. N vs I 비교': ['비교강점', '비교약점'],
    'V. 상품성 평가': ['결정적요소', '치명적아쉬움'],
    'VI. USP': ['USP매력', '윗급대체'],
    'VII. 기타': ['세단유지', 'SUV대비'],
}

print('전체 인터뷰 파일 파싱 시작...')

all_data = []
file_count = 0
for fname in sorted(os.listdir(BASE_DIR)):
    m = re.match(r'^(\d+(_\d+)?)\.md$', fname)
    if not m:
        continue
    fid = m.group(1)
    base_id = fid.split('_')[0]
    profile = PROFILES.get(base_id, {})
    if not profile:
        continue

    filepath = os.path.join(BASE_DIR, fname)
    qas = parse_interview(filepath)
    if not qas:
        continue

    file_count += 1
    current_topic = '첫인상'
    flow_idx = 0
    for question, answer in qas:
        detected = classify_topic(question)
        if detected:
            current_topic = detected
            if detected in INTERVIEW_FLOW:
                new_idx = INTERVIEW_FLOW.index(detected)
                if new_idx >= flow_idx:
                    flow_idx = new_idx
        assigned = current_topic if current_topic else '기타'
        if len(answer) < 3:
            continue
        all_data.append({
            'id': base_id,
            'topic': assigned,
            'question': question[:100],
            'answer': answer,
            'profile': profile,
        })

print(f'파싱 완료: {file_count}개 파일, {len(all_data)}건 응답')

topic_counts = collections.Counter(d['topic'] for d in all_data)
for t, c in sorted(topic_counts.items(), key=lambda x: -x[1]):
    print(f'  {t}: {c}건')

# ── 6. 보고서 생성 ──────────────────────────────────────────────
def make_dist_table(items, seg_config, order):
    counts = collections.Counter()
    for item in items:
        val = seg_config['transform'](item['profile'].get(seg_config['key'], ''))
        counts[val] += 1
    total = sum(counts.values())
    if total == 0:
        return '| 세그 | 건수 | 비율 |\n|------|------|------|\n| (데이터 없음) | 0 | 0% |\n'
    lines = ['| 세그 | 건수 | 비율 |', '|------|------|------|']
    for seg in order:
        c = counts.get(seg, 0)
        if c > 0:
            pct = round(c / total * 100)
            lines.append(f'| {seg} | {c} | {pct}% |')
    others = {k: v for k, v in counts.items() if k not in order and v > 0}
    for k, v in sorted(others.items(), key=lambda x: -x[1]):
        pct = round(v / total * 100)
        lines.append(f'| {k} | {v} | {pct}% |')
    lines.append(f'| **합계** | **{total}** | **100%** |')
    return '\n'.join(lines) + '\n'

def get_seg_value(item, seg_config):
    return seg_config['transform'](item['profile'].get(seg_config['key'], ''))

def top_quotes_by_seg(items, seg_config, order, max_per_seg=5):
    groups = collections.defaultdict(list)
    for item in items:
        seg = get_seg_value(item, seg_config)
        groups[seg].append(item)
    lines = []
    for seg in order:
        seg_items = groups.get(seg, [])
        if not seg_items:
            continue
        lines.append(f'\n- **[{seg}]** ({len(seg_items)}건)')
        shown = 0
        for item in seg_items:
            if shown >= max_per_seg:
                remaining = len(seg_items) - shown
                if remaining > 0:
                    lines.append(f'  - *(외 {remaining}건)*')
                break
            answer = item['answer']
            if len(answer) > 150:
                answer = answer[:147] + '…'
            age = item['profile'].get('나이', '?')
            gender = item['profile'].get('성별', '?')
            lines.append(f'  - *"{answer}"* ({item["id"]}) [{gender}/{age}세]')
            shown += 1
    return '\n'.join(lines)

def find_notable_diffs(items, seg_config, order):
    groups = collections.defaultdict(list)
    for item in items:
        seg = get_seg_value(item, seg_config)
        groups[seg].append(item)
    total = len(items)
    if total < 5:
        return ''
    notes = []
    for seg in order:
        cnt = len(groups.get(seg, []))
        if cnt == 0:
            continue
        ratio = cnt / total
        expected = 1 / max(len([s for s in order if len(groups.get(s, [])) > 0]), 1)
        if ratio > expected * 1.5 and cnt >= 3:
            pct = round(ratio * 100)
            notes.append(f'**{seg}** 비중이 높음({pct}%, {cnt}건)')
        elif ratio < expected * 0.5 and expected > 0.15:
            pct = round(ratio * 100)
            notes.append(f'**{seg}** 비중이 낮음({pct}%, {cnt}건)')
    return ', '.join(notes) if notes else '세그 간 큰 편차 없음'

def generate_report(seg_name, seg_config):
    order = seg_config['order']
    lines = []
    lines.append(f'# 나이스디앤알 Exit Interview — 세그별 분석: {seg_name} (ver1)')
    lines.append('')
    lines.append(f'**분석 기준 세그먼트:** {seg_name}')
    lines.append(f'**분석 대상:** {file_count}개 인터뷰 파일, {len(all_data)}건 응답')
    lines.append('')

    # Overall distribution
    lines.append('## 전체 세그 분포')
    lines.append('')
    lines.append(make_dist_table(all_data, seg_config, order))
    lines.append('---')
    lines.append('')

    for section in SECTION_ORDER:
        lines.append(f'## {section}')
        lines.append('')
        sub_topics = SUBSECTION_ORDER_IN.get(section, [])
        section_items = [d for d in all_data if SECTION_MAP.get(d['topic']) == section]
        if not section_items:
            lines.append('*(해당 섹션 응답 없음)*')
            lines.append('')
            continue

        lines.append(f'**섹션 세그 분포** ({len(section_items)}건)')
        lines.append('')
        lines.append(make_dist_table(section_items, seg_config, order))
        lines.append('')

        for sub_topic in sub_topics:
            sub_name = SUBSECTION_MAP.get(sub_topic, sub_topic)
            sub_items = [d for d in all_data if d['topic'] == sub_topic]
            if not sub_items:
                continue
            lines.append(f'### {sub_name} ({len(sub_items)}건)')
            lines.append('')

            # Distribution table
            lines.append(f'**세그 분포**')
            lines.append('')
            lines.append(make_dist_table(sub_items, seg_config, order))
            lines.append('')

            # Notable diffs
            diff_note = find_notable_diffs(sub_items, seg_config, order)
            if diff_note:
                lines.append(f'**세그별 차이:** {diff_note}')
                lines.append('')

            # Quotes by segment
            lines.append('**세그별 주요 VOC**')
            lines.append(top_quotes_by_seg(sub_items, seg_config, order, max_per_seg=5))
            lines.append('')
            lines.append('---')
            lines.append('')

        lines.append('')

    return '\n'.join(lines)


# ── 7. 실행 ─────────────────────────────────────────────────────
for seg_name, seg_config in SEGMENT_CONFIGS.items():
    print(f'\n생성 중: {seg_config["filename"]}')
    report = generate_report(seg_name, seg_config)
    outpath = os.path.join(BASE_DIR, seg_config['filename'])
    with open(outpath, 'w', encoding='utf-8') as f:
        f.write(report)
    line_count = report.count('\n')
    print(f'  완료: {line_count}줄')

print('\n=== 전체 완료 ===')
