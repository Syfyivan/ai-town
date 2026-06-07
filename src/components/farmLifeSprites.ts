import * as PIXI from 'pixi.js';

export type FarmLifeSpriteRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const FARM_LIFE_TILE_SOURCE = '/ai-town/assets/farm-life/sprites/farm-tiles.png';
const textureCache = new Map<string, PIXI.Texture>();

export const FARM_LIFE_BUILDING_SPRITES = {
  timberShop: { x: 0, y: 256, width: 128, height: 160 },
  forgeShop: { x: 128, y: 256, width: 128, height: 160 },
  stoneTower: { x: 96, y: 352, width: 128, height: 224 },
  roofHouse: { x: 0, y: 384, width: 128, height: 160 },
} as const satisfies Record<string, FarmLifeSpriteRect>;

function farmLifeTexture(rect: FarmLifeSpriteRect) {
  const key = `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
  const cached = textureCache.get(key);
  if (cached) {
    return cached;
  }
  const source = PIXI.Texture.from(FARM_LIFE_TILE_SOURCE);
  source.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
  const texture = new PIXI.Texture(
    source.baseTexture,
    new PIXI.Rectangle(rect.x, rect.y, rect.width, rect.height),
  );
  textureCache.set(key, texture);
  return texture;
}

export function addFarmLifeSprite(
  container: PIXI.Container,
  rect: FarmLifeSpriteRect,
  tileDim: number,
  tileX: number,
  tileY: number,
  widthTiles: number,
) {
  const sprite = new PIXI.Sprite(farmLifeTexture(rect));
  const scale = (widthTiles * tileDim) / rect.width;
  sprite.x = tileX * tileDim;
  sprite.y = tileY * tileDim;
  sprite.scale.set(scale);
  container.addChild(sprite);
  return sprite;
}
