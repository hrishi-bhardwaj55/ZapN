import { describe, expect, it } from "vitest";
import {
  combineWorkingValues,
  generateNumberPuzzles,
  initialWorkingValues,
  parseExpression,
  usesEachNumberOnce,
  validateSolution,
} from "../../games/number-box/engine";

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
    const puzzles = generateNumberPuzzles("math", 20);
    expect(puzzles).toEqual(generateNumberPuzzles("math", 20));
    expect(puzzles.every((puzzle) => puzzle.target === 24 && puzzle.numbers.length === 4)).toBe(true);
    expect(puzzles.every((puzzle) => validateSolution(puzzle.solution, puzzle).valid)).toBe(true);
  });
  it("collapses two selected values without reusing their source numbers", () => {
    const initial = initialWorkingValues([1, 3, 4, 6]);
    const afterFirst = combineWorkingValues(initial, "number-1", "/", "number-2", "result-1");
    expect(afterFirst.map((item) => item.value)).toEqual([1, 0.75, 6]);
    expect(afterFirst.find((item) => item.id === "result-1")?.sourceIndexes).toEqual([1, 2]);
    expect(() => combineWorkingValues(afterFirst, "result-1", "+", "number-1", "result-2")).toThrow("no longer available");
  });
});
