import { describe, expect, it } from "vitest";
import { codeCompareLevelSettings, generateCodeTrials, hasExactlyOneMatch } from "../../games/code-compare/engine";

describe("Code Compare engine", () => {
  it("generates one exact numeric match and three mutated distractors", () => {
    const trials = generateCodeTrials("codes", 25, 8);
    expect(trials.every(hasExactlyOneMatch)).toBe(true);
    expect(trials.every((trial) => trial.choices.length === 4 && new Set(trial.choices).size === 4)).toBe(true);
    expect(trials.every((trial) => trial.reference.length === 8)).toBe(true);
    expect(trials.every((trial) => /^\d{8}$/.test(trial.reference) && trial.choices.every((choice) => /^\d{8}$/.test(choice)))).toBe(true);
    expect(trials.every((trial) => trial.mutationPositions.length === 3)).toBe(true);
  });
  it("is deterministic", () => {
    expect(generateCodeTrials("same", 4, 6)).toEqual(generateCodeTrials("same", 4, 6));
  });
  it("makes level 10 denser and faster than level 1", () => {
    const level1 = codeCompareLevelSettings(1);
    const level10 = codeCompareLevelSettings(10);
    expect(level10.codeLength).toBeGreaterThan(level1.codeLength);
    expect(level10.choiceCount).toBeGreaterThan(level1.choiceCount);
    expect(level10.responseWindowMs).toBeLessThan(level1.responseWindowMs);
    expect(level10.mutationKinds.length).toBeGreaterThan(level1.mutationKinds.length);
    const trials = generateCodeTrials("extreme", 20, level10.codeLength, level10.choiceCount, level10.mutationKinds);
    expect(trials.every(hasExactlyOneMatch)).toBe(true);
    expect(trials.every((trial) => trial.choices.length === 6)).toBe(true);
    expect(trials.some((trial) => trial.mutationKinds.some((kind) => kind !== "single"))).toBe(true);
  });
});
