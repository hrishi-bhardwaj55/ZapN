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
  it("penalizes explosions in the practice heuristic", () => {
    expect(balloonScore(20, 0, 5)).toBeGreaterThan(balloonScore(20, 3, 5));
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
});
