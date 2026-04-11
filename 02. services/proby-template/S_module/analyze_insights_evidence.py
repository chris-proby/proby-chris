#!/usr/bin/env python3
"""
Statistical evidence for substantive claims in data_정량분석_고급보고서.md §1.
Outputs Markdown tables to stdout (paste into report §1.8).
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from scipy import stats

HERE = Path(__file__).resolve().parent


def two_proportion_ztest(x1: int, n1: int, x2: int, n2: int) -> tuple[float, float, float]:
    """Pooled two-proportion z-test (two-sided). Returns z, p-value, Cohen h."""
    p1, p2 = x1 / n1, x2 / n2
    p_pool = (x1 + x2) / (n1 + n2)
    if p_pool <= 0 or p_pool >= 1:
        return float("nan"), float("nan"), float("nan")
    se = math.sqrt(p_pool * (1 - p_pool) * (1 / n1 + 1 / n2))
    z = (p1 - p2) / se
    pval = 2 * (1 - stats.norm.cdf(abs(z)))
    h = 2 * (math.asin(math.sqrt(p1)) - math.asin(math.sqrt(p2)))
    return z, pval, h


def wilson_ci(x: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return float("nan"), float("nan")
    p = x / n
    denom = 1 + z**2 / n
    centre = (p + z * z / (2 * n)) / denom
    margin = z * math.sqrt((p * (1 - p) / n + z * z / (4 * n * n))) / denom
    return centre - margin, centre + margin


def newcombe_diff_ci(x1: int, n1: int, x2: int, n2: int, z: float = 1.96) -> tuple[float, float]:
    """Newcombe (1998) 95% CI for p1 - p2 (two independent proportions)."""
    L1, U1 = wilson_ci(x1, n1, z)
    L2, U2 = wilson_ci(x2, n2, z)
    d = x1 / n1 - x2 / n2
    lo = d - math.sqrt((x1 / n1 - L1) ** 2 + (U2 - x2 / n2) ** 2)
    hi = d + math.sqrt((U1 - x1 / n1) ** 2 + (x2 / n2 - L2) ** 2)
    return lo, hi


def bootstrap_diff_ma_sa(
    p_ma: float, p_sa: float, n: int = 300, n_boot: int = 20000, seed: int = 0
) -> tuple[float, float, float]:
    """Independent binomial bootstrap for (p_MA - p_SA) on same n (marginal)."""
    rng = np.random.default_rng(seed)
    x1 = rng.binomial(n, p_ma, n_boot)
    x2 = rng.binomial(n, p_sa, n_boot)
    diff = x1 / n - x2 / n
    return float(np.percentile(diff, 2.5)), float(np.percentile(diff, 97.5)), float(np.mean(diff))


def main():
    n_all = 300
    n_u = n_c = 150  # A3, A4 사용자/이탈
    n_a41 = 142  # A4-1 사용자 열
    n_churn_prod = 150  # C1 이탈자 베이스

    rows = []

    # --- A3 매우 만족 / 약간 만족 ---
    # 6) 5.3% vs 25.3%
    x_u, x_c = round(0.053 * n_u), round(0.253 * n_c)
    z, p, h = two_proportion_ztest(x_u, n_u, x_c, n_c)
    lo, hi = newcombe_diff_ci(x_u, n_u, x_c, n_c)
    rows.append(("A3 6) 매우 만족", x_u, n_u, x_c, n_c, z, p, h, lo, hi))

    x_u, x_c = round(0.32 * n_u), round(0.10 * n_c)
    z, p, h = two_proportion_ztest(x_u, n_u, x_c, n_c)
    lo, hi = newcombe_diff_ci(x_u, n_u, x_c, n_c)
    rows.append(("A3 4) 약간 만족", x_u, n_u, x_c, n_c, z, p, h, lo, hi))

    # --- A4 반드시 재구매 / TOP2 ---
    x_u, x_c = round(0.093 * n_u), round(0.307 * n_c)
    z, p, h = two_proportion_ztest(x_u, n_u, x_c, n_c)
    lo, hi = newcombe_diff_ci(x_u, n_u, x_c, n_c)
    rows.append(("A4 6) 반드시 재구매", x_u, n_u, x_c, n_c, z, p, h, lo, hi))

    x_u, x_c = round(0.587 * n_u), round(0.867 * n_c)
    z, p, h = two_proportion_ztest(x_u, n_u, x_c, n_c)
    lo, hi = newcombe_diff_ci(x_u, n_u, x_c, n_c)
    rows.append(("A4 【TOP2】", x_u, n_u, x_c, n_c, z, p, h, lo, hi))

    # --- C1 수분 크림 vs 에센스 스킨 (이탈자 동일 n=150, 중복 MA) ---
    p1, p2 = 0.747, 0.44
    x1, x2 = round(p1 * n_churn_prod), round(p2 * n_churn_prod)
    z, p, h = two_proportion_ztest(x1, n_churn_prod, x2, n_churn_prod)
    lo, hi = newcombe_diff_ci(x1, n_churn_prod, x2, n_churn_prod)
    rows.append(("C1 수분크림 vs 에센스(이탈)", x1, n_churn_prod, x2, n_churn_prod, z, p, h, lo, hi))

    m = len(rows)
    alpha = 0.05
    alpha_b = alpha / m

    print("### 자동 생성 표 (Bonferroni α = 0.05 / m = %d → 단일 검정 %.4f)\n" % (m, alpha_b))
    print("| 검정 | x₁/n₁ (사용자·또는 첫 그룹) | x₂/n₂ (이탈·또는 둘째) | z | p (양측) | p < α/m? | Cohen h | Newcombe 95% CI (p₁−p₂) |")
    print("|------|---------------------------|------------------------|---|----------|----------|---------|---------------------------|")
    for label, a, na, b, nb, z, p, h, lo, hi in rows:
        sig = "예" if p < alpha_b else "아니오"
        print(
            f"| {label} | {a}/{na} | {b}/{nb} | {z:.3f} | {p:.2e} | {sig} | {h:.3f} | [{lo:.3f}, {hi:.3f}] |"
        )

    # MA–SA gap: one-sample t on 4 NET differences (paired categories)
    p_ma = np.array([0.88, 0.663, 0.697, 0.95])
    p_sa = np.array([0.343, 0.147, 0.197, 0.657])
    gaps = p_ma - p_sa
    t_stat, p_t = stats.ttest_1samp(gaps, popmean=0, alternative="greater")
    print("\n### MA–SA NET 괴리 (4계층: 매스·로드샵·일반매스·럭셔리)\n")
    print("| 계층 | p_MA | p_SA | 괴리(퍼센트포인트) |")
    print("|------|------|------|-------------------|")
    names = ["매스", "로드샵 Sub", "일반 매스 Sub", "럭셔리"]
    for nm, a, b, g in zip(names, p_ma, p_sa, gaps):
        print(f"| {nm} | {a*100:.1f}% | {b*100:.1f}% | **{g*100:.1f}** |")
    print(f"\n**단일표본 t-검정**(H₀: 평균 괴리 ≤ 0, H₁: > 0, *n*=4 계층): *t* = {t_stat:.3f}, *p* = {p_t:.4f}")
    print("\n**한계:** 네 NET은 동일 표본의 **서로 다른 문항**(A1 vs A2)이라 반복측정 가정은 약함. 괴리의 **부호 일관성·크기**를 보조 증거로 사용.\n")

    print("### MA vs SA 독립 이항 부트스트랩(n=300×2)으로 괴리 신뢰구간 (주변적)\n")
    print("| 계층 | 점추정(p_MA−p_SA) | 부트스트랩 95% CI |")
    print("|------|------------------|-------------------|")
    for nm, a, b in zip(names, p_ma, p_sa):
        lo, hi, mean = bootstrap_diff_ma_sa(float(a), float(b))
        print(f"| {nm} | {mean*100:.2f}%p | [{lo*100:.1f}, {hi*100:.1f}]%p |")

    # A4-1: 피부 vs 효과 (same n=142 users, NET overlap — conservative independent z)
    p_fit, p_eff = 0.542, 0.141
    x_f = round(p_fit * n_a41)
    x_e = round(p_eff * n_a41)
    z, p, h = two_proportion_ztest(x_f, n_a41, x_e, n_a41)
    lo, hi = newcombe_diff_ci(x_f, n_a41, x_e, n_a41)
    print("\n### A4-1 사용자 *n* = 142: 피부 적합성 NET vs 제품 효과 NET (**보수적 독립 이항** 가정)\n")
    print(
        f"- 피부 적합성: {x_f}/{n_a41} = {p_fit:.3f}, 제품 효과: {x_e}/{n_a41} = {p_eff:.3f}\n"
        f"- *z* = {z:.3f}, 양측 *p* = {p:.2e}, Cohen *h* = {h:.3f}\n"
        f"- Newcombe 95% CI (차이): **[{lo:.3f}, {hi:.3f}]** (양 끝이 0을 넘으면 우열)\n"
        f"- **주의:** NET은 중복응답이라 두 지표는 **통계적 독립이 아님**. 위 검정은 **효과 크기 하한을 보는 보수적 상한**으로 해석하세요.\n"
    )

    # Cohen's d for gap vector (descriptive)
    print("### 효과크기 요약 (Cohen *h* 해석 가이드)\n")
    print("| Cohen h | 해석 |")
    print("|---------|------|")
    print("| 0.2 | 작음 |")
    print("| 0.5 | 중간 |")
    print("| 0.8 | 큼 |")
    print("\n위 A3/A4 검정의 |*h*|는 대부분 **중간~큼** 구간에 들어가 사용자–이탈 차이가 **실질적으로도 큼**을 뒷받침합니다.\n")

    pvals = [r[6] for r in rows]
    fisher = -2 * float(np.sum(np.log(np.array(pvals))))
    df_f = 2 * len(pvals)
    p_fisher = 1 - stats.chi2.cdf(fisher, df_f)
    print("### Fisher 결합 검정 (위 m=5 검정의 *p*값 결합)\n")
    p_f_disp = f"{p_fisher:.2e}" if p_fisher >= 1e-300 else "< 1e-300"
    print(f"- 검정통계량 −2Σln *p* = **{fisher:.2f}**, 자유도 = **{df_f}**, 우측 꼬리 *p* ≈ **{p_f_disp}**\n")
    print("- **해석:** 동시에 우연히 관측될 가능성이 극히 낮아, **1.3~1.6절에서 제시한 차이 패턴이 전반적으로 통계적으로 강함**을 보조 증명합니다.\n")


if __name__ == "__main__":
    main()
