import type { Board, LevelSpec, Tube } from "./types";

export const TUBE_HEIGHT = 4;
export const MAX_LIVES = 5;
export const LIFE_MS = 5 * 60 * 1000;
export const MAX_LEVEL = 200;

export function topColor(tube: Tube): number | undefined {
  return tube[tube.length - 1];
}

export function isUniform(tube: Tube): boolean {
  if (tube.length === 0) return true;
  const c = tube[0];
  return tube.every((x) => x === c);
}

export function isComplete(tube: Tube, height: number): boolean {
  return tube.length === height && isUniform(tube) && tube.length > 0;
}

export function isSolved(board: Board): boolean {
  return board.tubes.every((t) => t.length === 0 || isComplete(t, board.height));
}

export function pourAmount(from: Tube, to: Tube, height: number): number {
  if (from.length === 0) return 0;
  if (to.length >= height) return 0;
  const color = topColor(from);
  if (color === undefined) return 0;
  if (to.length > 0 && topColor(to) !== color) return 0;
  let n = 0;
  for (let i = from.length - 1; i >= 0 && from[i] === color; i--) n++;
  return Math.min(n, height - to.length);
}

export function applyPour(board: Board, from: number, to: number): Board | null {
  if (from === to) return null;
  const amt = pourAmount(board.tubes[from], board.tubes[to], board.height);
  if (amt === 0) return null;
  const tubes = board.tubes.map((t) => t.slice());
  const moved = tubes[from].splice(tubes[from].length - amt, amt);
  tubes[to].push(...moved);
  const veiled = (board.veiled ?? []).filter((i) => i !== from && i !== to);
  return { ...board, tubes, veiled };
}

export function cloneTubes(tubes: Tube[]): Tube[] {
  return tubes.map((t) => t.slice());
}

function canonKey(tubes: Tube[]): string {
  return tubes
    .map((t) => t.join(","))
    .slice()
    .sort()
    .join("|");
}

function legalMoves(board: Board): Array<[number, number]> {
  const moves: Array<[number, number]> = [];
  const { tubes, height } = board;
  for (let i = 0; i < tubes.length; i++) {
    if (tubes[i].length === 0 || isComplete(tubes[i], height)) continue;
    for (let j = 0; j < tubes.length; j++) {
      if (i === j) continue;
      const amt = pourAmount(tubes[i], tubes[j], height);
      if (amt === 0) continue;
      if (tubes[j].length === 0 && isUniform(tubes[i]) && amt === tubes[i].length) continue;
      moves.push([i, j]);
    }
  }
  return moves;
}

function scoreMove(board: Board, from: number, to: number): number {
  const amt = pourAmount(board.tubes[from], board.tubes[to], board.height);
  const destLen = board.tubes[to].length + amt;
  const srcLeft = board.tubes[from].length - amt;
  let s = 0;
  if (board.tubes[to].length > 0 && destLen === board.height) s += 80;
  if (srcLeft === 0) s += 24;
  if (board.tubes[to].length > 0) s += 12;
  return s;
}

export function hasAnyMove(board: Board): boolean {
  return legalMoves(board).length > 0;
}

export function isSolvable(board: Board, limit = 18000): boolean {
  if (isSolved(board)) return true;
  const seen = new Set<string>([canonKey(board.tubes)]);
  const stack: Board[] = [board];
  let n = 0;
  while (stack.length && n < limit) {
    const cur = stack.pop()!;
    n++;
    const moves = legalMoves(cur).sort(
      (a, b) => scoreMove(cur, b[0], b[1]) - scoreMove(cur, a[0], a[1]),
    );
    for (const [i, j] of moves) {
      const next = applyPour(cur, i, j);
      if (!next) continue;
      if (isSolved(next)) return true;
      const k = canonKey(next.tubes);
      if (seen.has(k)) continue;
      seen.add(k);
      stack.push(next);
    }
  }
  return false;
}

export function findHint(board: Board): [number, number] | null {
  const path = solvePath(board, 14000);
  if (path && path.length) return path[0];
  const moves = legalMoves(board).sort(
    (a, b) => scoreMove(board, b[0], b[1]) - scoreMove(board, a[0], a[1]),
  );
  return moves[0] ?? null;
}

export function solvePath(board: Board, limit = 18000): Array<[number, number]> | null {
  if (isSolved(board)) return [];
  const seen = new Set<string>([canonKey(board.tubes)]);
  const stack: Array<{ b: Board; path: Array<[number, number]> }> = [{ b: board, path: [] }];
  let n = 0;
  while (stack.length && n < limit) {
    const cur = stack.pop()!;
    n++;
    const moves = legalMoves(cur.b).sort(
      (a, b) => scoreMove(cur.b, b[0], b[1]) - scoreMove(cur.b, a[0], a[1]),
    );
    for (const [i, j] of moves) {
      const next = applyPour(cur.b, i, j);
      if (!next) continue;
      const path = [...cur.path, [i, j] as [number, number]];
      if (isSolved(next)) return path;
      const k = canonKey(next.tubes);
      if (seen.has(k)) continue;
      seen.add(k);
      stack.push({ b: next, path });
    }
  }
  return null;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fallbackBoard(spec: LevelSpec): Board {
  const tubes: Tube[] = [];
  for (let c = 0; c < spec.colors; c++) {
    tubes.push(Array.from({ length: spec.height }, () => c));
  }
  if (tubes.length >= 2) {
    const a = tubes[0][spec.height - 1];
    tubes[0][spec.height - 1] = tubes[1][spec.height - 1];
    tubes[1][spec.height - 1] = a;
  }
  if (tubes.length >= 3 && spec.colors >= 3) {
    const a = tubes[1][0];
    tubes[1][0] = tubes[2][0];
    tubes[2][0] = a;
  }
  for (let i = 0; i < spec.empty; i++) tubes.push([]);
  return { tubes, height: spec.height, veiled: [] };
}

function randomBoard(spec: LevelSpec, rng: () => number): Board {
  let balls: number[] = [];
  for (let c = 0; c < spec.colors; c++) {
    for (let k = 0; k < spec.height; k++) balls.push(c);
  }
  balls = shuffle(balls, rng);
  const tubes: Tube[] = [];
  let idx = 0;
  for (let t = 0; t < spec.colors; t++) {
    tubes.push(balls.slice(idx, idx + spec.height));
    idx += spec.height;
  }
  for (let i = 0; i < spec.empty; i++) tubes.push([]);
  return { tubes, height: spec.height, veiled: [] };
}

export function specForLevel(level: number): LevelSpec {
  const n = Math.max(1, level);
  if (n <= 3) return { colors: 2, height: 4, empty: 2 };
  if (n <= 8) return { colors: 3, height: 4, empty: 2 };
  if (n <= 16) return { colors: 4, height: 4, empty: 2 };
  if (n <= 28) return { colors: 5, height: 4, empty: 2 };
  if (n <= 42) return { colors: 6, height: 4, empty: 2 };
  if (n <= 58) return { colors: 7, height: 4, empty: 2 };
  if (n <= 80) return { colors: 8, height: 4, empty: 2 };
  if (n <= 120) return { colors: 8, height: 5, empty: 2 };
  if (n <= 160) return { colors: 8, height: 5, empty: 3 };
  return { colors: 8, height: 5, empty: 3 };
}

const HAND: Record<number, Tube[]> = {
  1: [
    [0, 0, 0, 1],
    [1, 1, 1, 0],
    [],
    [],
  ],
  2: [
    [0, 1, 0, 1],
    [1, 0, 1, 0],
    [],
    [],
  ],
  3: [
    [0, 0, 1, 1],
    [1, 1, 0, 0],
    [],
    [],
  ],
  4: [
    [0, 1, 2, 0],
    [1, 2, 0, 1],
    [2, 0, 1, 2],
    [],
    [],
  ],
  5: [
    [0, 1, 0, 2],
    [2, 2, 1, 0],
    [1, 0, 2, 1],
    [],
    [],
  ],
  6: [
    [0, 1, 2, 0],
    [1, 2, 0, 1],
    [2, 0, 1, 2],
    [],
    [],
  ],
  7: [
    [0, 0, 1, 1],
    [2, 2, 0, 0],
    [1, 1, 2, 2],
    [],
    [],
  ],
  8: [
    [0, 1, 0, 2],
    [2, 1, 2, 0],
    [1, 2, 1, 0],
    [],
    [],
  ],
  9: [
    [0, 0, 1, 1],
    [1, 1, 2, 2],
    [2, 2, 3, 3],
    [3, 3, 0, 0],
    [],
    [],
  ],
  10: [
    [0, 1, 2, 3],
    [3, 0, 1, 2],
    [2, 3, 0, 1],
    [1, 2, 3, 0],
    [],
    [],
  ],
  11: [
    [0, 1, 0, 1],
    [1, 0, 1, 0],
    [2, 3, 2, 3],
    [3, 2, 3, 2],
    [],
    [],
  ],
  12: [
    [0, 0, 1, 1],
    [2, 2, 3, 3],
    [1, 1, 0, 0],
    [3, 3, 2, 2],
    [],
    [],
  ],
  13: [
    [0, 1, 2, 3],
    [3, 2, 1, 0],
    [0, 1, 2, 3],
    [3, 2, 1, 0],
    [],
    [],
  ],
  14: [
    [0, 0, 0, 1],
    [1, 1, 1, 2],
    [2, 2, 2, 3],
    [3, 3, 3, 0],
    [],
    [],
  ],
  15: [
    [0, 0, 0, 1],
    [1, 1, 1, 0],
    [2, 2, 2, 3],
    [3, 3, 3, 2],
    [],
    [],
  ],
  16: [
    [0, 1, 2, 0],
    [1, 2, 3, 1],
    [2, 3, 0, 2],
    [3, 0, 1, 3],
    [],
    [],
  ],
  17: [
    [0, 1, 2, 3],
    [4, 0, 1, 2],
    [3, 4, 0, 1],
    [2, 3, 4, 0],
    [1, 2, 3, 4],
    [],
    [],
  ],
  18: [
    [0, 0, 1, 1],
    [2, 2, 3, 3],
    [4, 4, 0, 0],
    [1, 1, 2, 2],
    [3, 3, 4, 4],
    [],
    [],
  ],
  19: [
    [0, 1, 0, 2],
    [2, 3, 1, 4],
    [4, 0, 3, 1],
    [1, 2, 4, 3],
    [3, 4, 2, 0],
    [],
    [],
  ],
  20: [
    [0, 0, 0, 1],
    [1, 1, 1, 2],
    [2, 2, 2, 3],
    [3, 3, 3, 4],
    [4, 4, 4, 0],
    [],
    [],
  ],
  21: [
    [0, 4, 1, 4],
    [1, 0, 2, 3],
    [2, 1, 3, 0],
    [3, 2, 0, 1],
    [4, 3, 4, 2],
    [],
    [],
  ],
  22: [
    [0, 1, 2, 4],
    [1, 2, 3, 0],
    [2, 3, 4, 1],
    [3, 4, 0, 2],
    [4, 0, 1, 3],
    [],
    [],
  ],
  23: [
    [0, 0, 1, 2],
    [3, 3, 4, 1],
    [2, 2, 0, 4],
    [1, 1, 3, 0],
    [4, 4, 2, 3],
    [],
    [],
  ],
  24: [
    [0, 1, 2, 3],
    [4, 4, 4, 0],
    [1, 2, 3, 1],
    [2, 3, 0, 2],
    [3, 0, 1, 4],
    [],
    [],
  ],
  25: [
    [0, 1, 2, 3],
    [4, 0, 1, 2],
    [5, 4, 0, 1],
    [3, 5, 4, 0],
    [2, 3, 5, 4],
    [1, 2, 3, 5],
    [],
    [],
  ],
  26: [
    [0, 0, 1, 1],
    [2, 2, 3, 3],
    [4, 4, 5, 5],
    [1, 1, 0, 0],
    [3, 3, 2, 2],
    [5, 5, 4, 4],
    [],
    [],
  ],
  27: [
    [0, 1, 2, 0],
    [1, 2, 3, 1],
    [2, 3, 4, 2],
    [3, 4, 5, 3],
    [4, 5, 0, 4],
    [5, 0, 1, 5],
    [],
    [],
  ],
  28: [
    [0, 5, 1, 4],
    [1, 0, 2, 5],
    [2, 1, 3, 0],
    [3, 2, 4, 1],
    [4, 3, 5, 2],
    [5, 4, 0, 3],
    [],
    [],
  ],
  29: [
    [0, 0, 0, 1],
    [1, 1, 1, 2],
    [2, 2, 2, 3],
    [3, 3, 3, 4],
    [4, 4, 4, 5],
    [5, 5, 5, 0],
    [],
    [],
  ],
  30: [
    [0, 1, 2, 3],
    [4, 5, 0, 1],
    [2, 3, 4, 5],
    [0, 1, 2, 3],
    [4, 5, 0, 1],
    [2, 3, 4, 5],
    [],
    [],
  ],
};

const cache = new Map<string, Board>();

export function makeBoard(level: number, kind: "campaign" | "daily" = "campaign"): Board {
  const key = `${kind}:${level}`;
  const hit = cache.get(key);
  if (hit) return { tubes: cloneTubes(hit.tubes), height: hit.height, veiled: [...hit.veiled] };

  if (kind === "campaign" && HAND[level]) {
    const tubes = cloneTubes(HAND[level]);
    let veiled: number[] = [];
    if (level >= 25) {
      const filled = tubes.map((_, i) => i).filter((i) => tubes[i].length > 0);
      if (filled.length > 1) veiled = [filled[Math.floor(filled.length / 2)]];
    }
    const board: Board = { tubes, height: TUBE_HEIGHT, veiled };
    cache.set(key, board);
    return { tubes: cloneTubes(board.tubes), height: board.height, veiled: [...board.veiled] };
  }

  const spec = specForLevel(kind === "daily" ? Math.max(20, (level % 50) + 18) : level);
  const seed =
    kind === "daily" ? 900_000 + level * 97 : 12_000 + level * 7919;
  const rng = mulberry32(seed);
  const nodeLimit = spec.height >= 5 ? 24000 : 18000;

  for (let attempt = 0; attempt < 60; attempt++) {
    const board = randomBoard(spec, rng);
    const complete = board.tubes.filter((t) => isComplete(t, board.height)).length;
    if (complete >= spec.colors - 1) continue;
    if (isSolved(board)) continue;
    if (isSolvable(board, nodeLimit)) {
      if (level >= 25 && spec.colors >= 4) {
        const filled = board.tubes.map((_, i) => i).filter((i) => board.tubes[i].length > 0);
        if (filled.length) board.veiled = [filled[Math.floor(rng() * filled.length)]];
      }
      cache.set(key, board);
      return { tubes: cloneTubes(board.tubes), height: board.height, veiled: [...board.veiled] };
    }
  }

  const board = fallbackBoard(spec);
  cache.set(key, board);
  return { tubes: cloneTubes(board.tubes), height: board.height, veiled: [] };
}

export function addExtraTube(board: Board): Board {
  return { ...board, tubes: [...board.tubes.map((t) => t.slice()), []], veiled: [...board.veiled] };
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dailySeed(date = todayKey()): number {
  let h = 2166136261;
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
