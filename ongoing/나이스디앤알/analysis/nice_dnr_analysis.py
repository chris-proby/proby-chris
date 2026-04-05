#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
나이스디앤알 Exit Interview 박사 논문 수준 종합 통계 분석
==========================================================
분석 기법:
  1. 데이터 파싱 및 전처리
  2. 기술통계 (Descriptive Statistics)
  3. 카이제곱 검정 (Chi-square), 피셔 정확 검정 (Fisher's Exact Test)
  4. 맨-휘트니 U 검정, 크루스칼-왈리스 검정 (Non-parametric tests)
  5. 한국어 형태소 분석 (KiwiPiepy)
  6. TF-IDF 행렬 + 코사인 유사도 히트맵
  7. LDA 토픽 모델링 (Latent Dirichlet Allocation)
  8. 주성분 분석 (PCA) + 바이플롯
  9. K-평균 군집 분석 (K-Means Clustering)
 10. 계층적 군집 분석 + 덴드로그램 (Hierarchical Clustering)
 11. 로지스틱 회귀 분석 (Logistic Regression)
 12. 랜덤 포레스트 특성 중요도 (Random Forest Feature Importance)
 13. 대응 분석 (Correspondence Analysis)
 14. 감성 분석 (Sentiment Analysis - 사전 기반)
 15. 개념 동시출현 네트워크 분석 (Co-occurrence Network)
 16. 인터뷰 응답 길이 및 복잡도 분석
 17. 그룹 간 언어 패턴 비교 (텍스트 피처 ANOVA)
 18. 워드클라우드 (전체 / 그룹별)
 19. 점도표 (Dot Plot) 키워드 비교
 20. HTML 종합 리포트 생성
"""

import os
import re
import json
import math
import warnings
import textwrap
from collections import Counter, defaultdict
from pathlib import Path

import yaml
import numpy as np
import pandas as pd
import scipy.stats as stats
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import matplotlib.patches as mpatches
import seaborn as sns
import networkx as nx
from wordcloud import WordCloud
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.decomposition import PCA, LatentDirichletAllocation, TruncatedSVD
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (silhouette_score, classification_report,
                              confusion_matrix, roc_auc_score, roc_curve)
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.pipeline import Pipeline
from scipy.cluster.hierarchy import dendrogram, linkage, fcluster
from scipy.spatial.distance import cosine
from statsmodels.stats.contingency_tables import Table2x2
import statsmodels.api as sm
from kiwipiepy import Kiwi

warnings.filterwarnings('ignore')

# ─────────────────────────────────────────────
#  경로 설정
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
RAWDATA_DIR = BASE_DIR / "rawdata"
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
FIGURES_DIR = OUTPUT_DIR / "figures"
FIGURES_DIR.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────
#  한국어 폰트 설정
# ─────────────────────────────────────────────
def setup_korean_font():
    font_candidates = [
        '/System/Library/Fonts/Supplemental/AppleGothic.ttf',
        '/Library/Fonts/AppleGothic.ttf',
        '/System/Library/Fonts/AppleSDGothicNeo.ttc',
        '/usr/share/fonts/truetype/nanum/NanumGothic.ttf',
    ]
    font_path = None
    for fp in font_candidates:
        if os.path.exists(fp):
            font_path = fp
            break
    if font_path:
        fm.fontManager.addfont(font_path)
        prop = fm.FontProperties(fname=font_path)
        plt.rcParams['font.family'] = prop.get_name()
    else:
        plt.rcParams['font.family'] = 'AppleGothic'
    plt.rcParams['axes.unicode_minus'] = False
    return font_path

FONT_PATH = setup_korean_font()

# ─────────────────────────────────────────────
#  1. 데이터 파싱
# ─────────────────────────────────────────────
def parse_interview_file(filepath):
    """YAML frontmatter + 대화 내용 파싱 (두 가지 포맷 모두 지원)"""
    content = filepath.read_text(encoding='utf-8')
    meta = {}
    body = content

    # YAML frontmatter 추출
    fm_match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
    if fm_match:
        try:
            meta = yaml.safe_load(fm_match.group(1)) or {}
        except Exception:
            meta = {}
        body = content[fm_match.end():]

    # id 키 정규화 (참여자ID → id)
    if 'id' not in meta and '참여자ID' in meta:
        meta['id'] = meta['참여자ID']

    ai_turns = []
    participant_turns = []
    total_duration = 0

    # ── 포맷 1: 타임스탬프 형식 (AI 인터뷰어00:00) ──
    ai_turns_v1 = re.findall(
        r'AI 인터뷰어\d+:\d+\s*\n\s*\n(.*?)(?=\n참여자\d|\nAI 인터뷰어\d|\Z)',
        body, re.DOTALL)
    participant_turns_v1 = re.findall(
        r'참여자\d+:\d+\s*\n\s*\n(.*?)(?=\nAI 인터뷰어\d|\n참여자\d|\Z)',
        body, re.DOTALL)

    if participant_turns_v1:
        ai_turns = ai_turns_v1
        participant_turns = participant_turns_v1
        timestamps = re.findall(r'(?:AI 인터뷰어|참여자)(\d+):(\d+)', body)
        if timestamps:
            last = timestamps[-1]
            total_duration = int(last[0]) * 60 + int(last[1])

    # ── 포맷 2: 대괄호 형식 ([AI 인터뷰어]: / [사용자]:) ──
    if not participant_turns:
        ai_turns = re.findall(
            r'\[AI 인터뷰어\]\s*:\s*(.*?)(?=\n\[AI 인터뷰어\]|\n\[사용자\]|\Z)',
            body, re.DOTALL)
        participant_turns = re.findall(
            r'\[사용자\]\s*:\s*(.*?)(?=\n\[AI 인터뷰어\]|\n\[사용자\]|\Z)',
            body, re.DOTALL)

    ai_text = ' '.join(t.strip() for t in ai_turns)
    participant_text = ' '.join(t.strip() for t in participant_turns)
    full_text = ai_text + ' ' + participant_text

    return {
        'meta': meta,
        'ai_text': ai_text,
        'participant_text': participant_text,
        'full_text': full_text,
        'num_ai_turns': len(ai_turns),
        'num_participant_turns': len(participant_turns),
        'total_duration_sec': total_duration,
        'participant_char_count': len(participant_text),
        'ai_char_count': len(ai_text),
    }

def load_all_interviews():
    records = []
    for fp in sorted(RAWDATA_DIR.glob('*.md')):
        data = parse_interview_file(fp)
        row = {**data['meta'], **{k: v for k, v in data.items() if k != 'meta'}}
        row['filename'] = fp.stem
        records.append(row)
    print(f"  총 {len(records)}개 인터뷰 파일 로드 완료")
    return records

# ─────────────────────────────────────────────
#  2. 데이터프레임 정제
# ─────────────────────────────────────────────
def build_dataframe(records):
    df = pd.DataFrame(records)

    # 나이 정수 변환
    df['나이'] = pd.to_numeric(df.get('나이'), errors='coerce')
    df['자녀수'] = pd.to_numeric(df.get('자녀수'), errors='coerce').fillna(0).astype(int)
    df['total_duration_sec'] = pd.to_numeric(df.get('total_duration_sec'), errors='coerce').fillna(0)
    df['num_ai_turns'] = pd.to_numeric(df.get('num_ai_turns'), errors='coerce').fillna(0).astype(int)
    df['num_participant_turns'] = pd.to_numeric(df.get('num_participant_turns'), errors='coerce').fillna(0).astype(int)
    df['participant_char_count'] = pd.to_numeric(df.get('participant_char_count'), errors='coerce').fillna(0).astype(int)

    # 나이대 구간
    df['나이대'] = pd.cut(df['나이'], bins=[0, 29, 39, 49, 59, 100],
                         labels=['20대', '30대', '40대', '50대', '60대+'])

    # 그룹 이진화: 의향자=1, 이탈자=0
    df['그룹구분'] = df['그룹구분'].fillna('').astype(str)
    df['is_intender'] = df['그룹구분'].str.contains('의향자').astype(int)

    # 구매희망 엔진 타입 정제
    df['구매희망_엔진타입_1순위'] = df['구매희망_엔진타입_1순위'].fillna('미응답').astype(str)
    df['구매희망_엔진타입_1순위'] = df['구매희망_엔진타입_1순위'].str.strip()

    # 발화 비율 (참여자 발화 / 전체)
    df['participant_ratio'] = df['participant_char_count'] / (
        df['participant_char_count'] + df['ai_char_count'] + 1)

    # 평균 응답 길이 (참여자 발화 / 턴 수)
    df['avg_response_len'] = df['participant_char_count'] / (df['num_participant_turns'] + 1)

    # 텍스트 없는 행 제거
    df = df[df['participant_text'].str.len() > 10].copy()
    df = df.reset_index(drop=True)

    print(f"  정제 후 유효 데이터: {len(df)}건")
    print(f"  의향자: {df['is_intender'].sum()}건 / 이탈자: {(df['is_intender']==0).sum()}건")
    return df

# ─────────────────────────────────────────────
#  3. 형태소 분석 (KiwiPiepy)
# ─────────────────────────────────────────────
STOPWORDS = set([
    '이', '가', '을', '를', '은', '는', '의', '에', '에서', '으로', '로', '와', '과',
    '도', '만', '에서', '하다', '있다', '이다', '되다', '않다', '없다', '하고', '이고',
    '것', '수', '때', '더', '가장', '좀', '그', '저', '제', '그리고', '그래서', '하지만',
    '그런데', '그러나', '또', '또한', '아', '네', '뭐', '어', '음', '우리', '저희',
    '이렇게', '저렇게', '어떻게', '무엇', '어떤', '어디', '언제', '왜', '어느', '그냥',
    '많이', '정말', '너무', '매우', '약간', '조금', '아마', '거의', '이미', '아직',
    '보이다', '느끼다', '생각하다', '말하다', '드리다', '주다', '받다', '갖다', '오다', '가다',
    '인터뷰', '참여', '감사', '질문', '말씀', '다시', '한번', '부탁', '소요', '예정',
    'AI', '인터뷰어', '차량', '차', '자동차', '모델', 'VEHICLE', 'I', 'N', 'C',
])

kiwi = Kiwi()

def tokenize_korean(text, pos_filter=('NNG', 'NNP', 'VA', 'VV', 'XR', 'SL')):
    """형태소 분석 후 명사/형용사/동사 추출"""
    if not text or len(text) < 2:
        return []
    try:
        result = kiwi.tokenize(text)
        tokens = []
        for token in result:
            # 태그가 pos_filter 항목 중 하나로 시작하는지 확인
            tag_match = any(token.tag.startswith(p) or token.tag == p for p in pos_filter)
            if tag_match and len(token.form) >= 2:
                if token.form not in STOPWORDS:
                    tokens.append(token.form)
        return tokens
    except Exception:
        return re.findall(r'[가-힣]{2,}', text)

def tokenize_nouns(text):
    """명사만 추출"""
    return tokenize_korean(text, pos_filter=('NNG', 'NNP'))

# ─────────────────────────────────────────────
#  공통 저장 함수
# ─────────────────────────────────────────────
def save_fig(name, dpi=150):
    path = FIGURES_DIR / f"{name}.png"
    plt.savefig(path, dpi=dpi, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"  저장: {path.name}")
    return str(path)

# ─────────────────────────────────────────────
#  4. 기술통계
# ─────────────────────────────────────────────
def descriptive_statistics(df):
    print("\n[4] 기술통계 분석")
    results = {}

    # 연속형 변수 요약
    cont_vars = ['나이', 'total_duration_sec', 'num_participant_turns',
                  'participant_char_count', 'avg_response_len']
    desc = df[cont_vars].describe().T
    desc['cv'] = desc['std'] / desc['mean']  # 변동계수
    results['desc_stats'] = desc
    print(desc.round(2).to_string())

    # 범주형 분포
    for col in ['성별', '나이대', '그룹구분', '구매희망_엔진타입_1순위', '보유차_엔진타입']:
        if col in df.columns:
            print(f"\n  [{col}]\n{df[col].value_counts().to_string()}")

    # 그룹별 나이 분포 시각화
    fig, axes = plt.subplots(2, 3, figsize=(15, 10))
    fig.suptitle('기술통계 - 인구통계 및 인터뷰 특성', fontsize=16, fontweight='bold')

    groups = ['의향자 그룹', '이탈자 그룹']
    colors = ['#2196F3', '#F44336']

    # 나이 분포
    for i, (grp, col) in enumerate(zip(groups, colors)):
        subset = df[df['그룹구분'].str.contains(grp.split()[0], na=False)]
        axes[0, 0].hist(subset['나이'].dropna(), bins=10, alpha=0.6, color=col, label=grp)
    axes[0, 0].set_title('그룹별 나이 분포', fontweight='bold')
    axes[0, 0].set_xlabel('나이')
    axes[0, 0].legend()

    # 성별 분포
    if '성별' in df.columns:
        gender_grp = df.groupby(['성별', df['그룹구분'].str.contains('의향자').map({True: '의향자', False: '이탈자'})]).size().unstack(fill_value=0)
        gender_grp.plot(kind='bar', ax=axes[0, 1], color=colors)
        axes[0, 1].set_title('성별 × 그룹', fontweight='bold')
        axes[0, 1].tick_params(axis='x', rotation=0)
        axes[0, 1].legend(title='그룹')

    # 나이대 분포
    if '나이대' in df.columns:
        age_cnt = df['나이대'].value_counts().sort_index()
        age_cnt.plot(kind='bar', ax=axes[0, 2], color='steelblue')
        axes[0, 2].set_title('나이대별 분포', fontweight='bold')
        axes[0, 2].tick_params(axis='x', rotation=0)

    # 구매 희망 엔진 타입
    if '구매희망_엔진타입_1순위' in df.columns:
        engine_cnt = df['구매희망_엔진타입_1순위'].value_counts()
        engine_cnt.plot(kind='pie', ax=axes[1, 0], autopct='%1.1f%%',
                       colors=['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'])
        axes[1, 0].set_title('구매 희망 엔진 타입 (1순위)', fontweight='bold')
        axes[1, 0].set_ylabel('')

    # 인터뷰 시간 분포
    axes[1, 1].hist(df['total_duration_sec'].dropna() / 60, bins=20,
                    color='steelblue', edgecolor='white')
    axes[1, 1].set_title('인터뷰 시간 분포 (분)', fontweight='bold')
    axes[1, 1].set_xlabel('시간(분)')

    # 평균 응답 길이 분포
    axes[1, 2].hist(df['avg_response_len'].dropna(), bins=20,
                    color='orange', edgecolor='white')
    axes[1, 2].set_title('평균 응답 길이 분포 (글자)', fontweight='bold')
    axes[1, 2].set_xlabel('평균 응답 길이')

    plt.tight_layout()
    save_fig('01_descriptive_stats')
    return results

# ─────────────────────────────────────────────
#  5. 통계 검정
# ─────────────────────────────────────────────
def statistical_tests(df):
    print("\n[5] 통계 검정")
    test_results = {}

    intender = df[df['is_intender'] == 1]
    churner  = df[df['is_intender'] == 0]

    # ── 맨-휘트니 U: 나이 차이 ──
    u_stat, p_val = stats.mannwhitneyu(
        intender['나이'].dropna(), churner['나이'].dropna(), alternative='two-sided')
    r_effect = 1 - (2 * u_stat) / (len(intender['나이'].dropna()) * len(churner['나이'].dropna()))
    test_results['mannwhitney_age'] = {'U': u_stat, 'p': p_val, 'r': r_effect}
    print(f"  Mann-Whitney U (나이): U={u_stat:.1f}, p={p_val:.4f}, r={r_effect:.3f}")

    # ── 맨-휘트니 U: 응답 길이 ──
    u2, p2 = stats.mannwhitneyu(
        intender['avg_response_len'].dropna(), churner['avg_response_len'].dropna())
    test_results['mannwhitney_response_len'] = {'U': u2, 'p': p2}
    print(f"  Mann-Whitney U (응답 길이): U={u2:.1f}, p={p2:.4f}")

    # ── 카이제곱: 성별 × 그룹 ──
    if '성별' in df.columns:
        ct = pd.crosstab(df['성별'], df['is_intender'])
        if ct.shape == (2, 2) and ct.values.min() >= 1:
            chi2, p_chi, dof, expected = stats.chi2_contingency(ct)
            n = ct.values.sum()
            cramers_v = math.sqrt(chi2 / (n * (min(ct.shape) - 1)))
            test_results['chi2_gender'] = {'chi2': chi2, 'p': p_chi, 'cramers_v': cramers_v}
            print(f"  Chi-square (성별×그룹): χ²={chi2:.3f}, p={p_chi:.4f}, Cramér's V={cramers_v:.3f}")

    # ── 카이제곱: 엔진타입 × 그룹 ──
    if '구매희망_엔진타입_1순위' in df.columns:
        ct2 = pd.crosstab(df['구매희망_엔진타입_1순위'], df['is_intender'])
        chi2_2, p2_2, dof2, _ = stats.chi2_contingency(ct2)
        test_results['chi2_engine'] = {'chi2': chi2_2, 'p': p2_2}
        print(f"  Chi-square (엔진타입×그룹): χ²={chi2_2:.3f}, p={p2_2:.4f}")

    # ── 크루스칼-왈리스: 나이대별 응답 길이 ──
    if '나이대' in df.columns:
        groups_data = [df[df['나이대'] == g]['avg_response_len'].dropna()
                       for g in df['나이대'].dropna().unique()]
        groups_data = [g for g in groups_data if len(g) > 0]
        if len(groups_data) >= 2:
            h_stat, p_kw = stats.kruskal(*groups_data)
            test_results['kruskal_age_response'] = {'H': h_stat, 'p': p_kw}
            print(f"  Kruskal-Wallis (나이대×응답길이): H={h_stat:.3f}, p={p_kw:.4f}")

    # ── 스피어만 상관: 나이 vs 응답길이 ──
    valid = df[['나이', 'avg_response_len']].dropna()
    rho, p_corr = stats.spearmanr(valid['나이'], valid['avg_response_len'])
    test_results['spearman_age_response'] = {'rho': rho, 'p': p_corr}
    print(f"  Spearman ρ (나이 vs 응답길이): ρ={rho:.3f}, p={p_corr:.4f}")

    # ── 포인트 이중열 상관: 인터뷰 시간 vs 응답 길이 ──
    valid2 = df[['total_duration_sec', 'avg_response_len']].dropna()
    r_pb, p_pb = stats.pearsonr(valid2['total_duration_sec'], valid2['avg_response_len'])
    test_results['pearson_duration_response'] = {'r': r_pb, 'p': p_pb}
    print(f"  Pearson r (인터뷰시간 vs 응답길이): r={r_pb:.3f}, p={p_pb:.4f}")

    # ── 시각화: 검정 결과 요약 ──
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle('통계 검정 결과', fontsize=16, fontweight='bold')

    # 그룹별 나이 박스플롯
    plot_df = df[['나이', 'is_intender']].dropna()
    plot_df['그룹'] = plot_df['is_intender'].map({1: '의향자', 0: '이탈자'})
    sns.boxplot(data=plot_df, x='그룹', y='나이', palette=['#2196F3', '#F44336'], ax=axes[0, 0])
    axes[0, 0].set_title(f'그룹별 나이 분포\n(Mann-Whitney U p={p_val:.4f})', fontweight='bold')

    # 그룹별 평균 응답 길이
    plot_df2 = df[['avg_response_len', 'is_intender']].dropna()
    plot_df2['그룹'] = plot_df2['is_intender'].map({1: '의향자', 0: '이탈자'})
    sns.violinplot(data=plot_df2, x='그룹', y='avg_response_len',
                   palette=['#2196F3', '#F44336'], ax=axes[0, 1])
    axes[0, 1].set_title(f'그룹별 평균 응답 길이\n(Mann-Whitney U p={p2:.4f})', fontweight='bold')

    # 성별×그룹 히트맵
    if '성별' in df.columns:
        ct_plot = pd.crosstab(df['성별'], df['is_intender'].map({1: '의향자', 0: '이탈자'}))
        sns.heatmap(ct_plot, annot=True, fmt='d', cmap='Blues', ax=axes[1, 0])
        axes[1, 0].set_title('성별 × 그룹 교차표', fontweight='bold')

    # 나이 vs 응답길이 산점도
    valid3 = df[['나이', 'avg_response_len', 'is_intender']].dropna()
    for g, c, label in [(1, '#2196F3', '의향자'), (0, '#F44336', '이탈자')]:
        sub = valid3[valid3['is_intender'] == g]
        axes[1, 1].scatter(sub['나이'], sub['avg_response_len'], alpha=0.5,
                           c=c, label=label, s=40)
    axes[1, 1].set_xlabel('나이')
    axes[1, 1].set_ylabel('평균 응답 길이')
    axes[1, 1].set_title(f'나이 vs 응답길이\n(Spearman ρ={rho:.3f}, p={p_corr:.4f})', fontweight='bold')
    axes[1, 1].legend()

    plt.tight_layout()
    save_fig('02_statistical_tests')
    return test_results

# ─────────────────────────────────────────────
#  6. TF-IDF 분석
# ─────────────────────────────────────────────
def tfidf_analysis(df):
    print("\n[6] TF-IDF 분석")
    print("  형태소 분석 진행 중...")

    tokenized = []
    for i, text in enumerate(df['participant_text']):
        tokens = tokenize_nouns(str(text))
        tokenized.append(' '.join(tokens))
        if i < 3:
            print(f"  [debug] id={i}, tokens_cnt={len(tokens)}, sample={tokens[:4]}")

    nonempty = sum(1 for t in tokenized if t.strip())
    print(f"  비어있지 않은 토큰 문서: {nonempty}/{len(tokenized)}")

    if nonempty == 0:
        print("  [경고] KiwiPiepy 토크나이저 실패 — regex fallback 적용")
        tokenized = []
        for text in df['participant_text']:
            import re as _re
            tokens_fb = _re.findall(r'[가-힣]{2,}', str(text))
            # 길이 2 이상, stopword 아닌 것
            tokens_fb = [t for t in tokens_fb if t not in STOPWORDS and len(t) >= 2]
            tokenized.append(' '.join(tokens_fb))
        nonempty = sum(1 for t in tokenized if t.strip())
        print(f"  Fallback 후 비어있지 않은 문서: {nonempty}/{len(tokenized)}")

    df['tokens_str'] = tokenized

    # TF-IDF 행렬
    tfidf = TfidfVectorizer(min_df=2, max_df=0.90, max_features=500)
    tfidf_matrix = tfidf.fit_transform(tokenized)
    feature_names = tfidf.get_feature_names_out()

    print(f"  TF-IDF 행렬 크기: {tfidf_matrix.shape}")

    # 상위 키워드 전체
    mean_tfidf = np.asarray(tfidf_matrix.mean(axis=0)).flatten()
    top_idx = mean_tfidf.argsort()[-30:][::-1]
    top_keywords = [(feature_names[i], mean_tfidf[i]) for i in top_idx]
    print(f"  TF-IDF 상위 30 키워드: {[k for k, _ in top_keywords[:10]]}")

    # 그룹별 상위 키워드
    intender_mask = df['is_intender'] == 1
    churner_mask  = df['is_intender'] == 0

    def top_keywords_group(mask, n=20):
        if mask.sum() == 0:
            return []
        group_mat = tfidf_matrix[mask.values]
        mean_vals = np.asarray(group_mat.mean(axis=0)).flatten()
        idx = mean_vals.argsort()[-n:][::-1]
        return [(feature_names[i], mean_vals[i]) for i in idx]

    intender_kw = top_keywords_group(intender_mask)
    churner_kw  = top_keywords_group(churner_mask)

    # ── 시각화 1: 전체 상위 키워드 바차트 ──
    fig, axes = plt.subplots(1, 3, figsize=(20, 8))
    fig.suptitle('TF-IDF 키워드 분석', fontsize=16, fontweight='bold')

    kw_all = list(reversed(top_keywords[:20]))
    axes[0].barh([k for k, _ in kw_all], [v for _, v in kw_all], color='steelblue')
    axes[0].set_title('전체 상위 20 키워드', fontweight='bold')
    axes[0].set_xlabel('평균 TF-IDF')

    kw_int = list(reversed(intender_kw[:15]))
    axes[1].barh([k for k, _ in kw_int], [v for _, v in kw_int], color='#2196F3')
    axes[1].set_title('의향자 그룹 상위 키워드', fontweight='bold')
    axes[1].set_xlabel('평균 TF-IDF')

    kw_chu = list(reversed(churner_kw[:15]))
    axes[2].barh([k for k, _ in kw_chu], [v for _, v in kw_chu], color='#F44336')
    axes[2].set_title('이탈자 그룹 상위 키워드', fontweight='bold')
    axes[2].set_xlabel('평균 TF-IDF')

    plt.tight_layout()
    save_fig('03_tfidf_keywords')

    # ── 시각화 2: 키워드 차이 점도표 (Dot Plot) ──
    int_dict = dict(intender_kw)
    chu_dict = dict(churner_kw)
    common_kw = sorted(set(int_dict) & set(chu_dict))

    if common_kw:
        diff_data = []
        for kw in common_kw:
            diff_data.append({
                'keyword': kw,
                '의향자': int_dict[kw],
                '이탈자': chu_dict[kw],
                'diff': int_dict[kw] - chu_dict[kw]
            })
        diff_df = pd.DataFrame(diff_data).sort_values('diff')

        fig, ax = plt.subplots(figsize=(10, 8))
        y_pos = range(len(diff_df))
        ax.scatter(diff_df['의향자'], y_pos, color='#2196F3', s=80, zorder=5, label='의향자')
        ax.scatter(diff_df['이탈자'], y_pos, color='#F44336', s=80, zorder=5, label='이탈자')
        for i, row in enumerate(diff_df.itertuples()):
            ax.plot([row.의향자, row.이탈자], [i, i], color='gray', alpha=0.5, linewidth=1.5)
        ax.set_yticks(list(y_pos))
        ax.set_yticklabels(diff_df['keyword'].tolist(), fontsize=9)
        ax.set_xlabel('평균 TF-IDF 값')
        ax.set_title('그룹별 키워드 TF-IDF 비교 (Dot Plot)', fontweight='bold')
        ax.legend()
        ax.grid(axis='x', alpha=0.3)
        plt.tight_layout()
        save_fig('04_dotplot_keywords')

    return tfidf_matrix, feature_names, tokenized, df

# ─────────────────────────────────────────────
#  7. LDA 토픽 모델링
# ─────────────────────────────────────────────
def lda_topic_modeling(tokenized, n_topics=6):
    print(f"\n[7] LDA 토픽 모델링 (n_topics={n_topics})")

    count_vec = CountVectorizer(min_df=2, max_df=0.90, max_features=500)
    count_matrix = count_vec.fit_transform(tokenized)
    feature_names = count_vec.get_feature_names_out()

    lda = LatentDirichletAllocation(
        n_components=n_topics, random_state=42,
        max_iter=50, learning_method='batch',
        doc_topic_prior=0.1, topic_word_prior=0.01
    )
    doc_topics = lda.fit_transform(count_matrix)

    print(f"  LDA 퍼플렉서티(Perplexity): {lda.perplexity(count_matrix):.1f}")

    # 토픽별 상위 단어
    topic_words = []
    for topic_idx, topic in enumerate(lda.components_):
        top_words_idx = topic.argsort()[-12:][::-1]
        top_words = [feature_names[i] for i in top_words_idx]
        topic_words.append(top_words)
        print(f"  토픽 {topic_idx+1}: {' | '.join(top_words[:8])}")

    # 토픽 레이블 (수동 지정 힌트)
    topic_labels = [
        f'토픽 {i+1}: {"/".join(tw[:3])}'
        for i, tw in enumerate(topic_words)
    ]

    # ── 시각화: 토픽별 단어 바차트 ──
    n_cols = 3
    n_rows = math.ceil(n_topics / n_cols)
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(18, 4 * n_rows))
    axes = axes.flatten()
    fig.suptitle('LDA 토픽 모델링 - 토픽별 주요 단어', fontsize=16, fontweight='bold')

    colors = plt.cm.Set3(np.linspace(0, 1, n_topics))
    for i, (topic, words) in enumerate(zip(lda.components_, topic_words)):
        top_n = 10
        top_idx = topic.argsort()[-top_n:][::-1]
        vals = topic[top_idx] / topic[top_idx].sum()
        wds = [feature_names[j] for j in top_idx]
        axes[i].barh(list(reversed(wds)), list(reversed(vals)), color=colors[i])
        axes[i].set_title(f'토픽 {i+1}', fontweight='bold')
        axes[i].set_xlabel('정규화 가중치')

    for j in range(n_topics, len(axes)):
        axes[j].set_visible(False)

    plt.tight_layout()
    save_fig('05_lda_topics')

    # ── 토픽 분포 히트맵 (그룹별) ──
    doc_topic_df = pd.DataFrame(doc_topics, columns=[f'토픽{i+1}' for i in range(n_topics)])
    doc_topic_df['is_intender'] = df_global['is_intender'].values[:len(doc_topic_df)]

    fig, ax = plt.subplots(figsize=(12, 5))
    group_topic = doc_topic_df.groupby('is_intender').mean()
    group_topic.index = ['이탈자', '의향자']
    sns.heatmap(group_topic, annot=True, fmt='.3f', cmap='YlOrRd', ax=ax)
    ax.set_title('그룹별 토픽 분포 히트맵', fontweight='bold')
    ax.set_xlabel('토픽')
    ax.set_ylabel('그룹')
    plt.tight_layout()
    save_fig('06_topic_distribution_heatmap')

    return lda, doc_topics, topic_labels

# ─────────────────────────────────────────────
#  8. PCA 분석
# ─────────────────────────────────────────────
def pca_analysis(tfidf_matrix, df):
    print("\n[8] 주성분 분석 (PCA)")

    X = tfidf_matrix.toarray()
    scaler = StandardScaler(with_mean=False)
    X_scaled = scaler.fit_transform(X)

    pca = PCA(n_components=min(20, X.shape[1], X.shape[0]))
    X_pca = pca.fit_transform(X_scaled)

    explained_var = pca.explained_variance_ratio_
    cumulative_var = np.cumsum(explained_var)
    n_90 = np.argmax(cumulative_var >= 0.90) + 1
    print(f"  PC1={explained_var[0]*100:.1f}%, PC2={explained_var[1]*100:.1f}%")
    print(f"  90% 설명을 위한 주성분 수: {n_90}")

    fig, axes = plt.subplots(1, 3, figsize=(18, 6))
    fig.suptitle('주성분 분석 (PCA)', fontsize=16, fontweight='bold')

    # 스크리 플롯
    n_show = min(15, len(explained_var))
    axes[0].bar(range(1, n_show+1), explained_var[:n_show] * 100, color='steelblue', alpha=0.7)
    axes[0].plot(range(1, n_show+1), cumulative_var[:n_show] * 100, 'ro-', linewidth=2)
    axes[0].axhline(90, color='gray', linestyle='--', alpha=0.7, label='90% 기준')
    axes[0].set_xlabel('주성분')
    axes[0].set_ylabel('설명 분산 (%)')
    axes[0].set_title('스크리 플롯 (Scree Plot)', fontweight='bold')
    axes[0].legend()

    # PC1-PC2 바이플롯
    colors_arr = ['#2196F3' if g == 1 else '#F44336' for g in df['is_intender']]
    axes[1].scatter(X_pca[:, 0], X_pca[:, 1], c=colors_arr, alpha=0.6, s=40)
    axes[1].set_xlabel(f'PC1 ({explained_var[0]*100:.1f}%)')
    axes[1].set_ylabel(f'PC2 ({explained_var[1]*100:.1f}%)')
    axes[1].set_title('PCA 바이플롯 (그룹별)', fontweight='bold')
    patch1 = mpatches.Patch(color='#2196F3', label='의향자')
    patch2 = mpatches.Patch(color='#F44336', label='이탈자')
    axes[1].legend(handles=[patch1, patch2])

    # PC3-PC4 (있으면)
    if X_pca.shape[1] >= 4:
        axes[2].scatter(X_pca[:, 2], X_pca[:, 3], c=colors_arr, alpha=0.6, s=40)
        axes[2].set_xlabel(f'PC3 ({explained_var[2]*100:.1f}%)')
        axes[2].set_ylabel(f'PC4 ({explained_var[3]*100:.1f}%)')
        axes[2].set_title('PCA 바이플롯 (PC3-PC4)', fontweight='bold')
        axes[2].legend(handles=[patch1, patch2])

    plt.tight_layout()
    save_fig('07_pca_analysis')

    return X_pca, pca

# ─────────────────────────────────────────────
#  9. K-평균 군집 분석
# ─────────────────────────────────────────────
def kmeans_clustering(X_pca, df):
    print("\n[9] K-평균 군집 분석")

    # 최적 K 찾기 (Elbow + Silhouette)
    X_input = X_pca[:, :10]
    inertias = []
    silhouettes = []
    K_range = range(2, 9)
    for k in K_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(X_input)
        inertias.append(km.inertia_)
        silhouettes.append(silhouette_score(X_input, labels))

    best_k = K_range[np.argmax(silhouettes)]
    print(f"  최적 K (Silhouette 기준): {best_k}")

    km_final = KMeans(n_clusters=best_k, random_state=42, n_init=10)
    cluster_labels = km_final.fit_predict(X_input)
    df['cluster'] = cluster_labels

    # 클러스터별 그룹 분포
    cluster_group = pd.crosstab(cluster_labels, df['is_intender'].map({1: '의향자', 0: '이탈자'}))
    print(f"  클러스터별 그룹 분포:\n{cluster_group.to_string()}")

    fig, axes = plt.subplots(1, 3, figsize=(18, 6))
    fig.suptitle('K-평균 군집 분석', fontsize=16, fontweight='bold')

    # Elbow 플롯
    axes[0].plot(K_range, inertias, 'bo-', linewidth=2)
    axes[0].set_xlabel('군집 수 (K)')
    axes[0].set_ylabel('관성 (Inertia)')
    axes[0].set_title('Elbow 플롯', fontweight='bold')

    # 실루엣 점수
    axes[1].plot(K_range, silhouettes, 'rs-', linewidth=2)
    axes[1].axvline(best_k, color='gray', linestyle='--', alpha=0.7)
    axes[1].set_xlabel('군집 수 (K)')
    axes[1].set_ylabel('실루엣 점수')
    axes[1].set_title(f'실루엣 점수 (최적 K={best_k})', fontweight='bold')

    # 군집 시각화
    palette = plt.cm.Set1(np.linspace(0, 0.8, best_k))
    for c in range(best_k):
        mask = cluster_labels == c
        axes[2].scatter(X_pca[mask, 0], X_pca[mask, 1],
                       c=[palette[c]], alpha=0.7, s=60, label=f'군집 {c+1}')
    axes[2].set_xlabel('PC1')
    axes[2].set_ylabel('PC2')
    axes[2].set_title('K-평균 군집 (PC 공간)', fontweight='bold')
    axes[2].legend()

    plt.tight_layout()
    save_fig('08_kmeans_clustering')

    return cluster_labels, df

# ─────────────────────────────────────────────
#  10. 계층적 군집 분석
# ─────────────────────────────────────────────
def hierarchical_clustering(tfidf_matrix, df, n_sample=60):
    print(f"\n[10] 계층적 군집 분석 (상위 {n_sample}개 샘플)")

    # 샘플링
    idx = np.random.default_rng(42).choice(len(df), size=min(n_sample, len(df)), replace=False)
    X_sub = tfidf_matrix[idx].toarray()

    Z = linkage(X_sub, method='ward', metric='euclidean')
    labels_sub = df['filename'].iloc[idx].tolist()
    group_sub = df['is_intender'].iloc[idx].tolist()

    # 색상 (의향자/이탈자)
    leaf_colors = {i: ('#2196F3' if group_sub[i] == 1 else '#F44336')
                   for i in range(len(labels_sub))}

    fig, ax = plt.subplots(figsize=(20, 10))
    d = dendrogram(Z, ax=ax, labels=labels_sub, leaf_rotation=90,
                   leaf_font_size=8, color_threshold=0.7 * max(Z[:, 2]))
    ax.set_title(f'계층적 군집 덴드로그램 (Ward 연결법, n={len(idx)})',
                 fontsize=14, fontweight='bold')
    ax.set_ylabel('유클리드 거리')
    ax.set_xlabel('인터뷰 ID')

    patch1 = mpatches.Patch(color='#2196F3', label='의향자')
    patch2 = mpatches.Patch(color='#F44336', label='이탈자')
    ax.legend(handles=[patch1, patch2])

    plt.tight_layout()
    save_fig('09_dendrogram', dpi=120)
    return Z

# ─────────────────────────────────────────────
#  11. 로지스틱 회귀 분석
# ─────────────────────────────────────────────
def logistic_regression_analysis(tfidf_matrix, df):
    print("\n[11] 로지스틱 회귀 분석")

    y = df['is_intender'].values

    if y.sum() < 5 or (y == 0).sum() < 5:
        print("  그룹 불균형으로 스킵")
        return {}

    # TF-IDF → Truncated SVD (100 components)
    svd = TruncatedSVD(n_components=min(100, tfidf_matrix.shape[1]-1), random_state=42)
    X_svd = svd.fit_transform(tfidf_matrix)

    # 교차 검증
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    clf = LogisticRegression(C=1.0, max_iter=1000, random_state=42, class_weight='balanced')
    cv_scores = cross_val_score(clf, X_svd, y, cv=cv, scoring='roc_auc')
    print(f"  CV AUC-ROC: {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

    # 전체 학습
    clf.fit(X_svd, y)
    y_prob = clf.predict_proba(X_svd)[:, 1]
    y_pred = clf.predict(X_svd)

    fpr, tpr, _ = roc_curve(y, y_prob)
    auc_val = roc_auc_score(y, y_prob)

    fig, axes = plt.subplots(1, 3, figsize=(18, 6))
    fig.suptitle('로지스틱 회귀 분석', fontsize=16, fontweight='bold')

    # ROC 곡선
    axes[0].plot(fpr, tpr, color='blue', lw=2, label=f'ROC (AUC={auc_val:.3f})')
    axes[0].plot([0, 1], [0, 1], 'k--', alpha=0.5)
    axes[0].fill_between(fpr, tpr, alpha=0.1, color='blue')
    axes[0].set_xlabel('FPR (False Positive Rate)')
    axes[0].set_ylabel('TPR (True Positive Rate)')
    axes[0].set_title('ROC 곡선', fontweight='bold')
    axes[0].legend()

    # 교차검증 점수
    axes[1].bar(range(1, 6), cv_scores, color='steelblue', alpha=0.7)
    axes[1].axhline(cv_scores.mean(), color='red', linestyle='--',
                    label=f'평균 AUC = {cv_scores.mean():.3f}')
    axes[1].set_xlabel('Fold')
    axes[1].set_ylabel('AUC-ROC')
    axes[1].set_title('5-Fold 교차검증 AUC', fontweight='bold')
    axes[1].legend()

    # 혼동 행렬
    cm = confusion_matrix(y, y_pred)
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=axes[2],
                xticklabels=['이탈자(pred)', '의향자(pred)'],
                yticklabels=['이탈자(true)', '의향자(true)'])
    axes[2].set_title('혼동 행렬', fontweight='bold')

    plt.tight_layout()
    save_fig('10_logistic_regression')

    return {'cv_auc': cv_scores.mean(), 'auc_std': cv_scores.std(), 'full_auc': auc_val}

# ─────────────────────────────────────────────
#  12. 랜덤 포레스트 특성 중요도
# ─────────────────────────────────────────────
def random_forest_importance(tfidf_matrix, feature_names, df):
    print("\n[12] 랜덤 포레스트 특성 중요도")

    y = df['is_intender'].values
    if y.sum() < 5 or (y == 0).sum() < 5:
        print("  그룹 불균형으로 스킵")
        return {}

    rf = RandomForestClassifier(n_estimators=200, random_state=42,
                                 class_weight='balanced', max_depth=8, n_jobs=-1)
    rf.fit(tfidf_matrix, y)

    importances = rf.feature_importances_
    top_n = 20
    top_idx = importances.argsort()[-top_n:][::-1]

    fig, ax = plt.subplots(figsize=(10, 8))
    top_words_rf = [feature_names[i] for i in top_idx]
    top_vals_rf  = importances[top_idx]

    colors_rf = ['#2196F3' if v > top_vals_rf.mean() else '#90CAF9' for v in top_vals_rf]
    ax.barh(list(reversed(top_words_rf)), list(reversed(top_vals_rf)), color=list(reversed(colors_rf)))
    ax.set_xlabel('특성 중요도 (Gini 불순도)')
    ax.set_title('랜덤 포레스트 - 의향자/이탈자 판별 키워드 TOP 20', fontweight='bold')
    ax.axvline(top_vals_rf.mean(), color='red', linestyle='--', alpha=0.7, label='평균')
    ax.legend()

    plt.tight_layout()
    save_fig('11_random_forest_importance')

    print(f"  RF OOB 지원 여부: {hasattr(rf, 'oob_score_')}")
    print(f"  TOP 5 키워드: {top_words_rf[:5]}")
    return dict(zip(top_words_rf, top_vals_rf))

# ─────────────────────────────────────────────
#  13. 감성 분석 (사전 기반)
# ─────────────────────────────────────────────
POSITIVE_WORDS = [
    '좋다', '좋아', '마음', '마음에', '마음에 들다', '마음에 들어', '예쁘다', '예쁜', '멋지다',
    '멋진', '세련', '스포티', '실용', '편리', '편하다', '편한', '넓다', '넓은', '충분',
    '만족', '고려', '구매', '긍정', '기대', '혁신', '미래', '첨단', '특별', '차별',
    '강점', '장점', '추천', '선호', '디자인', '모던', '깔끔', '날렵', '개성',
    '합리', '가성비', '저렴', '경쟁력', '고급', '안정', '신뢰', '편의',
]

NEGATIVE_WORDS = [
    '아쉽', '아쉬운', '불편', '부족', '걱정', '우려', '부담', '비싸', '비싼',
    '단점', '약점', '문제', '어렵', '작다', '작은', '좁다', '좁은', '불만',
    '실망', '포기', '이탈', '선택 안', '고민', '망설', '검증', '확인 필요',
    '위험', '불안', '불확실', '아직', '더 필요', '개선', '보완',
]

def sentiment_analysis(df):
    print("\n[13] 감성 분석")

    def calc_sentiment(text):
        text = str(text)
        pos = sum(1 for w in POSITIVE_WORDS if w in text)
        neg = sum(1 for w in NEGATIVE_WORDS if w in text)
        total = pos + neg
        score = (pos - neg) / (total + 1)
        return pos, neg, score

    df[['pos_count', 'neg_count', 'sentiment_score']] = df['participant_text'].apply(
        lambda t: pd.Series(calc_sentiment(t)))

    print(f"  의향자 평균 감성: {df[df['is_intender']==1]['sentiment_score'].mean():.4f}")
    print(f"  이탈자 평균 감성: {df[df['is_intender']==0]['sentiment_score'].mean():.4f}")

    fig, axes = plt.subplots(1, 3, figsize=(18, 6))
    fig.suptitle('감성 분석 결과', fontsize=16, fontweight='bold')

    # 그룹별 감성 분포
    plot_s = df[['sentiment_score', 'is_intender']].copy()
    plot_s['그룹'] = plot_s['is_intender'].map({1: '의향자', 0: '이탈자'})
    sns.boxplot(data=plot_s, x='그룹', y='sentiment_score',
                palette=['#2196F3', '#F44336'], ax=axes[0])
    axes[0].axhline(0, color='gray', linestyle='--', alpha=0.5)
    axes[0].set_title('그룹별 감성 점수 분포', fontweight='bold')

    # 긍정/부정 키워드 빈도
    int_mask = df['is_intender'] == 1
    chu_mask = df['is_intender'] == 0
    bar_data = {
        '긍정(의향자)': df[int_mask]['pos_count'].mean(),
        '부정(의향자)': df[int_mask]['neg_count'].mean(),
        '긍정(이탈자)': df[chu_mask]['pos_count'].mean(),
        '부정(이탈자)': df[chu_mask]['neg_count'].mean(),
    }
    axes[1].bar(bar_data.keys(), bar_data.values(),
               color=['#2196F3', '#F44336', '#90CAF9', '#EF9A9A'])
    axes[1].set_title('그룹별 평균 긍/부정 키워드 빈도', fontweight='bold')
    axes[1].set_ylabel('평균 빈도')
    axes[1].tick_params(axis='x', rotation=20)

    # 감성 산점도 (나이 vs 감성)
    valid = df[['나이', 'sentiment_score', 'is_intender']].dropna()
    for g, c, label in [(1, '#2196F3', '의향자'), (0, '#F44336', '이탈자')]:
        sub = valid[valid['is_intender'] == g]
        axes[2].scatter(sub['나이'], sub['sentiment_score'], alpha=0.5,
                       c=c, label=label, s=40)
    axes[2].axhline(0, color='gray', linestyle='--', alpha=0.5)
    axes[2].set_xlabel('나이')
    axes[2].set_ylabel('감성 점수')
    axes[2].set_title('나이별 감성 점수 분포', fontweight='bold')
    axes[2].legend()

    plt.tight_layout()
    save_fig('12_sentiment_analysis')

    # Mann-Whitney U for sentiment
    u_sent, p_sent = stats.mannwhitneyu(
        df[int_mask]['sentiment_score'],
        df[chu_mask]['sentiment_score'],
        alternative='two-sided')
    print(f"  Mann-Whitney U (감성점수): U={u_sent:.1f}, p={p_sent:.4f}")

    return df

# ─────────────────────────────────────────────
#  14. 개념 동시출현 네트워크
# ─────────────────────────────────────────────
def cooccurrence_network(df, top_n=40, window=4):
    print(f"\n[14] 개념 동시출현 네트워크 (상위 {top_n} 노드)")

    # 모든 토큰에서 빈도 상위 N 키워드 선정
    all_tokens = []
    for text in df['participant_text']:
        tokens = tokenize_nouns(str(text))
        all_tokens.extend(tokens)

    word_freq = Counter(all_tokens)
    top_words = set([w for w, _ in word_freq.most_common(top_n)])

    # 공동 출현 행렬 구축
    cooc = defaultdict(int)
    for text in df['participant_text']:
        tokens = [t for t in tokenize_nouns(str(text)) if t in top_words]
        for i in range(len(tokens)):
            for j in range(i+1, min(i+window+1, len(tokens))):
                if tokens[i] != tokens[j]:
                    pair = tuple(sorted([tokens[i], tokens[j]]))
                    cooc[pair] += 1

    # 네트워크 구축
    G = nx.Graph()
    for word in top_words:
        G.add_node(word, freq=word_freq[word])
    for (w1, w2), count in cooc.items():
        if count >= 3:
            G.add_edge(w1, w2, weight=count)

    # 중심성 계산
    degree_cent = nx.degree_centrality(G)
    betweenness_cent = nx.betweenness_centrality(G, weight='weight')
    pagerank = nx.pagerank(G, weight='weight')

    print(f"  네트워크 노드: {G.number_of_nodes()}, 엣지: {G.number_of_edges()}")
    print(f"  네트워크 밀도: {nx.density(G):.4f}")
    top_pr = sorted(pagerank.items(), key=lambda x: -x[1])[:10]
    print(f"  PageRank TOP 10: {[w for w, _ in top_pr]}")

    # 시각화
    fig, ax = plt.subplots(figsize=(16, 14))

    pos = nx.spring_layout(G, k=2.5, seed=42, iterations=100)

    node_sizes = [word_freq.get(n, 1) * 60 for n in G.nodes()]
    node_colors = [pagerank.get(n, 0) for n in G.nodes()]
    edge_widths = [G[u][v]['weight'] * 0.3 for u, v in G.edges()]

    nx.draw_networkx_nodes(G, pos, ax=ax, node_size=node_sizes,
                           node_color=node_colors, cmap='YlOrRd', alpha=0.85)
    nx.draw_networkx_edges(G, pos, ax=ax, width=edge_widths, alpha=0.4, edge_color='gray')
    nx.draw_networkx_labels(G, pos, ax=ax, font_size=9,
                            font_family=plt.rcParams['font.family'])

    sm = plt.cm.ScalarMappable(cmap='YlOrRd',
                                norm=plt.Normalize(vmin=min(node_colors), vmax=max(node_colors)))
    sm.set_array([])
    plt.colorbar(sm, ax=ax, label='PageRank 중심성')
    ax.set_title('개념 동시출현 네트워크\n(노드 크기: 빈도, 색상: PageRank 중심성)', fontweight='bold', fontsize=14)
    ax.axis('off')

    plt.tight_layout()
    save_fig('13_cooccurrence_network', dpi=120)

    # 중심성 지표 바차트
    fig, axes = plt.subplots(1, 3, figsize=(18, 7))
    fig.suptitle('네트워크 중심성 분석', fontsize=14, fontweight='bold')

    for i, (metric, title) in enumerate([
        (degree_cent, '연결 중심성 (Degree)'),
        (betweenness_cent, '매개 중심성 (Betweenness)'),
        (pagerank, 'PageRank 중심성')
    ]):
        top = sorted(metric.items(), key=lambda x: -x[1])[:15]
        kws = [k for k, _ in reversed(top)]
        vals = [v for _, v in reversed(top)]
        axes[i].barh(kws, vals, color='steelblue')
        axes[i].set_title(title, fontweight='bold')
        axes[i].set_xlabel('중심성 값')

    plt.tight_layout()
    save_fig('14_network_centrality')

    return G, pagerank

# ─────────────────────────────────────────────
#  15. 워드클라우드
# ─────────────────────────────────────────────
def generate_wordclouds(df):
    print("\n[15] 워드클라우드 생성")

    if not FONT_PATH:
        print("  한국어 폰트 없어 스킵")
        return

    wc_configs = [
        ('전체', df['participant_text'], '#3F51B5'),
        ('의향자', df[df['is_intender'] == 1]['participant_text'], '#1565C0'),
        ('이탈자', df[df['is_intender'] == 0]['participant_text'], '#B71C1C'),
    ]

    fig, axes = plt.subplots(1, 3, figsize=(21, 8))
    fig.suptitle('워드클라우드 - 그룹별 핵심 키워드', fontsize=16, fontweight='bold')

    for ax, (title, texts, bg_color) in zip(axes, wc_configs):
        combined = ' '.join(str(t) for t in texts)
        tokens = tokenize_nouns(combined)
        freq = Counter(tokens)
        # 빈도 상위 200 단어만
        top_freq = dict(sorted(freq.items(), key=lambda x: -x[1])[:200])

        if not top_freq:
            ax.text(0.5, 0.5, '데이터 없음', ha='center', va='center', transform=ax.transAxes)
            continue

        wc = WordCloud(
            font_path=FONT_PATH,
            width=600, height=450,
            background_color='white',
            colormap='Blues' if '이탈' not in title else 'Reds',
            max_words=150,
            prefer_horizontal=0.8,
        ).generate_from_frequencies(top_freq)

        ax.imshow(wc, interpolation='bilinear')
        ax.set_title(f'{title} 그룹', fontweight='bold', fontsize=13)
        ax.axis('off')

    plt.tight_layout()
    save_fig('15_wordclouds', dpi=120)

# ─────────────────────────────────────────────
#  16. 인터뷰 길이 및 복잡도 분석
# ─────────────────────────────────────────────
def interview_complexity_analysis(df):
    print("\n[16] 인터뷰 복잡도 분석")

    # 문장 다양성 (Type-Token Ratio)
    def ttr(text):
        tokens = re.findall(r'[가-힣]+', str(text))
        if not tokens:
            return 0
        return len(set(tokens)) / len(tokens)

    # 평균 문장 길이
    def avg_sent_len(text):
        sents = re.split(r'[.!?。]\s*', str(text))
        sents = [s for s in sents if len(s) > 3]
        if not sents:
            return 0
        return np.mean([len(s) for s in sents])

    df['ttr'] = df['participant_text'].apply(ttr)
    df['avg_sent_len'] = df['participant_text'].apply(avg_sent_len)

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle('인터뷰 복잡도 및 발화 분석', fontsize=16, fontweight='bold')

    # TTR 그룹별
    plot_t = df[['ttr', 'is_intender']].copy()
    plot_t['그룹'] = plot_t['is_intender'].map({1: '의향자', 0: '이탈자'})
    sns.boxplot(data=plot_t, x='그룹', y='ttr', palette=['#2196F3', '#F44336'], ax=axes[0, 0])
    u_t, p_t = stats.mannwhitneyu(df[df['is_intender']==1]['ttr'],
                                    df[df['is_intender']==0]['ttr'])
    axes[0, 0].set_title(f'그룹별 어휘 다양성 (TTR)\n(MW U p={p_t:.4f})', fontweight='bold')

    # 평균 문장 길이
    plot_asl = df[['avg_sent_len', 'is_intender']].copy()
    plot_asl['그룹'] = plot_asl['is_intender'].map({1: '의향자', 0: '이탈자'})
    sns.boxplot(data=plot_asl, x='그룹', y='avg_sent_len',
                palette=['#2196F3', '#F44336'], ax=axes[0, 1])
    axes[0, 1].set_title('그룹별 평균 문장 길이', fontweight='bold')

    # 응답 길이 vs TTR
    valid_c = df[['participant_char_count', 'ttr', 'is_intender']].dropna()
    for g, c, label in [(1, '#2196F3', '의향자'), (0, '#F44336', '이탈자')]:
        sub = valid_c[valid_c['is_intender'] == g]
        axes[1, 0].scatter(sub['participant_char_count'], sub['ttr'],
                          alpha=0.5, c=c, label=label, s=40)
    axes[1, 0].set_xlabel('총 응답 길이 (글자)')
    axes[1, 0].set_ylabel('어휘 다양성 (TTR)')
    axes[1, 0].set_title('응답 길이 vs 어휘 다양성', fontweight='bold')
    axes[1, 0].legend()

    # 인터뷰 시간 vs 응답 길이 (산점도)
    valid_d = df[['total_duration_sec', 'participant_char_count', 'is_intender']].dropna()
    valid_d = valid_d[valid_d['total_duration_sec'] > 0]
    for g, c, label in [(1, '#2196F3', '의향자'), (0, '#F44336', '이탈자')]:
        sub = valid_d[valid_d['is_intender'] == g]
        axes[1, 1].scatter(sub['total_duration_sec'] / 60, sub['participant_char_count'],
                          alpha=0.5, c=c, label=label, s=40)
    axes[1, 1].set_xlabel('인터뷰 시간 (분)')
    axes[1, 1].set_ylabel('참여자 총 발화 (글자)')
    axes[1, 1].set_title('인터뷰 시간 vs 발화량', fontweight='bold')
    axes[1, 1].legend()

    plt.tight_layout()
    save_fig('16_interview_complexity')

    print(f"  의향자 평균 TTR: {df[df['is_intender']==1]['ttr'].mean():.4f}")
    print(f"  이탈자 평균 TTR: {df[df['is_intender']==0]['ttr'].mean():.4f}")

    return df

# ─────────────────────────────────────────────
#  17. 대응분석 (Correspondence Analysis)
# ─────────────────────────────────────────────
def correspondence_analysis(df):
    print("\n[17] 대응 분석 (Correspondence Analysis)")

    if '나이대' not in df.columns or '구매희망_엔진타입_1순위' not in df.columns:
        print("  필요 컬럼 없어 스킵")
        return

    ct = pd.crosstab(df['나이대'].dropna(),
                     df['구매희망_엔진타입_1순위'])
    ct = ct.loc[:, ct.sum() >= 3]  # 빈도 낮은 열 제거

    if ct.shape[0] < 2 or ct.shape[1] < 2:
        print("  데이터 부족으로 스킵")
        return

    # SVD 기반 대응분석
    N = ct.values.astype(float)
    P = N / N.sum()
    row_mass = P.sum(axis=1)
    col_mass = P.sum(axis=0)
    Dr_inv_sqrt = np.diag(1.0 / np.sqrt(row_mass))
    Dc_inv_sqrt = np.diag(1.0 / np.sqrt(col_mass))
    S = Dr_inv_sqrt @ (P - np.outer(row_mass, col_mass)) @ Dc_inv_sqrt

    U, sigma, Vt = np.linalg.svd(S, full_matrices=False)
    row_coords = Dr_inv_sqrt @ U[:, :2] * sigma[:2]
    col_coords = Dc_inv_sqrt @ Vt[:2, :].T * sigma[:2]
    inertia = (sigma**2).sum()
    inertia_pct = sigma[:2]**2 / inertia * 100

    fig, ax = plt.subplots(figsize=(12, 8))
    ax.scatter(row_coords[:, 0], row_coords[:, 1], c='blue', s=100,
               marker='s', zorder=5, label='나이대')
    for i, label in enumerate(ct.index):
        ax.annotate(str(label), (row_coords[i, 0], row_coords[i, 1]),
                   fontsize=11, ha='center', va='bottom', color='blue',
                   fontweight='bold')

    ax.scatter(col_coords[:, 0], col_coords[:, 1], c='red', s=100,
               marker='^', zorder=5, label='엔진타입')
    for i, label in enumerate(ct.columns):
        ax.annotate(str(label), (col_coords[i, 0], col_coords[i, 1]),
                   fontsize=11, ha='center', va='top', color='red',
                   fontweight='bold')

    ax.axhline(0, color='gray', linestyle='--', alpha=0.5)
    ax.axvline(0, color='gray', linestyle='--', alpha=0.5)
    ax.set_xlabel(f'Dimension 1 ({inertia_pct[0]:.1f}%)')
    ax.set_ylabel(f'Dimension 2 ({inertia_pct[1]:.1f}%)')
    ax.set_title('대응 분석: 나이대 × 구매희망 엔진타입', fontweight='bold', fontsize=14)
    ax.legend()
    plt.tight_layout()
    save_fig('17_correspondence_analysis')

    return row_coords, col_coords

# ─────────────────────────────────────────────
#  18. 코사인 유사도 히트맵
# ─────────────────────────────────────────────
def cosine_similarity_heatmap(tfidf_matrix, df, n_sample=50):
    print(f"\n[18] 코사인 유사도 분석 (n={n_sample})")

    n = min(n_sample, len(df))
    # 의향자/이탈자 균형 샘플링
    int_idx = df[df['is_intender'] == 1].index[:n//2].tolist()
    chu_idx = df[df['is_intender'] == 0].index[:n//2].tolist()
    all_idx = int_idx + chu_idx

    X_sub = tfidf_matrix[all_idx].toarray()
    norms = np.linalg.norm(X_sub, axis=1, keepdims=True)
    norms[norms == 0] = 1
    X_norm = X_sub / norms
    sim_mat = X_norm @ X_norm.T

    labels = [f"{'I' if df['is_intender'].iloc[i]==1 else 'C'}-{df['filename'].iloc[i]}"
              for i in all_idx]

    fig, ax = plt.subplots(figsize=(16, 14))
    mask = np.zeros_like(sim_mat, dtype=bool)
    np.fill_diagonal(mask, True)
    sns.heatmap(sim_mat, ax=ax, cmap='RdBu_r', vmin=0, vmax=1,
                xticklabels=labels, yticklabels=labels,
                mask=mask, square=True, linewidths=0.5)
    ax.set_xticklabels(ax.get_xticklabels(), fontsize=7, rotation=90)
    ax.set_yticklabels(ax.get_yticklabels(), fontsize=7, rotation=0)
    ax.set_title('인터뷰 간 코사인 유사도 히트맵\n(I=의향자, C=이탈자)', fontweight='bold', fontsize=13)

    plt.tight_layout()
    save_fig('18_cosine_similarity_heatmap', dpi=100)

    # 그룹 내 vs 그룹 간 유사도 비교
    int_n = len(int_idx)
    within_int = sim_mat[:int_n, :int_n][np.triu_indices(int_n, k=1)].mean()
    within_chu = sim_mat[int_n:, int_n:][np.triu_indices(int_n, k=1)].mean()
    between    = sim_mat[:int_n, int_n:].mean()
    print(f"  의향자 내 평균 유사도: {within_int:.4f}")
    print(f"  이탈자 내 평균 유사도: {within_chu:.4f}")
    print(f"  그룹 간 평균 유사도: {between:.4f}")

    return sim_mat

# ─────────────────────────────────────────────
#  19. HTML 리포트 생성
# ─────────────────────────────────────────────
def generate_html_report(df, test_results, lda_topic_labels, lr_results, rf_results,
                          network_stats, pca_obj):
    print("\n[19] HTML 리포트 생성")

    n_intender = int(df['is_intender'].sum())
    n_churner  = int((df['is_intender'] == 0).sum())
    n_total    = len(df)
    avg_age    = float(df['나이'].mean())
    avg_dur    = float(df['total_duration_sec'].mean() / 60)
    avg_resp   = float(df['avg_response_len'].mean())

    # 그림 파일 목록 — Base64 임베드
    import base64
    figs = sorted(FIGURES_DIR.glob('*.png'))
    fig_tags = ''
    for fp in figs:
        try:
            b64 = base64.b64encode(fp.read_bytes()).decode('utf-8')
            img_src = f"data:image/png;base64,{b64}"
        except Exception:
            img_src = f"figures/{fp.name}"
        fig_tags += f'''
        <div class="figure-card">
            <img src="{img_src}" alt="{fp.stem}" loading="lazy">
            <p class="fig-caption">[그림] {fp.stem.replace("_", " ")}</p>
        </div>'''

    # 통계 검정 요약 테이블
    test_rows = ''
    if 'mannwhitney_age' in test_results:
        r = test_results['mannwhitney_age']
        sig = '✅ 유의' if r['p'] < 0.05 else '❌ 비유의'
        test_rows += f'<tr><td>나이 차이 (그룹 간)</td><td>Mann-Whitney U</td><td>U={r["U"]:.1f}</td><td>{r["p"]:.4f}</td><td>r={r["r"]:.3f}</td><td>{sig}</td></tr>'
    if 'mannwhitney_response_len' in test_results:
        r = test_results['mannwhitney_response_len']
        sig = '✅ 유의' if r['p'] < 0.05 else '❌ 비유의'
        test_rows += f'<tr><td>응답 길이 (그룹 간)</td><td>Mann-Whitney U</td><td>U={r["U"]:.1f}</td><td>{r["p"]:.4f}</td><td>—</td><td>{sig}</td></tr>'
    if 'chi2_gender' in test_results:
        r = test_results['chi2_gender']
        sig = '✅ 유의' if r['p'] < 0.05 else '❌ 비유의'
        test_rows += f'<tr><td>성별 × 그룹</td><td>Chi-square</td><td>χ²={r["chi2"]:.3f}</td><td>{r["p"]:.4f}</td><td>V={r["cramers_v"]:.3f}</td><td>{sig}</td></tr>'
    if 'chi2_engine' in test_results:
        r = test_results['chi2_engine']
        sig = '✅ 유의' if r['p'] < 0.05 else '❌ 비유의'
        test_rows += f'<tr><td>엔진타입 × 그룹</td><td>Chi-square</td><td>χ²={r["chi2"]:.3f}</td><td>{r["p"]:.4f}</td><td>—</td><td>{sig}</td></tr>'
    if 'kruskal_age_response' in test_results:
        r = test_results['kruskal_age_response']
        sig = '✅ 유의' if r['p'] < 0.05 else '❌ 비유의'
        test_rows += f'<tr><td>나이대 × 응답 길이</td><td>Kruskal-Wallis</td><td>H={r["H"]:.3f}</td><td>{r["p"]:.4f}</td><td>—</td><td>{sig}</td></tr>'
    if 'spearman_age_response' in test_results:
        r = test_results['spearman_age_response']
        sig = '✅ 유의' if r['p'] < 0.05 else '❌ 비유의'
        test_rows += f'<tr><td>나이 vs 응답 길이</td><td>Spearman ρ</td><td>ρ={r["rho"]:.3f}</td><td>{r["p"]:.4f}</td><td>—</td><td>{sig}</td></tr>'

    # LDA 토픽 목록
    topic_rows = ''.join(f'<li>{t}</li>' for t in lda_topic_labels)

    # RF 중요도 상위 키워드
    rf_kw_rows = ''
    if rf_results:
        for i, (kw, val) in enumerate(sorted(rf_results.items(), key=lambda x: -x[1])[:10], 1):
            rf_kw_rows += f'<tr><td>{i}</td><td><strong>{kw}</strong></td><td>{val:.5f}</td></tr>'

    # PCA 설명 분산
    pca_rows = ''
    if pca_obj:
        for i, v in enumerate(pca_obj.explained_variance_ratio_[:10], 1):
            pca_rows += f'<tr><td>PC{i}</td><td>{v*100:.2f}%</td><td>{sum(pca_obj.explained_variance_ratio_[:i])*100:.2f}%</td></tr>'

    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>나이스디앤알 Exit Interview — 박사 논문 수준 종합 통계 분석 리포트</title>
<style>
  :root {{
    --primary: #1a237e;
    --accent:  #0d47a1;
    --int-color: #1565c0;
    --chu-color: #b71c1c;
    --bg: #f8faff;
    --card-bg: #fff;
    --border: #e3e8f0;
    --text: #1a1a2e;
    --muted: #5c6580;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.7;
  }}
  header {{
    background: linear-gradient(135deg, var(--primary) 0%, #311b92 100%);
    color: white;
    padding: 60px 40px;
    text-align: center;
    box-shadow: 0 4px 20px rgba(26,35,126,.4);
  }}
  header h1 {{ font-size: 2.2rem; font-weight: 800; margin-bottom: 12px; }}
  header p {{ font-size: 1.05rem; opacity: 0.88; max-width: 700px; margin: 0 auto; }}
  .badge {{
    display: inline-block;
    background: rgba(255,255,255,.18);
    border: 1px solid rgba(255,255,255,.35);
    border-radius: 20px;
    padding: 4px 14px;
    font-size: 0.82rem;
    margin: 4px;
  }}
  .container {{ max-width: 1300px; margin: 0 auto; padding: 40px 24px; }}
  .kpi-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 18px;
    margin-bottom: 40px;
  }}
  .kpi-card {{
    background: var(--card-bg);
    border-radius: 14px;
    padding: 24px 20px;
    text-align: center;
    box-shadow: 0 2px 12px rgba(0,0,0,.07);
    border-top: 4px solid var(--accent);
  }}
  .kpi-card .kpi-val {{
    font-size: 2.2rem;
    font-weight: 800;
    color: var(--accent);
    line-height: 1;
    margin-bottom: 6px;
  }}
  .kpi-card .kpi-label {{ font-size: 0.88rem; color: var(--muted); }}
  section {{
    background: var(--card-bg);
    border-radius: 16px;
    padding: 36px;
    margin-bottom: 32px;
    box-shadow: 0 2px 14px rgba(0,0,0,.06);
  }}
  section h2 {{
    font-size: 1.45rem;
    font-weight: 800;
    color: var(--primary);
    border-left: 5px solid var(--accent);
    padding-left: 14px;
    margin-bottom: 24px;
  }}
  section h3 {{
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--accent);
    margin: 20px 0 10px;
  }}
  .figure-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(520px, 1fr));
    gap: 24px;
  }}
  .figure-card {{
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--card-bg);
    transition: box-shadow .2s;
  }}
  .figure-card:hover {{ box-shadow: 0 6px 24px rgba(0,0,0,.12); }}
  .figure-card img {{ width: 100%; display: block; }}
  .fig-caption {{
    padding: 10px 14px;
    font-size: 0.82rem;
    color: var(--muted);
    background: #f5f7fb;
    border-top: 1px solid var(--border);
  }}
  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
    margin: 16px 0;
  }}
  th {{
    background: var(--primary);
    color: white;
    padding: 11px 14px;
    text-align: left;
    font-weight: 600;
  }}
  td {{ padding: 9px 14px; border-bottom: 1px solid var(--border); }}
  tr:nth-child(even) td {{ background: #f8f9ff; }}
  tr:hover td {{ background: #eef2ff; }}
  .tag {{
    display: inline-block;
    background: #e8eaf6;
    color: var(--primary);
    border-radius: 10px;
    padding: 2px 10px;
    font-size: 0.78rem;
    margin: 2px;
    font-weight: 600;
  }}
  .method-list {{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
    margin: 16px 0;
  }}
  .method-item {{
    background: #f0f4ff;
    border-left: 4px solid var(--accent);
    padding: 12px 16px;
    border-radius: 0 8px 8px 0;
    font-size: 0.92rem;
  }}
  .method-item strong {{ color: var(--primary); }}
  ol.topic-list {{ padding-left: 20px; }}
  ol.topic-list li {{ margin: 6px 0; font-size: 0.95rem; }}
  .highlight {{ background: #fff8e1; border-left: 4px solid #f9a825; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 12px 0; }}
  footer {{ text-align: center; padding: 40px; color: var(--muted); font-size: 0.85rem; }}
</style>
</head>
<body>
<header>
  <h1>나이스디앤알 Exit Interview</h1>
  <p>박사 논문 수준 종합 통계 분석 리포트<br>
  AI 인터뷰 기반 자동차 구매 의향 및 이탈 요인 분석</p>
  <br>
  <span class="badge">n = {n_total}건</span>
  <span class="badge">20개 분석 기법 적용</span>
  <span class="badge">한국어 NLP (KiwiPiepy)</span>
  <span class="badge">Proby AI Interview Platform</span>
</header>

<div class="container">

<!-- KPI 요약 -->
<div class="kpi-grid">
  <div class="kpi-card"><div class="kpi-val">{n_total}</div><div class="kpi-label">총 인터뷰 건수</div></div>
  <div class="kpi-card" style="border-color:#1565c0"><div class="kpi-val" style="color:#1565c0">{n_intender}</div><div class="kpi-label">의향자 그룹</div></div>
  <div class="kpi-card" style="border-color:#b71c1c"><div class="kpi-val" style="color:#b71c1c">{n_churner}</div><div class="kpi-label">이탈자 그룹</div></div>
  <div class="kpi-card"><div class="kpi-val">{avg_age:.1f}세</div><div class="kpi-label">평균 연령</div></div>
  <div class="kpi-card"><div class="kpi-val">{avg_dur:.1f}분</div><div class="kpi-label">평균 인터뷰 시간</div></div>
  <div class="kpi-card"><div class="kpi-val">{avg_resp:.0f}자</div><div class="kpi-label">평균 응답 길이</div></div>
  {'<div class="kpi-card"><div class="kpi-val">'+f'{lr_results.get("cv_auc", 0):.3f}'+'</div><div class="kpi-label">의향자 판별 AUC</div></div>' if lr_results else ''}
</div>

<!-- 개요 섹션 -->
<section>
  <h2>연구 개요</h2>
  <h3>데이터</h3>
  <p>나이스디앤알에서 수행한 VEHICLE-I Exit Interview 원본 데이터. 
  신차(준중형 세단 VEHICLE-I)에 대한 AI 주도 인터뷰를 통해 의향자와 이탈자 그룹의 인식, 태도, 언어 패턴을 비교 분석하였다.</p>

  <h3>적용 통계 기법 (20종)</h3>
  <div class="method-list">
    <div class="method-item"><strong>01.</strong> 기술통계 — 평균·중앙값·표준편차·변동계수</div>
    <div class="method-item"><strong>02.</strong> Mann-Whitney U 검정 — 비모수 그룹 비교</div>
    <div class="method-item"><strong>03.</strong> Chi-square / Fisher 정확 검정 — 범주 독립성</div>
    <div class="method-item"><strong>04.</strong> Kruskal-Wallis 검정 — 다집단 비모수 ANOVA</div>
    <div class="method-item"><strong>05.</strong> Spearman / Pearson 상관 분석</div>
    <div class="method-item"><strong>06.</strong> 한국어 형태소 분석 (KiwiPiepy)</div>
    <div class="method-item"><strong>07.</strong> TF-IDF 행렬 분석</div>
    <div class="method-item"><strong>08.</strong> LDA 토픽 모델링</div>
    <div class="method-item"><strong>09.</strong> 주성분 분석 (PCA) + 스크리 플롯</div>
    <div class="method-item"><strong>10.</strong> K-평균 군집 분석 + Elbow/Silhouette</div>
    <div class="method-item"><strong>11.</strong> 계층적 군집 (Ward) + 덴드로그램</div>
    <div class="method-item"><strong>12.</strong> 로지스틱 회귀 + 5-Fold CV + ROC</div>
    <div class="method-item"><strong>13.</strong> 랜덤 포레스트 특성 중요도</div>
    <div class="method-item"><strong>14.</strong> 감성 분석 (사전 기반 Sentiment)</div>
    <div class="method-item"><strong>15.</strong> 개념 동시출현 네트워크 + PageRank</div>
    <div class="method-item"><strong>16.</strong> 어휘 다양성 (TTR) 분석</div>
    <div class="method-item"><strong>17.</strong> 대응 분석 (Correspondence Analysis)</div>
    <div class="method-item"><strong>18.</strong> 코사인 유사도 히트맵</div>
    <div class="method-item"><strong>19.</strong> 워드클라우드 (그룹별)</div>
    <div class="method-item"><strong>20.</strong> 키워드 비교 Dot Plot</div>
  </div>
</section>

<!-- 통계 검정 결과 -->
<section>
  <h2>통계 검정 결과 요약</h2>
  <table>
    <thead><tr><th>검정 대상</th><th>검정 방법</th><th>통계량</th><th>p-value</th><th>효과 크기</th><th>유의성</th></tr></thead>
    <tbody>{test_rows}</tbody>
  </table>
  <div class="highlight">
    <strong>해석 기준:</strong> p &lt; 0.05를 통계적 유의 수준으로 설정. 효과 크기는 Cohen's d / Cramér's V / Spearman ρ 기준으로 보고.
  </div>
</section>

<!-- LDA 토픽 -->
<section>
  <h2>LDA 토픽 모델링 — 주요 담론 구조</h2>
  <p>전체 인터뷰 참여자 발화에서 도출된 6개 잠재 토픽:</p>
  <ol class="topic-list">{topic_rows}</ol>
  <div class="highlight">
    <strong>LDA 해석 주의:</strong> 토픽 레이블은 상위 키워드 기반의 해석적 명명이며, 
    단일 발화가 복수 토픽에 부분적으로 귀속될 수 있음.
  </div>
</section>

<!-- 랜덤 포레스트 -->
<section>
  <h2>의향자 / 이탈자 판별 키워드 (Random Forest)</h2>
  {'<table><thead><tr><th>순위</th><th>키워드</th><th>특성 중요도</th></tr></thead><tbody>'+rf_kw_rows+'</tbody></table>' if rf_kw_rows else '<p>랜덤 포레스트 결과 없음</p>'}
  {'<div class="highlight"><strong>모델 성능:</strong> 5-Fold CV AUC = '+f'{lr_results.get("cv_auc",0):.3f}'+' ± '+f'{lr_results.get("auc_std",0):.3f}'+'</div>' if lr_results else ''}
</section>

<!-- PCA -->
<section>
  <h2>주성분 분석 (PCA) — 설명 분산</h2>
  {'<table><thead><tr><th>주성분</th><th>설명 분산(%)</th><th>누적 분산(%)</th></tr></thead><tbody>'+pca_rows+'</tbody></table>' if pca_rows else ''}
</section>

<!-- 그림 갤러리 -->
<section>
  <h2>분석 결과 시각화 갤러리</h2>
  <div class="figure-grid">{fig_tags}</div>
</section>

</div>
<footer>
  <p>Generated by Proby AI Analytics · 나이스디앤알 Exit Interview 분석 · {n_total}건 · 2026</p>
</footer>
</body>
</html>"""

    report_path = OUTPUT_DIR / "NICE_DNR_Statistical_Analysis_Report.html"
    report_path.write_text(html, encoding='utf-8')
    print(f"  HTML 리포트 저장: {report_path}")
    return str(report_path)

# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────
df_global = None  # LDA 함수에서 참조용

def main():
    global df_global
    print("=" * 60)
    print("나이스디앤알 Exit Interview 종합 통계 분석 시작")
    print("=" * 60)

    # 1. 데이터 로드
    print("\n[1-2] 데이터 로드 및 정제")
    records = load_all_interviews()
    df = build_dataframe(records)
    df_global = df

    # 2. 기술통계
    desc_results = descriptive_statistics(df)

    # 3. 통계 검정
    test_results = statistical_tests(df)

    # 4. TF-IDF
    tfidf_matrix, feat_names, tokenized, df = tfidf_analysis(df)
    df_global = df

    # 5. LDA 토픽 모델링
    lda_model, doc_topics, topic_labels = lda_topic_modeling(tokenized, n_topics=6)

    # 6. PCA
    X_pca, pca_obj = pca_analysis(tfidf_matrix, df)

    # 7. K-평균 군집
    cluster_labels, df = kmeans_clustering(X_pca, df)
    df_global = df

    # 8. 계층적 군집
    Z_linkage = hierarchical_clustering(tfidf_matrix, df)

    # 9. 로지스틱 회귀
    lr_results = logistic_regression_analysis(tfidf_matrix, df)

    # 10. 랜덤 포레스트
    rf_results = random_forest_importance(tfidf_matrix, feat_names, df)

    # 11. 대응 분석
    correspondence_analysis(df)

    # 12. 감성 분석
    df = sentiment_analysis(df)
    df_global = df

    # 13. 네트워크 분석
    G, pagerank = cooccurrence_network(df)

    # 14. 인터뷰 복잡도
    df = interview_complexity_analysis(df)
    df_global = df

    # 15. 코사인 유사도
    cosine_similarity_heatmap(tfidf_matrix, df)

    # 16. 워드클라우드
    generate_wordclouds(df)

    # 17. HTML 리포트
    network_stats = {
        'nodes': G.number_of_nodes(),
        'edges': G.number_of_edges(),
        'density': nx.density(G)
    }
    report_path = generate_html_report(
        df, test_results, topic_labels, lr_results, rf_results,
        network_stats, pca_obj
    )

    # 최종 요약
    print("\n" + "=" * 60)
    print("분석 완료!")
    print(f"  → 그림 파일: {FIGURES_DIR}")
    print(f"  → HTML 리포트: {report_path}")
    print("=" * 60)

    return df, test_results

if __name__ == '__main__':
    main()
