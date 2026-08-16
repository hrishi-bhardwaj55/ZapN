import { describe, expect, it } from "vitest";
import { generateBalloons, pumpBalloon, balloonScore, cashOutValue, explosionPenalty } from "../../games/balloon/engine";

describe("Balloon engine", () => {
  it("explodes on the exact hidden breakpoint", () => {
    expect(pumpBalloon(4, 5)).toEqual({ nextPump: 5, exploded: true });
    expect(pumpBalloon(3, 5).exploded).toBe(false);
  });
  it("reproduces thresholds from a seed", () => {
    expect(generateBalloons("seed-a", "medium", 8)).toEqual(generateBalloons("seed-a", "medium", 8));
    expect(generateBalloons("seed-a", "medium", 8)).not.toEqual(generateBalloons("seed-b", "medium", 8));
  });
  it("reports adjusted average pumps as a non-accuracy risk index", () => {
    expect(balloonScore(0, "medium")).toBe(0);
    expect(balloonScore(8, "medium")).toBe(50);
    expect(balloonScore(30, "medium")).toBe(100);
  });
  it("calculates cash-out rewards and configurable explosion penalties", () => {
    expect(cashOutValue(7, 2)).toBe(14);
    expect(explosionPenalty(14, 0.5)).toBe(7);
    expect(explosionPenalty(14, 0)).toBe(0);
  });
  it("keeps generated breakpoints inside each difficulty profile", () => {
    const hard = generateBalloons("ranges", "hard", 30);
    expect(hard.every((trial) => trial.breakpoint >= 2 && trial.breakpoint <= 18)).toBe(true);
  });
  it("keeps color classes balanced while deterministically randomizing their order", () => {
    const trials = generateBalloons("balanced", "medium", 12);
    const counts = trials.reduce<Record<string, number>>((result, trial) => {
      result[trial.color] = (result[trial.color] ?? 0) + 1;
      return result;
    }, {});
    expect(counts).toEqual({ blue: 4, yellow: 4, orange: 4 });
    expect(trials.map((trial) => trial.color)).not.toEqual([
      "blue", "yellow", "orange", "blue", "yellow", "orange",
      "blue", "yellow", "orange", "blue", "yellow", "orange",
    ]);
  });
});
