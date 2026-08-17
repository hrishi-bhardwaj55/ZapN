import { describe, expect, it } from "vitest";
import { arrowsMatch, calculateSwitchCost, generateSwitchTrials, parityAnswer, switchLevelSettings, taskForPosition } from "../../games/switch/engine";

describe("The Switch engine", () => {
  it("derives the active task only from screen position", () => {
    expect(taskForPosition("top")).toBe("NUMBER");
    expect(taskForPosition("bottom")).toBe("ARROWS");
  });

  it("evaluates number parity and arrow equality", () => {
    expect(parityAnswer(12, 11, true)).toBe(true);
    expect(parityAnswer(12, 10, false)).toBe(true);
    expect(arrowsMatch(["↑", "→"], ["↑", "→"])).toBe(true);
    expect(arrowsMatch(["↑", "→"], ["↑", "←"])).toBe(false);
  });

  it("generates deterministic balanced positions with valid answers", () => {
    const trials = generateSwitchTrials("position-seed", 12, 4);
    expect(trials).toEqual(generateSwitchTrials("position-seed", 12, 4));
    expect(trials.filter((trial) => trial.position === "top")).toHaveLength(6);
    expect(trials.filter((trial) => trial.position === "bottom")).toHaveLength(6);
    expect(trials.every((trial) => trial.answer === (trial.task === "NUMBER" ? trial.arithmetic.answer : trial.arrows.answer))).toBe(true);
  });

  it("calculates reaction-time switch cost", () => {
    const base = { response: "yes", correct: true, score: 1 };
    const result = calculateSwitchCost([
      { ...base, round: 1, stimulus: "repeat:top:NUMBER", reactionTimeMs: 300 },
      { ...base, round: 2, stimulus: "repeat:bottom:ARROWS", reactionTimeMs: 500 },
      { ...base, round: 3, stimulus: "switch:top:NUMBER", reactionTimeMs: 700 },
      { ...base, round: 4, stimulus: "switch:bottom:ARROWS", reactionTimeMs: 900 },
    ]);
    expect(result.repeatRt).toBe(400);
    expect(result.switchRt).toBe(800);
    expect(result.switchCost).toBe(400);
  });

  it("makes level ten longer, faster, and more switch-heavy than level one", () => {
    const levelOne = switchLevelSettings(1);
    const levelFive = switchLevelSettings(10);
    const easyTrials = generateSwitchTrials("level-seed", levelOne.total, levelOne.sequenceLength, levelOne.switchRate);
    const hardTrials = generateSwitchTrials("level-seed", levelFive.total, levelFive.sequenceLength, levelFive.switchRate);
    const easyRate = easyTrials.filter((trial) => trial.switched).length / (easyTrials.length - 1);
    const hardRate = hardTrials.filter((trial) => trial.switched).length / (hardTrials.length - 1);
    expect(levelFive.total).toBeGreaterThan(levelOne.total);
    expect(levelFive.sequenceLength).toBeGreaterThan(levelOne.sequenceLength);
    expect(levelFive.responseWindowMs).toBeLessThan(levelOne.responseWindowMs);
    expect(hardRate).toBeGreaterThan(easyRate);
  });
});
