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
  flowerBlue: 30,
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
  flowerWhite: 31,
  flowerPale: 31,
  treeTop: 32,
  treeBottom: 33,
} as const;

const LEGACY_BLANK_BLUE_FLOWER_TILE = 19;

const OBJECT_STYLES = new Map<number, { scale: number; anchor: 'bottomCenter' }>([
  [GENTLE_TILES.grassSprig, { scale: 1.25, anchor: 'bottomCenter' }],
  [GENTLE_TILES.flowerGold, { scale: 1.35, anchor: 'bottomCenter' }],
  [GENTLE_TILES.flowerBlue, { scale: 1.35, anchor: 'bottomCenter' }],
  [GENTLE_TILES.flowerPurple, { scale: 1.35, anchor: 'bottomCenter' }],
  [GENTLE_TILES.flowerWhite, { scale: 1.3, anchor: 'bottomCenter' }],
  [GENTLE_TILES.flowerPale, { scale: 1.3, anchor: 'bottomCenter' }],
  [GENTLE_TILES.rock, { scale: 1.45, anchor: 'bottomCenter' }],
  [GENTLE_TILES.stump, { scale: 1.75, anchor: 'bottomCenter' }],
  [GENTLE_TILES.tallGrassA, { scale: 1.35, anchor: 'bottomCenter' }],
  [GENTLE_TILES.tallGrassB, { scale: 1.3, anchor: 'bottomCenter' }],
  [GENTLE_TILES.grassClumpA, { scale: 1.25, anchor: 'bottomCenter' }],
  [GENTLE_TILES.grassClumpB, { scale: 1.25, anchor: 'bottomCenter' }],
  [GENTLE_TILES.grassClumpC, { scale: 1.25, anchor: 'bottomCenter' }],
  [GENTLE_TILES.grassClumpD, { scale: 1.25, anchor: 'bottomCenter' }],
  [GENTLE_TILES.mushroom, { scale: 1.4, anchor: 'bottomCenter' }],
]);

export function remapGentleTileIndex(frame: number) {
  return frame === LEGACY_BLANK_BLUE_FLOWER_TILE ? GENTLE_TILES.flowerBlue : frame;
}

export function isGentleTreeTop(layer: number[][], x: number, y: number) {
  return layer[x]?.[y] === GENTLE_TILES.treeTop && layer[x]?.[y + 1] === GENTLE_TILES.treeBottom;
}

export function isGentleTreeBottom(layer: number[][], x: number, y: number) {
  return layer[x]?.[y] === GENTLE_TILES.treeBottom && layer[x]?.[y - 1] === GENTLE_TILES.treeTop;
}

export function gentleTexture(frame: number) {
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
  const displayFrame = remapGentleTileIndex(frame);
  const sprite = new PIXI.Sprite(gentleTexture(displayFrame));
  const style = OBJECT_STYLES.get(displayFrame);
  const scale = (tileDim / GENTLE_TILE_SIZE) * (style?.scale ?? 1);
  if (style?.anchor === 'bottomCenter') {
    sprite.anchor.set(0.5, 1);
    sprite.x = (tileX + 0.5) * tileDim;
    sprite.y = (tileY + 1) * tileDim;
  } else {
    sprite.x = tileX * tileDim;
    sprite.y = tileY * tileDim;
  }
  sprite.scale.set(scale);
  container.addChild(sprite);
  return sprite;
}

export function addGentleTree(
  container: PIXI.Container,
  tileDim: number,
  tileX: number,
  tileY: number,
) {
  const tree = new PIXI.Container();
  const scale = (tileDim / GENTLE_TILE_SIZE) * 1.55;
  const top = new PIXI.Sprite(gentleTexture(GENTLE_TILES.treeTop));
  const bottom = new PIXI.Sprite(gentleTexture(GENTLE_TILES.treeBottom));

  bottom.y = GENTLE_TILE_SIZE;
  tree.addChild(top);
  tree.addChild(bottom);
  tree.scale.set(scale);
  tree.x = (tileX + 0.5) * tileDim - (GENTLE_TILE_SIZE * scale) / 2;
  tree.y = (tileY + 2) * tileDim - GENTLE_TILE_SIZE * 2 * scale - tileDim * 0.06;
  container.addChild(tree);
  return tree;
}
