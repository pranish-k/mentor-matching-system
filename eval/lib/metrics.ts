// Standard ranking metrics over graded relevance labels.
// A label maps slug -> grade: 2 = strong fit, 1 = partial fit; unlabeled = 0.

export type Grades = Record<string, number>;

const relevant = (grades: Grades) => Object.values(grades).filter((g) => g > 0).length;

// Normalized discounted cumulative gain at k, with exponential gain (2^g - 1).
export function ndcg(ranked: string[], grades: Grades, k: number): number {
  const dcg = (gs: number[]) => gs.slice(0, k).reduce((sum, g, i) => sum + (2 ** g - 1) / Math.log2(i + 2), 0);
  const ideal = dcg(Object.values(grades).sort((a, b) => b - a));
  return ideal === 0 ? 0 : dcg(ranked.map((s) => grades[s] ?? 0)) / ideal;
}

// Share of relevant mentors found in the top k, capped so a case with more
// relevant mentors than k can still score 1.
export function recall(ranked: string[], grades: Grades, k: number): number {
  const total = relevant(grades);
  if (total === 0) return 0;
  const hits = ranked.slice(0, k).filter((s) => (grades[s] ?? 0) > 0).length;
  return hits / Math.min(total, k);
}

// Reciprocal rank of the first relevant mentor within the top k.
export function mrr(ranked: string[], grades: Grades, k: number): number {
  const i = ranked.slice(0, k).findIndex((s) => (grades[s] ?? 0) > 0);
  return i === -1 ? 0 : 1 / (i + 1);
}

// 1 if a strong fit (grade 2) is among the top k: what a visitor sees first.
export function strongHit(ranked: string[], grades: Grades, k: number): number {
  return ranked.slice(0, k).some((s) => (grades[s] ?? 0) >= 2) ? 1 : 0;
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
