import { describe, expect, it } from "vitest";
import { mean, mrr, ndcg, recall, strongHit } from "./metrics";

const grades = { a: 2, b: 1, c: 1 };

describe("ndcg", () => {
  it("is 1 for the ideal order and 0 with no relevant results", () => {
    expect(ndcg(["a", "b", "c"], grades, 10)).toBeCloseTo(1);
    expect(ndcg(["x", "y"], grades, 10)).toBe(0);
  });

  it("rewards putting the strong fit first", () => {
    expect(ndcg(["a", "b"], grades, 10)).toBeGreaterThan(ndcg(["b", "a"], grades, 10));
  });

  it("only counts the top k", () => {
    expect(ndcg(["x", "a"], grades, 1)).toBe(0);
  });
});

describe("recall", () => {
  it("is the share of relevant mentors found", () => {
    expect(recall(["a", "x", "b"], grades, 10)).toBeCloseTo(2 / 3);
  });

  it("caps the denominator at k", () => {
    expect(recall(["a", "b"], grades, 2)).toBe(1);
  });
});

describe("mrr and strongHit", () => {
  it("use the first relevant / strong result", () => {
    expect(mrr(["x", "b", "a"], grades, 10)).toBe(0.5);
    expect(mrr(["x"], grades, 10)).toBe(0);
    expect(strongHit(["b", "c", "a"], grades, 3)).toBe(1);
    expect(strongHit(["b", "c", "x", "a"], grades, 3)).toBe(0);
  });
});

describe("mean", () => {
  it("handles empty input", () => {
    expect(mean([])).toBe(0);
    expect(mean([1, 0])).toBe(0.5);
  });
});
