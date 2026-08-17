import { describe, expect, it } from "vitest";
import { digitLevelSettings, generateDigits, nextAdaptiveSpan, taskForRound, transformDigits } from "../../games/pincode/engine";

describe("Pincode engine", () => {
  it("supports forward, reverse, and duplicate-safe sorting", () => {
    expect(transformDigits([3, 1, 3], "forward")).toEqual([3, 1, 3]);
    expect(transformDigits([3, 1, 3], "reverse")).toEqual([3, 1, 3]);
    expect(transformDigits([3, 1, 3], "sort")).toEqual([1, 3, 3]);
  });
  it("adjusts adaptive span after every answer within the 4-8 range", () => {
    expect(nextAdaptiveSpan(5, true)).toBe(6);
    expect(nextAdaptiveSpan(5, false)).toBe(4);
    expect(nextAdaptiveSpan(8, true)).toBe(8);
    expect(nextAdaptiveSpan(4, false)).toBe(4);
  });
  it("assigns contiguous repeat, reverse, then sort blocks", () => {
    expect(Array.from({ length: 6 }, (_, round) => taskForRound(round, 6))).toEqual([
      "forward", "forward", "reverse", "reverse", "sort", "sort",
    ]);
    expect(Array.from({ length: 5 }, (_, round) => taskForRound(round, 5))).toEqual([
      "forward", "forward", "reverse", "reverse", "sort",
    ]);
  });
  it("reproduces digit sequences", () => {
    expect(generateDigits("digits", 2, 7)).toEqual(generateDigits("digits", 2, 7));
  });
  it("makes level 10 memory load higher and timing tighter than level 1", () => {
    const level1 = digitLevelSettings(1);
    const level10 = digitLevelSettings(10);
    expect(level10.initialSpan).toBeGreaterThan(level1.initialSpan);
    expect(level10.maximumSpan).toBeGreaterThan(level1.maximumSpan);
    expect(level10.interDigitDelayMs).toBeLessThan(level1.interDigitDelayMs);
    expect(level10.recallWindowMs).toBeLessThan(level1.recallWindowMs);
    expect(nextAdaptiveSpan(level10.initialSpan, true, level10.minimumSpan, level10.maximumSpan)).toBe(9);
    expect(nextAdaptiveSpan(level10.maximumSpan, true, level10.minimumSpan, level10.maximumSpan)).toBe(10);
  });
});
