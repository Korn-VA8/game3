/* grid.js — Hexagonal grid system for bubble placement */

// Grid constants
export const COLS = 9;
export const BUBBLE_RADIUS = 18;
export const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
export const ROW_HEIGHT = BUBBLE_DIAMETER * 0.866; // sqrt(3)/2

/**
 * Convert grid (row, col) to pixel (x, y) center position
 */
export function gridToPixel(row, col, offsetX = 0, offsetY = 0) {
  const shift = row % 2 === 1 ? BUBBLE_RADIUS : 0;
  return {
    x: offsetX + col * BUBBLE_DIAMETER + BUBBLE_RADIUS + shift,
    y: offsetY + row * ROW_HEIGHT + BUBBLE_RADIUS
  };
}

/**
 * Convert pixel (x, y) to nearest grid (row, col)
 */
export function pixelToGrid(x, y, offsetX = 0, offsetY = 0) {
  const py = y - offsetY;
  const row = Math.round((py - BUBBLE_RADIUS) / ROW_HEIGHT);
  const shift = row % 2 === 1 ? BUBBLE_RADIUS : 0;
  const col = Math.round((x - offsetX - BUBBLE_RADIUS - shift) / BUBBLE_DIAMETER);
  return { row: Math.max(0, row), col: Math.max(0, Math.min(col, maxColsForRow(row) - 1)) };
}

/**
 * Max columns for a given row (uniform — all rows same width)
 */
export function maxColsForRow(row) {
  return COLS;
}

/**
 * Get 6 hex neighbors of (row, col)
 */
export function getNeighbors(row, col) {
  const even = row % 2 === 0;
  // Offset coordinates: even rows and odd rows have different neighbor offsets
  const offsets = even
    ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];

  const result = [];
  for (const [dr, dc] of offsets) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nc >= 0 && nc < maxColsForRow(nr)) {
      result.push({ row: nr, col: nc });
    }
  }
  return result;
}

/**
 * BFS: find all connected bubbles of the same color
 */
export function findColorGroup(grid, row, col) {
  const color = grid[row]?.[col]?.color;
  if (color == null) return [];

  const visited = new Set();
  const queue = [{ row, col }];
  const group = [];
  const key = (r, c) => `${r},${c}`;

  visited.add(key(row, col));

  while (queue.length > 0) {
    const { row: r, col: c } = queue.shift();
    group.push({ row: r, col: c });

    for (const n of getNeighbors(r, c)) {
      const k = key(n.row, n.col);
      if (!visited.has(k) && grid[n.row]?.[n.col]?.color === color) {
        visited.add(k);
        queue.push(n);
      }
    }
  }
  return group;
}

/**
 * BFS from ceiling: find all bubbles NOT connected to top row (orphans)
 */
export function findOrphans(grid) {
  const visited = new Set();
  const queue = [];
  const key = (r, c) => `${r},${c}`;

  // Seed BFS from all occupied cells in row 0
  if (grid[0]) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[0][c]) {
        visited.add(key(0, c));
        queue.push({ row: 0, col: c });
      }
    }
  }

  while (queue.length > 0) {
    const { row: r, col: c } = queue.shift();
    for (const n of getNeighbors(r, c)) {
      const k = key(n.row, n.col);
      if (!visited.has(k) && grid[n.row]?.[n.col]) {
        visited.add(k);
        queue.push(n);
      }
    }
  }

  // Everything not visited is an orphan
  const orphans = [];
  for (let r = 0; r < grid.length; r++) {
    if (!grid[r]) continue;
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] && !visited.has(key(r, c))) {
        orphans.push({ row: r, col: c });
      }
    }
  }
  return orphans;
}

/**
 * Create an empty grid (2D sparse array)
 */
export function createGrid(rows) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = new Array(maxColsForRow(r)).fill(null);
  }
  return grid;
}

/**
 * Calculate grid pixel width
 */
export function gridPixelWidth() {
  return COLS * BUBBLE_DIAMETER + BUBBLE_RADIUS; // extra half for odd row shift
}
