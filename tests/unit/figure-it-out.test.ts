import { describe, expect, it } from "vitest";
import { allCandidates, figureFeedback, generateTarget, reduceCandidates } from "../../games/figure-it-out/engine";

describe("Figure It Out engine", () => {
  it("computes exact attribute feedback", () => {
    const target = { color: "navy", figure: "circle", count: 2 } as const;
    expect(figureFeedback(target, target)).toEqual({ exact: 3, different: 0 });
    expect(figureFeedback({ color: "teal", figure: "circle", count: 1 }, target)).toEqual({ exact: 1, different: 2 });
  });
  it("reduces candidate space without removing the target", () => {
    const target = generateTarget("hidden");
    const guess = { color: "navy", figure: "square", count: 1 } as const;
    const reduced = reduceCandidates(allCandidates(), guess, figureFeedback(guess, target).exact);
    expect(reduced).toContainEqual(target);
    expect(reduced.length).toBeLessThan(allCandidates().length);
  });
});
