import * as PIXI from 'pixi.js';

const GENTLE_TILE_SIZE = 32;
const GENTLE_TILE_COLUMNS = 45;
const GENTLE_TILE_SOURCE = '/ai-town/assets/gentle-obj.png';

const textureCache = new Map<number, PIXI.Texture>();

export const GENTLE_TILES = {
  grass: 271,
  fieldTopLeft: 747,
  fieldTopRight: 748,
  fieldBottomLeft: 792,
  fieldBottomRight: 793,
  pathTopLeft: 747,
  pathTopRight: 748,
  pathBottomLeft: 792,
  pathBottomRight: 793,
  tentTopLeft: 751,
  tentTop: 752,
  tentTopRight: 753,
  tentMidLeft: 796,
  tentMid: 797,
  tentMidRight: 798,
  tentBottomLeft: 841,
  tentBottom: 842,
  tentBottomRight: 843,
  stump: 893,
  pine: 894,
  rock: 896,
  flowerWhite: 935,
  flowerRed: 936,
  flowerYellow: 937,
  log: 938,
  bush: 940,
  mushroom: 850,
  post: 944,
} as const;

export const GENTLE_PATH_PATCH = [
  [GENTLE_TILES.pathTopLeft, GENTLE_TILES.pathTopRight],
  [GENTLE_TILES.pathBottomLeft, GENTLE_TILES.pathBottomRight],
];

function gentleTexture(frame: number) {
  const cached = textureCache.get(frame);
  if (cached) {
    return cached;
  }
  const source = PIXI.Texture.from(GENTLE_TILE_SOURCE);
  source.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
  const texture = new PIXI.Texture(
    source.baseTexture,
    new PIXI.Rectangle(
      (frame % GENTLE_TILE_COLUMNS) * GENTLE_TILE_SIZE,
      Math.floor(frame / GENTLE_TILE_COLUMNS) * GENTLE_TILE_SIZE,
      GENTLE_TILE_SIZE,
      GENTLE_TILE_SIZE,
    ),
  );
  textureCache.set(frame, texture);
  return texture;
}

export function addGentleTile(
  container: PIXI.Container,
  frame: number,
  tileDim: number,
  tileX: number,
  tileY: number,
) {
  const sprite = new PIXI.Sprite(gentleTexture(frame));
  const scale = tileDim / GENTLE_TILE_SIZE;
  sprite.x = tileX * tileDim;
  sprite.y = tileY * tileDim;
  sprite.scale.set(scale);
  container.addChild(sprite);
  return sprite;
}

export function addGentleTileGrid(
  container: PIXI.Container,
  frames: number[][],
  tileDim: number,
  tileX = 0,
  tileY = 0,
) {
  frames.forEach((row, y) => {
    row.forEach((frame, x) => {
      addGentleTile(container, frame, tileDim, tileX + x, tileY + y);
    });
  });
}

export function addGentlePathPatch(
  container: PIXI.Container,
  tileDim: number,
  tileX: number,
  tileY: number,
) {
  addGentleTileGrid(container, GENTLE_PATH_PATCH, tileDim, tileX, tileY);
}
