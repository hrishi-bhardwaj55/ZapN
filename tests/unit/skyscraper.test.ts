import { describe, expect, it } from "vitest";
import {
  bfsOptimalMoves,
  generateSkyscraperPuzzle,
  isLegalMove,
  matchesTarget,
  moveBlock,
  skyscraperOptionsForLevel,
} from "../../games/skyscraper/engine";

describe("Skyscraper engine", () => {
  it("moves only the top block and has no size-order rule", () => {
    const stacks = [["blue", "coral"], ["amber"], []];
    expect(isLegalMove(stacks, 0, 1, 3)).toBe(true);
    expect(moveBlock(stacks, 0, 1, 3)).toEqual([["blue"], ["amber", "coral"], []]);
    expect(stacks).toEqual([["blue", "coral"], ["amber"], []]);
  });

  it("rejects empty sources and full destinations without changing state", () => {
    const stacks = [[], ["coral", "blue"], ["amber"]];
    expect(isLegalMove(stacks, 0, 2, 2)).toBe(false);
    expect(isLegalMove(stacks, 2, 1, 2)).toBe(false);
    expect(moveBlock(stacks, 2, 1, 2)).toBe(stacks);
  });

  it("generates a deterministic, solvable puzzle with an exact target", () => {
    const options = { stackCount: 4, pieceCount: 5, capacity: 3, scrambleMoves: 7, minOptimalMoves: 4 };
    const puzzle = generateSkyscraperPuzzle("stack-seed", options);
    expect(puzzle).toEqual(generateSkyscraperPuzzle("stack-seed", options));
    expect(puzzle.optimalPath.length).toBeGreaterThanOrEqual(4);
    const solved = puzzle.optimalPath.reduce(
      (stacks, move) => moveBlock(stacks, move.from, move.to, puzzle.capacity),
      puzzle.initial,
    );
    expect(matchesTarget(solved, puzzle.target)).toBe(true);
    expect(bfsOptimalMoves(puzzle.initial, puzzle.target, puzzle.capacity)).toHaveLength(puzzle.optimalPath.length);
  });

  it("makes level 10 a larger puzzle with a deeper optimal solution than level 1", () => {
    const foundationOptions = skyscraperOptionsForLevel(1);
    const extremeOptions = skyscraperOptionsForLevel(10);
    const foundation = generateSkyscraperPuzzle("level-depth", foundationOptions);
    const extreme = generateSkyscraperPuzzle("level-depth", extremeOptions);

    expect(extremeOptions.pieceCount).toBeGreaterThan(foundationOptions.pieceCount);
    expect(extremeOptions.stackCount).toBeGreaterThan(foundationOptions.stackCount);
    expect(extreme.optimalPath.length).toBeGreaterThan(foundation.optimalPath.length);
    expect(extreme.optimalPath.length).toBeGreaterThanOrEqual(extremeOptions.minOptimalMoves ?? 0);
  });
});
