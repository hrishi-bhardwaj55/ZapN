import { describe, expect, it } from "vitest";
import { generateDigits, nextAdaptiveSpan, transformDigits } from "../../games/pincode/engine";

describe("Pincode engine", () => {
  it("supports forward, reverse, and duplicate-safe sorting", () => {
    expect(transformDigits([3, 1, 3], "forward")).toEqual([3, 1, 3]);
    expect(transformDigits([3, 1, 3], "reverse")).toEqual([3, 1, 3]);
    expect(transformDigits([3, 1, 3], "sort")).toEqual([1, 3, 3]);
  });
  it("raises span after two correct recalls and reduces after an error", () => {
    expect(nextAdaptiveSpan(5, 1, true)).toEqual({ span: 6, streak: 0 });
    expect(nextAdaptiveSpan(5, 1, false)).toEqual({ span: 4, streak: 0 });
  });
  it("reproduces digit sequences", () => {
    expect(generateDigits("digits", 2, 7)).toEqual(generateDigits("digits", 2, 7));
  });
});
