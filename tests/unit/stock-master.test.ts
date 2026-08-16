import { describe, expect, it } from "vitest";
import { gaugeClickOutcome, generateGauges, normalizeAngle, targetContains } from "../../games/stock-master/engine";

describe("Stock Master engine", () => {
  it("normalizes angles and supports wraparound targets", () => {
    expect(normalizeAngle(-10)).toBe(350);
    expect(normalizeAngle(370)).toBe(10);
    expect(targetContains(355, 350, 15)).toBe(true);
    expect(targetContains(5, 350, 15)).toBe(true);
    expect(targetContains(180, 350, 15)).toBe(false);
  });
  it("classifies centered hits with full precision", () => {
    const result = gaugeClickOutcome({ id: 0, angle: 0, angularVelocity: 40, targetStartAngle: 350, targetEndAngle: 10 });
    expect(result.classification).toBe("HIT");
    expect(result.precision).toBe(1);
  });
  it("generates deterministic independent gauges", () => {
    expect(generateGauges("gauges", 6, true)).toEqual(generateGauges("gauges", 6, true));
  });
});
