import * as PIXI from 'pixi.js';

export type FarmLifeSpriteRect = {
  /** Source PNG served from /public. */
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

// Building art now comes from EmanuelleDev's "Farm RPG - Tiny Asset Pack",
// copied into public/assets/farm-rpg/buildings (see ASSET_CREDIT.md there).
// Each entry crops one clean building out of its source sheet.
const FARM_RPG = '/ai-town/assets/farm-rpg/buildings';
const textureCache = new Map<string, PIXI.Texture>();

export const FARM_LIFE_BUILDING_SPRITES = {
  // Generic timber/cottage building for carpenter, artist, farmer, seed seller…
  timberShop: { src: `${FARM_RPG}/house-1.png`, x: 0, y: 0, width: 128, height: 112 },
  // Red-roof studio/cottage used where the old tent art was still leaking through.
  houseStudio: { src: `${FARM_RPG}/house-3.png`, x: 0, y: 0, width: 128, height: 112 },
  // Forge: tight crop around the standalone shop, without adjacent sheet fragments.
  forgeShop: { src: `${FARM_RPG}/blacksmith.png`, x: 4, y: 7, width: 72, height: 87 },
  // Wizard tower (purple roof + vines) for mage / scientist.
  stoneTower: { src: `${FARM_RPG}/wizard-house.png`, x: 10, y: 2, width: 60, height: 135 },
  // Cottage with roof for tavern, doctor, fisher, rancher, mayor…
  roofHouse: { src: `${FARM_RPG}/house-2.png`, x: 0, y: 0, width: 80, height: 112 },
  // Plain lookout tower for the spyglass / observatory building.
  lookoutTower: { src: `${FARM_RPG}/wizard-house.png`, x: 170, y: 2, width: 60, height: 134 },
} as const satisfies Record<string, FarmLifeSpriteRect>;

function farmLifeTexture(rect: FarmLifeSpriteRect) {
  const key = `${rect.src}:${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
  const cached = textureCache.get(key);
  if (cached) {
    return cached;
  }
  const source = PIXI.Texture.from(rect.src);
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
