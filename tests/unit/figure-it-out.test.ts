import { describe, expect, it } from "vitest";
import { allCandidates, figureFeedback, figureLevelSettings, generateTarget, reduceCandidates } from "../../games/figure-it-out/engine";

describe("Figure It Out engine", () => {
  it("computes exact attribute feedback", () => {
    const target = { color: "navy", figure: "circle", pattern: "striped" } as const;
    expect(figureFeedback(target, target)).toEqual({ right: 3, wrong: 0 });
    expect(figureFeedback({ color: "teal", figure: "circle", pattern: "solid" }, target)).toEqual({ right: 1, wrong: 2 });
  });
  it("reduces candidate space without removing the target", () => {
    const target = generateTarget("hidden");
    const guess = { color: "navy", figure: "square", pattern: "solid" } as const;
    const reduced = reduceCandidates(allCandidates(), guess, figureFeedback(guess, target).right);
    expect(reduced).toContainEqual(target);
    expect(reduced.length).toBeLessThan(allCandidates().length);
  });
  it("uses color, shape, and pattern for every candidate", () => {
    const candidates = allCandidates();
    expect(candidates).toHaveLength(48);
    expect(new Set(candidates.map((candidate) => candidate.pattern))).toEqual(new Set(["solid", "striped", "outline"]));
  });
  it("makes level ten a larger search under a tighter guess budget than level one", () => {
    const levelOne = figureLevelSettings(1);
    const levelTen = figureLevelSettings(10);
    expect(allCandidates(1)).toHaveLength(12);
    expect(allCandidates(10)).toHaveLength(80);
    expect(allCandidates(10).length).toBeGreaterThan(allCandidates(1).length);
    expect(levelTen.maxGuesses).toBeLessThan(levelOne.maxGuesses);
    expect(generateTarget("level-seed", 10)).toEqual(generateTarget("level-seed", 10));
  });
});
