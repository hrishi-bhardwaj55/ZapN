import { describe, expect, it } from "vitest";
import {
  escalatedVelocity,
  gaugeClickOutcome,
  generateGauges,
  normalizeAngle,
  rescheduleGauge,
  stockLevelSettings,
  targetContains,
  targetPassState,
} from "../../games/stock-master/engine";

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
  it("keeps graded early and late outcomes outside the target", () => {
    const early = gaugeClickOutcome({ id: 0, angle: 300, angularVelocity: 40, targetStartAngle: 350, targetEndAngle: 10 });
    const late = gaugeClickOutcome({ id: 0, angle: 60, angularVelocity: 40, targetStartAngle: 350, targetEndAngle: 10 });
    expect(early).toMatchObject({ classification: "EARLY", precision: 0 });
    expect(late).toMatchObject({ classification: "LATE", precision: 0 });
  });
  it("marks a target pass only after a needle has entered and then exited", () => {
    const gauge = { id: 0, angle: 5, angularVelocity: 40, targetStartAngle: 350, targetEndAngle: 10 };
    expect(targetPassState(gauge, false)).toEqual({ inside: true, missed: false });
    gauge.angle = 11;
    expect(targetPassState(gauge, true)).toEqual({ inside: false, missed: true });
    expect(targetPassState(gauge, false)).toEqual({ inside: false, missed: false });
  });
  it("escalates speed without changing direction or spatial identity", () => {
    expect(escalatedVelocity(40, 1)).toBeGreaterThan(40);
    expect(escalatedVelocity(-40, 1)).toBeLessThan(-40);
    const original = { id: 3, angle: 90, angularVelocity: -40, targetStartAngle: 120, targetEndAngle: 162 };
    const next = rescheduleGauge(original, 4);
    expect(next.id).toBe(3);
    expect(next.angularVelocity).toBeLessThan(original.angularVelocity);
  });
  it("generates deterministic independent gauges", () => {
    const gauges = generateGauges("gauges", 6, true);
    expect(gauges).toEqual(generateGauges("gauges", 6, true));
    expect(gauges.map((gauge) => gauge.id)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("makes level five denser, faster, narrower, and more overlapping than level one", () => {
    const levelOne = stockLevelSettings(1);
    const levelFive = stockLevelSettings(5);
    const easy = generateGauges("level-seed", levelOne.gaugeCount, levelOne);
    const hard = generateGauges("level-seed", levelFive.gaugeCount, levelFive);
    const arrivalSpread = (gauges: typeof easy) => {
      const arrivals = gauges.map((gauge) => gaugeClickOutcome(gauge).timeToTargetMs);
      return Math.max(...arrivals) - Math.min(...arrivals);
    };
    expect(hard.length).toBeGreaterThan(easy.length);
    expect(normalizeAngle(hard[0].targetEndAngle - hard[0].targetStartAngle)).toBeLessThan(
      normalizeAngle(easy[0].targetEndAngle - easy[0].targetStartAngle),
    );
    expect(Math.min(...hard.map((gauge) => Math.abs(gauge.angularVelocity)))).toBeGreaterThan(
      Math.max(...easy.map((gauge) => Math.abs(gauge.angularVelocity))),
    );
    expect(hard.some((gauge) => gauge.angularVelocity < 0)).toBe(true);
    expect(arrivalSpread(hard)).toBeLessThan(arrivalSpread(easy));
  });
});
