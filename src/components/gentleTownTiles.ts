import * as PIXI from 'pixi.js';

const GENTLE_TILE_SIZE = 32;
const GENTLE_TILE_COLUMNS = 16;
const GENTLE_TILE_SOURCE = '/ai-town/assets/farm-rpg/terrain/ai-town-terrain.png';

const textureCache = new Map<number, PIXI.Texture>();

export const GENTLE_TILES = {
  grass: 0,
  grassA: 1,
  grassB: 2,
  grassC: 3,
  path: 4,
  pathAlt: 5,
  tilledSoil: 6,
  wetSoil: 7,
  grassSprig: 17,
  flowerGold: 18,
  flowerBlue: 19,
  flowerPurple: 20,
  rock: 21,
  stump: 22,
  tallGrassA: 23,
  tallGrassB: 24,
  grassClumpA: 25,
  grassClumpB: 26,
  grassClumpC: 27,
  grassClumpD: 28,
  mushroom: 29,
  flowerWhite: 30,
  flowerPale: 31,
  treeTop: 32,
  treeBottom: 33,
} as const;

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
