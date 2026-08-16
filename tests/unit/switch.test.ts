import { describe, expect, it } from "vitest";
import { arrowsMatch, calculateSwitchCost, generateSwitchTrials, parityAnswer } from "../../games/switch/engine";

describe("Switch engine", () => {
  it("calculates parity and arrow equality", () => {
    expect(parityAnswer(13, 8, true)).toBe(true);
    expect(parityAnswer(13, 8, false)).toBe(false);
    expect(arrowsMatch(["↑", "→"], ["↑", "→"])).toBe(true);
    expect(arrowsMatch(["↑", "→"], ["↑", "←"])).toBe(false);
  });
  it("generates both switches and repeats deterministically", () => {
    const trials = generateSwitchTrials("tasks", 60);
    expect(trials).toEqual(generateSwitchTrials("tasks", 60));
    expect(trials.some((trial) => trial.switched)).toBe(true);
    expect(trials.some((trial) => !trial.switched)).toBe(true);
  });
  it("calculates switch cost", () => {
    const base = { response: "yes", correct: true, score: 1 };
    const result = calculateSwitchCost([
      { ...base, round: 1, stimulus: "repeat:NUMBER", reactionTimeMs: 400 },
      { ...base, round: 2, stimulus: "switch:ARROWS", reactionTimeMs: 550 },
    ]);
    expect(result.switchCost).toBe(150);
  });
});
