#!/usr/bin/env python3
"""Reproduce key numbers for data.csv → data_정량분석_고급보고서.md (run from any cwd)."""
from __future__ import annotations

import csv
from pathlib import Path

import numpy as np
from scipy import stats
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA, FactorAnalysis
from sklearn.preprocessing import StandardScaler
from scipy.cluster.hierarchy import fcluster, linkage
from scipy.spatial.distance import pdist

HERE = Path(__file__).resolve().parent
CSV_PATH = HERE / "data.csv"


def parse_float(s: str) -> float | None:
    s = (s or "").strip().replace("%", "").replace(",", "")
    if s in ("", "-", "—", "NA", "n/a"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def load_rows():
    with CSV_PATH.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.reader(f))


def build_profile_matrix(rows: list[list[str]]):
    numeric_rows = []
    for r in rows:
        if not r or r[0].strip() == "Base for %":
            continue
        vec = [parse_float(r[j]) for j in range(2, 17)]
        if len(vec) < 10:
            continue
        if sum(v is not None and 0 <= v <= 100 for v in vec) < 8:
            continue
        label = (r[0] or r[1] or "").strip()[:200]
        if not label or label in ("전체", "계", "[평균:세]", "[평균:개]", "[평균:개월]"):
            continue
        arr = np.array([v if v is not None else np.nan for v in vec], dtype=float)
        if np.nanmean(np.abs(arr)) > 150:
            continue
        numeric_rows.append(arr)
    return np.array(numeric_rows)


def row_entropy(row: np.ndarray) -> float:
    x = row[~np.isnan(row)]
    if x.size < 3:
        return float("nan")
    s = np.nansum(x)
    if s <= 0:
        return float("nan")
    p = x / s
    p = p[p > 0]
    return float(-np.sum(p * np.log(p)))


def main():
    rows = load_rows()
    M = build_profile_matrix(rows)
    print("matrix", M.shape)
    X = np.nan_to_num(M, nan=np.nanmedian(M, axis=0))
    Xs = StandardScaler().fit_transform(X)

    pca = PCA(n_components=min(8, Xs.shape[1], Xs.shape[0])).fit(Xs)
    print("PCA var ratio[:5]", [round(x, 4) for x in pca.explained_variance_ratio_[:5]])
    print("PCA cum5", round(float(np.sum(pca.explained_variance_ratio_[:5])), 4))

    fa = FactorAnalysis(n_components=3, random_state=0).fit(Xs)
    print("FA mean noise var", round(float(fa.noise_variance_.mean()), 6))

    km = KMeans(n_clusters=8, random_state=0, n_init=20).fit(Xs)
    from sklearn.metrics import silhouette_score

    sil = silhouette_score(Xs, km.labels_)
    print("KMeans k=8 silhouette", round(float(sil), 4))

    ent = np.array([row_entropy(M[i]) for i in range(M.shape[0])])
    pc1 = pca.transform(Xs)[:, 0]
    m = ~np.isnan(ent)
    rho, pval = stats.spearmanr(pc1[m], ent[m])
    print("Spearman PC1 vs entropy", round(float(rho), 4), pval)

    Mf = np.where(np.isnan(M), np.nanmean(M, axis=1, keepdims=True), M)
    row_means = np.nanmean(Mf, axis=1, keepdims=True)
    Mf = np.where(np.isnan(Mf), row_means, Mf)
    Z = linkage(pdist(Mf, metric="euclidean"), method="ward")
    cl = fcluster(Z, t=12, criterion="maxclust")
    sizes = sorted(np.bincount(cl).tolist(), reverse=True)[:8]
    print("hclust ward maxclust=12 top cluster sizes", sizes)


if __name__ == "__main__":
    main()
