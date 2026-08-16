import { describe, expect, it } from "vitest";
import { bfsOptimalMoves, createTowers, isLegalMove, isSolved, moveDisk } from "../../games/skyscraper/engine";

describe("Skyscraper engine", () => {
  it("rejects a larger floor on a smaller floor", () => {
    const towers = moveDisk(createTowers(3), 0, 1)!;
    expect(isLegalMove(towers, 0, 1)).toBe(false);
    expect(moveDisk(towers, 0, 1)).toBeNull();
  });
  it("finds the optimal BFS solution and solves the board", () => {
    const path = bfsOptimalMoves(4);
    expect(path).toHaveLength(15);
    const solved = path.reduce((towers, [from, to]) => moveDisk(towers, from, to)!, createTowers(4));
    expect(isSolved(solved, 4)).toBe(true);
  });
});
