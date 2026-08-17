import { describe, expect, it } from "vitest";
import {
  combineWorkingValues,
  countSolutionsTo24,
  generateNumberPuzzles,
  initialWorkingValues,
  parseExpression,
  meetsOperatorRequirements,
  numberBoxLevelSettings,
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
  it("makes level 10 puzzles rarer, operator-constrained, and faster than level 1", () => {
    const level1 = numberBoxLevelSettings(1);
    const level10 = numberBoxLevelSettings(10);
    expect(level10.maximumOperand).toBeGreaterThan(level1.maximumOperand);
    expect(level10.maximumSolutionCount).toBeLessThan(level1.maximumSolutionCount);
    expect(level10.requiredOperators.length).toBeGreaterThan(level1.requiredOperators.length);
    expect(level10.responseWindowMs).toBeLessThan(level1.responseWindowMs);
    const puzzles = generateNumberPuzzles("extreme-math", 8, 10);
    expect(puzzles.every((puzzle) => validateSolution(puzzle.solution, puzzle).valid)).toBe(true);
    expect(puzzles.every((puzzle) => meetsOperatorRequirements(puzzle.solution, level10.requiredOperators))).toBe(true);
    expect(puzzles.every((puzzle) => countSolutionsTo24(puzzle.numbers, level10.requiredOperators, 9) <= 8)).toBe(true);
  });
});
