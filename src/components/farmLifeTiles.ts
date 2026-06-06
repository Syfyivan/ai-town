import * as PIXI from 'pixi.js';

export const FARM_TILE_SIZE = 32;
export const FARM_TILE_COLUMNS = 8;
export const FARM_TILE_SOURCE = '/assets/farm-life/sprites/farm-tiles.png';

export const FARM_TILE_FRAMES = {
  grass: 0,
  soil: 3,
  wet: 4,
  roofRed: 9,
  wallHome: 10,
  roofGray: 13,
  wallGray: 14,
  roofPurple: 15,
  wallPurple: 16,
  roofOchre: 17,
  wallCream: 18,
  door: 19,
  sign: 21,
  board: 25,
  fence: 26,
  flowerRed: 27,
  flowerBlue: 28,
  treeTop: 29,
  rock: 31,
  lantern: 24,
  scarecrow: 54,
  barnFrontStart: 65,
} as const;

const textureCache = new Map<number, PIXI.Texture>();

export function farmTileTexture(frame: number) {
  const cached = textureCache.get(frame);
  if (cached) {
    return cached;
  }
  const source = PIXI.Texture.from(FARM_TILE_SOURCE);
  source.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
  const texture = new PIXI.Texture(
    source.baseTexture,
    new PIXI.Rectangle(
      (frame % FARM_TILE_COLUMNS) * FARM_TILE_SIZE,
      Math.floor(frame / FARM_TILE_COLUMNS) * FARM_TILE_SIZE,
      FARM_TILE_SIZE,
      FARM_TILE_SIZE,
    ),
  );
  textureCache.set(frame, texture);
  return texture;
}

export function createFarmTile(frame: number, tileDim: number, tileX: number, tileY: number) {
  const sprite = new PIXI.Sprite(farmTileTexture(frame));
  const scale = tileDim / FARM_TILE_SIZE;
  sprite.x = tileX * tileDim;
  sprite.y = tileY * tileDim;
  sprite.scale.set(scale);
  return sprite;
}

export function addFarmTile(
  container: PIXI.Container,
  frame: number,
  tileDim: number,
  tileX: number,
  tileY: number,
) {
  const sprite = createFarmTile(frame, tileDim, tileX, tileY);
  container.addChild(sprite);
  return sprite;
}

export function addFarmTileGrid(
  container: PIXI.Container,
  frames: number[][],
  tileDim: number,
  tileX = 0,
  tileY = 0,
) {
  frames.forEach((row, y) => {
    row.forEach((frame, x) => {
      addFarmTile(container, frame, tileDim, tileX + x, tileY + y);
    });
  });
}
