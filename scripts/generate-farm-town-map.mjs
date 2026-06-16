/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
import { writeFileSync } from 'node:fs';

const TILE = 32;
const WIDTH = 64;
const HEIGHT = 48;
const TILESET_COLUMNS = 16;
const TILESET_ROWS = 5;
const TILESET_PATH = '/ai-town/assets/farm-rpg/terrain/ai-town-terrain.png';

const frame = (x, y) => x + y * TILESET_COLUMNS;
const PATH_TILE_START = frame(2, 2);
const WATER_TILE_START = frame(2, 3);

const TILES = {
  grass: frame(0, 0),
  grassA: frame(1, 0),
  grassB: frame(2, 0),
  grassC: frame(3, 0),
  path: frame(4, 0),
  pathAlt: frame(5, 0),
  tilledSoil: frame(6, 0),
  wetSoil: frame(7, 0),
  grassSprig: frame(1, 1),
  flowerGold: frame(2, 1),
  flowerBlue: frame(3, 1),
  flowerPurple: frame(4, 1),
  smallRock: frame(5, 1),
  stump: frame(6, 1),
  tallGrassA: frame(7, 1),
  tallGrassB: frame(8, 1),
  grassClumpA: frame(9, 1),
  grassClumpB: frame(10, 1),
  grassClumpC: frame(11, 1),
  grassClumpD: frame(12, 1),
  mushroom: frame(13, 1),
  flowerWhite: frame(14, 1),
  flowerPale: frame(15, 1),
};

const MAPLE_TREE = [[frame(0, 2)], [frame(1, 2)]];

const PROFESSION_REGIONS = [
  { name: 'carpenter', x: 7, y: 14, width: 9, height: 8, portal: { x: 10, y: 21, width: 2, height: 1 } },
  { name: 'blacksmith', x: 47, y: 13, width: 9, height: 8, portal: { x: 50, y: 20, width: 2, height: 1 } },
  { name: 'mage', x: 6, y: 35, width: 9, height: 8, portal: { x: 9, y: 42, width: 2, height: 1 } },
  { name: 'tavern', x: 45, y: 4, width: 11, height: 8, portal: { x: 49, y: 11, width: 2, height: 1 } },
];

const HOTSPOT_REGIONS = [
  { name: 'spyglass', x: 31, y: 14, width: 12, height: 9, portal: { x: 35, y: 21, width: 2, height: 1 } },
  { name: 'artStudio', x: 12, y: 27, width: 10, height: 8, portal: { x: 16, y: 33, width: 2, height: 1 } },
  { name: 'garden', x: 42, y: 29, width: 11, height: 8, portal: { x: 46, y: 36, width: 2, height: 1 } },
];

const BUILDING_REGIONS = [...PROFESSION_REGIONS, ...HOTSPOT_REGIONS];

function makeLayer(fill) {
  return Array.from({ length: WIDTH }, () => Array(HEIGHT).fill(fill));
}

function pseudoRandom(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function pickBaseGrass(x, y) {
  const variant = pseudoRandom(x + 17, y + 31);
  if (variant > 0.82) return TILES.grassC;
  if (variant > 0.62) return TILES.grassB;
  if (variant > 0.38) return TILES.grassA;
  return TILES.grass;
}

const base = Array.from({ length: WIDTH }, (_, x) =>
  Array.from({ length: HEIGHT }, (_, y) => pickBaseGrass(x, y)),
);
const overlay = makeLayer(-1);
const object = makeLayer(-1);
const reserved = new Set();
const pathCells = new Set();
const waterCells = new Set();

const key = (x, y) => `${x},${y}`;
const inBounds = (x, y) => x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;

function markRegion(region, padding = 0) {
  for (let x = region.x - padding; x < region.x + region.width + padding; x += 1) {
    for (let y = region.y - padding; y < region.y + region.height + padding; y += 1) {
      if (inBounds(x, y)) {
        reserved.add(key(x, y));
      }
    }
  }
}

function markPortal(portal) {
  for (let x = portal.x - 1; x < portal.x + portal.width + 1; x += 1) {
    for (let y = portal.y - 1; y < portal.y + portal.height + 3; y += 1) {
      if (inBounds(x, y)) {
        reserved.add(key(x, y));
      }
    }
  }
}

for (const region of BUILDING_REGIONS) {
  markRegion(region, 1);
  markPortal(region.portal);
}

function setPath(x, y) {
  if (!inBounds(x, y)) return;
  pathCells.add(key(x, y));
  reserved.add(key(x, y));
}

function drawPathPoint(x, y, width = 1) {
  for (let dx = 0; dx < width; dx += 1) {
    setPath(x + dx, y);
  }
}

function drawSegment(a, b, width = 1) {
  let x = a.x;
  let y = a.y;
  drawPathPoint(x, y, width);
  while (x !== b.x || y !== b.y) {
    const dx = Math.sign(b.x - x);
    const dy = Math.sign(b.y - y);
    const remainingX = Math.abs(b.x - x);
    const remainingY = Math.abs(b.y - y);
    const horizontalStep =
      remainingX > 0 &&
      (remainingY === 0 ||
        remainingX > remainingY ||
        pseudoRandom(x + 401, y + 709) > 0.48);

    if (horizontalStep) {
      x += dx;
    } else {
      y += dy;
    }
    drawPathPoint(x, y, width);
  }
}

function drawPath(points, width = 1) {
  for (let i = 0; i < points.length - 1; i += 1) {
    drawSegment(points[i], points[i + 1], width);
  }
}

drawPath(
  [
    { x: 4, y: 25 },
    { x: 12, y: 25 },
    { x: 18, y: 24 },
    { x: 27, y: 24 },
    { x: 34, y: 25 },
    { x: 43, y: 25 },
    { x: 51, y: 23 },
    { x: 59, y: 23 },
  ],
  1,
);
drawPath([{ x: 11, y: 22 }, { x: 11, y: 24 }, { x: 12, y: 25 }]);
drawPath([{ x: 36, y: 22 }, { x: 36, y: 24 }, { x: 34, y: 25 }]);
drawPath([{ x: 51, y: 21 }, { x: 51, y: 22 }, { x: 51, y: 23 }]);
drawPath([{ x: 50, y: 12 }, { x: 50, y: 17 }, { x: 52, y: 22 }, { x: 51, y: 23 }]);
drawPath([{ x: 17, y: 34 }, { x: 17, y: 31 }, { x: 20, y: 28 }, { x: 27, y: 24 }]);
drawPath([{ x: 47, y: 37 }, { x: 47, y: 33 }, { x: 45, y: 29 }, { x: 43, y: 25 }]);
drawPath([{ x: 10, y: 43 }, { x: 10, y: 39 }, { x: 13, y: 36 }, { x: 17, y: 34 }]);
drawPath([{ x: 27, y: 31 }, { x: 27, y: 27 }, { x: 27, y: 24 }], 1);

function maskForCells(cells, x, y) {
  let mask = 0;
  if (cells.has(key(x, y - 1))) mask |= 1;
  if (cells.has(key(x + 1, y))) mask |= 2;
  if (cells.has(key(x, y + 1))) mask |= 4;
  if (cells.has(key(x - 1, y))) mask |= 8;
  return mask;
}

function paintPaths() {
  for (const cell of pathCells) {
    const [x, y] = cell.split(',').map(Number);
    overlay[x][y] = PATH_TILE_START + maskForCells(pathCells, x, y);
  }
}

function placeWaterShape(cells, label) {
  const uniqueCells = new Set();
  for (const [x, y] of cells) {
    uniqueCells.add(key(x, y));
  }
  for (const cell of uniqueCells) {
    const [x, y] = cell.split(',').map(Number);
    if (!inBounds(x, y) || reserved.has(cell)) {
      throw new Error(`${label} overlaps reserved cell ${x},${y}`);
    }
  }
  for (const cell of uniqueCells) {
    waterCells.add(cell);
    reserved.add(cell);
  }
}

placeWaterShape(
  [
    [27, 32],
    [28, 32],
    [29, 32],
    [30, 32],
    [25, 33],
    [26, 33],
    [27, 33],
    [28, 33],
    [29, 33],
    [30, 33],
    [31, 33],
    [24, 34],
    [25, 34],
    [26, 34],
    [27, 34],
    [28, 34],
    [29, 34],
    [30, 34],
    [31, 34],
    [32, 34],
    [24, 35],
    [25, 35],
    [26, 35],
    [27, 35],
    [28, 35],
    [29, 35],
    [30, 35],
    [31, 35],
    [25, 36],
    [26, 36],
    [27, 36],
    [28, 36],
    [29, 36],
    [30, 36],
    [27, 37],
    [28, 37],
    [29, 37],
  ],
  'lake',
);

placeWaterShape(
  [
    [29, 47],
    [29, 46],
    [28, 46],
    [28, 45],
    [28, 44],
    [29, 44],
    [29, 43],
    [29, 42],
    [28, 42],
    [28, 41],
    [28, 40],
    [28, 39],
    [28, 38],
  ],
  'creek',
);

function paintWater() {
  for (const cell of waterCells) {
    const [x, y] = cell.split(',').map(Number);
    object[x][y] = WATER_TILE_START + maskForCells(waterCells, x, y);
  }
}

paintWater();
paintPaths();

function canPlaceObject(x, y, pattern) {
  for (let py = 0; py < pattern.length; py += 1) {
    for (let px = 0; px < pattern[py].length; px += 1) {
      const gx = x + px;
      const gy = y + py;
      if (!inBounds(gx, gy) || reserved.has(key(gx, gy)) || pathCells.has(key(gx, gy))) {
        return false;
      }
    }
  }
  return true;
}

function placeObjectPattern(x, y, pattern) {
  if (!canPlaceObject(x, y, pattern)) return false;
  for (let py = 0; py < pattern.length; py += 1) {
    for (let px = 0; px < pattern[py].length; px += 1) {
      const tile = pattern[py][px];
      if (tile !== -1) {
        object[x + px][y + py] = tile;
      }
      reserved.add(key(x + px, y + py));
    }
  }
  return true;
}

[
  [2, 4],
  [7, 5],
  [12, 3],
  [16, 5],
  [22, 4],
  [27, 5],
  [32, 3],
  [38, 5],
  [42, 2],
  [57, 5],
  [2, 16],
  [18, 12],
  [21, 16],
  [29, 10],
  [41, 12],
  [57, 16],
  [4, 24],
  [18, 30],
  [3, 32],
  [31, 30],
  [41, 38],
  [51, 31],
  [23, 38],
  [33, 39],
  [55, 38],
  [58, 27],
  [37, 33],
  [7, 44],
  [60, 42],
].forEach(([x, y]) => placeObjectPattern(x, y, MAPLE_TREE));

function placeBlockingTile(x, y, tile) {
  if (!inBounds(x, y) || reserved.has(key(x, y)) || pathCells.has(key(x, y))) return;
  object[x][y] = tile;
  reserved.add(key(x, y));
}

function placeWalkableDecoration(x, y, tile) {
  if (!inBounds(x, y) || reserved.has(key(x, y)) || pathCells.has(key(x, y))) return;
  overlay[x][y] = tile;
}

function pickGrassDecoration(x, y) {
  const variant = pseudoRandom(x + 200, y + 200);
  if (variant > 0.93) return TILES.flowerPurple;
  if (variant > 0.86) return TILES.flowerBlue;
  if (variant > 0.78) return TILES.flowerGold;
  if (variant > 0.64) return TILES.tallGrassA;
  if (variant > 0.5) return TILES.tallGrassB;
  if (variant > 0.34) return TILES.grassClumpD;
  if (variant > 0.18) return TILES.grassClumpB;
  if (variant > 0.08) return TILES.grassClumpA;
  return TILES.grassSprig;
}

for (let x = 1; x < WIDTH - 1; x += 1) {
  for (let y = 1; y < HEIGHT - 1; y += 1) {
    const noise = pseudoRandom(x + 100, y + 100);
    if (reserved.has(key(x, y)) || pathCells.has(key(x, y))) continue;
    if ((x < 5 || x > WIDTH - 6 || y < 5 || y > HEIGHT - 5) && noise > 0.92) {
      placeBlockingTile(x, y, noise > 0.96 ? TILES.stump : TILES.smallRock);
    } else if (noise > 0.865) {
      placeWalkableDecoration(x, y, pickGrassDecoration(x, y));
    }
  }
}

function assertClearOfObjects(region) {
  for (let x = region.x; x < region.x + region.width; x += 1) {
    for (let y = region.y; y < region.y + region.height; y += 1) {
      if (object[x][y] !== -1) {
        throw new Error(`${region.name} has blocking terrain at ${x},${y}`);
      }
    }
  }
}

for (const region of BUILDING_REGIONS) {
  assertClearOfObjects(region);
}

const formatLayer = (layer) => `[\n${layer.map((column) => `  ${JSON.stringify(column)}`).join(',\n')}\n]`;

const output = `// Farm RPG terrain generated by scripts/generate-farm-town-map.mjs
export const tilesetpath = "${TILESET_PATH}";
export const tiledim = ${TILE};
export const screenxtiles = ${TILESET_COLUMNS};
export const screenytiles = ${TILESET_ROWS};
export const tilesetpxw = ${TILESET_COLUMNS * TILE};
export const tilesetpxh = ${TILESET_ROWS * TILE};

export const bgtiles = [
${formatLayer(base)},
${formatLayer(overlay)}
];

export const objmap = [
${formatLayer(object)}
];

export const animatedsprites = [];
export const mapwidth = bgtiles[0].length;
export const mapheight = bgtiles[0][0].length;
`;

writeFileSync(new URL('../data/gentle.js', import.meta.url), output);
