export type Cell = { row: number; col: number };
export type Maze = {
  rows: number;
  cols: number;
  horizontal: boolean[][];
  vertical: boolean[][];
  start: Cell;
  hunter: Cell;
  exit: Cell;
};

const key = (cell: Cell) => `${cell.row}:${cell.col}`;

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const item = result[i];
    const replacement = result[j];
    if (item === undefined || replacement === undefined) continue;
    result[i] = replacement;
    result[j] = item;
  }
  return result;
}

export function neighbors(maze: Maze, cell: Cell): Cell[] {
  const next: Cell[] = [];
  if (cell.row > 0 && !maze.horizontal[cell.row]?.[cell.col]) next.push({ row: cell.row - 1, col: cell.col });
  if (cell.row < maze.rows - 1 && !maze.horizontal[cell.row + 1]?.[cell.col]) next.push({ row: cell.row + 1, col: cell.col });
  if (cell.col > 0 && !maze.vertical[cell.row]?.[cell.col]) next.push({ row: cell.row, col: cell.col - 1 });
  if (cell.col < maze.cols - 1 && !maze.vertical[cell.row]?.[cell.col + 1]) next.push({ row: cell.row, col: cell.col + 1 });
  return next;
}

export function cellsFrom(maze: Maze, from: Cell): Array<Cell & { distance: number }> {
  const seen = new Set<string>([key(from)]);
  const queue: Array<Cell & { distance: number }> = [{ ...from, distance: 0 }];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (!current) continue;
    for (const next of neighbors(maze, current)) {
      if (seen.has(key(next))) continue;
      seen.add(key(next));
      queue.push({ ...next, distance: current.distance + 1 });
    }
  }
  return queue;
}

export function findPath(maze: Maze, from: Cell, to: Cell): Cell[] {
  const queue = [from];
  const previous = new Map<string, Cell | null>([[key(from), null]]);
  while (queue.length) {
    const current = queue.shift();
    if (!current) break;
    if (current.row === to.row && current.col === to.col) {
      const path: Cell[] = [];
      let cursor: Cell | null = current;
      while (cursor) {
        path.unshift(cursor);
        cursor = previous.get(key(cursor)) ?? null;
      }
      return path;
    }
    for (const next of neighbors(maze, current)) {
      if (!previous.has(key(next))) {
        previous.set(key(next), current);
        queue.push(next);
      }
    }
  }
  return [];
}

function farthestCell(maze: Maze, from: Cell, excluded?: Cell): Cell {
  const queue = [from];
  const distance = new Map<string, number>([[key(from), 0]]);
  let best = from;
  while (queue.length) {
    const current = queue.shift();
    if (!current) break;
    const currentDistance = distance.get(key(current)) ?? 0;
    const excludedDistance = excluded ? Math.abs(current.row - excluded.row) + Math.abs(current.col - excluded.col) : 99;
    if (currentDistance >= (distance.get(key(best)) ?? 0) && excludedDistance > 3) best = current;
    for (const next of neighbors(maze, current)) {
      if (!distance.has(key(next))) {
        distance.set(key(next), currentDistance + 1);
        queue.push(next);
      }
    }
  }
  return best;
}

export function generateMaze(level: number): Maze {
  const size = Math.min(15, 9 + Math.floor((level - 1) / 2) * 2);
  const rows = size;
  const cols = size;
  const horizontal = Array.from({ length: rows + 1 }, () => Array(cols).fill(true) as boolean[]);
  const vertical = Array.from({ length: rows }, () => Array(cols + 1).fill(true) as boolean[]);
  const visited = new Set<string>();
  const start = { row: Math.floor(Math.random() * rows), col: Math.floor(Math.random() * cols) };
  const stack = [start];
  visited.add(key(start));

  while (stack.length) {
    const current = stack[stack.length - 1];
    if (!current) break;
    const choices = shuffled([
      { row: current.row - 1, col: current.col },
      { row: current.row + 1, col: current.col },
      { row: current.row, col: current.col - 1 },
      { row: current.row, col: current.col + 1 },
    ]).filter((cell) => cell.row >= 0 && cell.row < rows && cell.col >= 0 && cell.col < cols && !visited.has(key(cell)));
    const next = choices[0];
    if (!next) {
      stack.pop();
      continue;
    }
    if (next.row !== current.row) horizontal[Math.max(next.row, current.row)]![current.col] = false;
    else vertical[current.row]![Math.max(next.col, current.col)] = false;
    visited.add(key(next));
    stack.push(next);
  }

  const maze: Maze = { rows, cols, horizontal, vertical, start, hunter: start, exit: start };
  maze.exit = farthestCell(maze, start);
  maze.hunter = farthestCell(maze, start, maze.exit);
  return maze;
}

export function canMove(maze: Maze, x: number, y: number, nextX: number, nextY: number, radius = 0.2): boolean {
  const epsilon = 0.015;
  const minCol = Math.max(0, Math.floor(nextX - radius));
  const maxCol = Math.min(maze.cols - 1, Math.floor(nextX + radius));
  const minRow = Math.max(0, Math.floor(nextY - radius));
  const maxRow = Math.min(maze.rows - 1, Math.floor(nextY + radius));
  if (nextX - radius < 0 || nextX + radius > maze.cols || nextY - radius < 0 || nextY + radius > maze.rows) return false;
  if (nextX > x) {
    for (let col = Math.floor(x + radius + epsilon) + 1; col <= Math.floor(nextX + radius + epsilon); col += 1) {
      for (let row = minRow; row <= maxRow; row += 1) if (maze.vertical[row]?.[col]) return false;
    }
  } else if (nextX < x) {
    for (let col = Math.floor(x - radius - epsilon); col > Math.floor(nextX - radius - epsilon); col -= 1) {
      for (let row = minRow; row <= maxRow; row += 1) if (maze.vertical[row]?.[col]) return false;
    }
  }
  if (nextY > y) {
    for (let row = Math.floor(y + radius + epsilon) + 1; row <= Math.floor(nextY + radius + epsilon); row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) if (maze.horizontal[row]?.[col]) return false;
    }
  } else if (nextY < y) {
    for (let row = Math.floor(y - radius - epsilon); row > Math.floor(nextY - radius - epsilon); row -= 1) {
      for (let col = minCol; col <= maxCol; col += 1) if (maze.horizontal[row]?.[col]) return false;
    }
  }
  return true;
}
