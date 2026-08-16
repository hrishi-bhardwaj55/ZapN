import { describe, expect, it } from "vitest";
import { generateNumberPuzzles, parseExpression, usesEachNumberOnce, validateSolution } from "../../games/number-box/engine";

describe("Number Box engine", () => {
  it("parses precedence, parentheses, division, and fractions", () => {
    expect(parseExpression("2+3*4")).toBe(14);
    expect(parseExpression("(2+3)*4")).toBe(20);
    expect(parseExpression("3/2")).toBe(1.5);
    expect(() => parseExpression("3/0")).toThrow();
  });
  it("requires every supplied number exactly once", () => {
    expect(usesEachNumberOnce("(2+3)*4", [2, 3, 4])).toBe(true);
    expect(usesEachNumberOnce("2+2+4", [2, 3, 4])).toBe(false);
  });
  it("generates solvable deterministic puzzles", () => {
    const puzzles = generateNumberPuzzles("math", 20, 4);
    expect(puzzles).toEqual(generateNumberPuzzles("math", 20, 4));
    expect(puzzles.every((puzzle) => validateSolution(puzzle.solution, puzzle).valid)).toBe(true);
  });
});
