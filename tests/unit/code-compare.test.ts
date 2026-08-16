import { describe, expect, it } from "vitest";
import { generateCodeTrials, hasExactlyOneMatch } from "../../games/code-compare/engine";

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
});
