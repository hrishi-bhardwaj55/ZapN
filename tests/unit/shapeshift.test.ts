import { describe, expect, it } from "vitest";
import { createMapping, generateShapeTrials, isAnticipatory, SHAPES } from "../../games/shapeshift/engine";

describe("Shapeshift engine", () => {
  it("creates one deterministic direction per shape", () => {
    const mapping = createMapping("mapping-seed");
    expect(createMapping("mapping-seed")).toEqual(mapping);
    expect(new Set(SHAPES.map((shape) => mapping[shape])).size).toBe(4);
  });
  it("avoids immediate repeated stimuli", () => {
    const trials = generateShapeTrials("trial-seed", 40);
    expect(trials.every((shape, index) => index === 0 || shape !== trials[index - 1])).toBe(true);
  });
  it("classifies anticipatory input", () => {
    expect(isAnticipatory(119)).toBe(true);
    expect(isAnticipatory(120)).toBe(false);
  });
});
