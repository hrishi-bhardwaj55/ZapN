export type Towers = number[][];

export function createTowers(disks: number): Towers {
  return [Array.from({ length: disks }, (_, index) => disks - index), [], []];
}

export function isLegalMove(towers: Towers, from: number, to: number) {
  if (from === to || !towers[from]?.length || !towers[to]) return false;
  const moving = towers[from][towers[from].length - 1];
  const target = towers[to][towers[to].length - 1];
  return target === undefined || moving < target;
}

export function moveDisk(towers: Towers, from: number, to: number): Towers | null {
  if (!isLegalMove(towers, from, to)) return null;
  const next = towers.map((tower) => [...tower]);
  next[to].push(next[from].pop()!);
  return next;
}

export function isSolved(towers: Towers, disks: number) {
  return towers[2].length === disks;
}

function key(towers: Towers) {
  return towers.map((tower) => tower.join(",")).join("|");
}

export function bfsOptimalMoves(disks: number) {
  const start = createTowers(disks);
  const queue: Array<{ towers: Towers; path: Array<[number, number]> }> = [
    { towers: start, path: [] },
  ];
  const visited = new Set([key(start)]);
  while (queue.length) {
    const current = queue.shift()!;
    if (isSolved(current.towers, disks)) return current.path;
    for (let from = 0; from < 3; from += 1) {
      for (let to = 0; to < 3; to += 1) {
        const next = moveDisk(current.towers, from, to);
        if (!next) continue;
        const nextKey = key(next);
        if (visited.has(nextKey)) continue;
        visited.add(nextKey);
        queue.push({ towers: next, path: [...current.path, [from, to]] });
      }
    }
  }
  return [];
}
