import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { GENTLE_TILES, addGentleTile } from './gentleTownTiles';
import type { ProfessionBuilding } from './professionCatalog';
import { FARM_LIFE_BUILDING_SPRITES, addFarmLifeSprite } from './farmLifeSprites';

type ProfessionBuildingHotspotProps = {
  building: ProfessionBuilding;
  tileDim: number;
};

type ProfessionBuildingHotspotContainer = PIXI.Container & {
  building?: ProfessionBuilding;
};

const BUILDING_VISUALS: Record<
  ProfessionBuilding['profession'],
  {
    sprite: (typeof FARM_LIFE_BUILDING_SPRITES)[keyof typeof FARM_LIFE_BUILDING_SPRITES];
    tileX: number;
    tileY: number;
    widthTiles: number;
    signX: number;
    signY: number;
  }
> = {
  artist: {
    sprite: FARM_LIFE_BUILDING_SPRITES.timberShop,
    tileX: 1.75,
    tileY: 1.15,
    widthTiles: 5.8,
    signX: 4.55,
    signY: 6.15,
  },
  blacksmith: {
    sprite: FARM_LIFE_BUILDING_SPRITES.forgeShop,
    tileX: 2.25,
    tileY: 0.78,
    widthTiles: 4.55,
    signX: 4.55,
    signY: 6.12,
  },
  carpenter: {
    sprite: FARM_LIFE_BUILDING_SPRITES.timberShop,
    tileX: 1.75,
    tileY: 1.1,
    widthTiles: 5.8,
    signX: 4.55,
    signY: 6.12,
  },
  doctor: {
    sprite: FARM_LIFE_BUILDING_SPRITES.roofHouse,
    tileX: 2.35,
    tileY: 0.6,
    widthTiles: 4.3,
    signX: 4.55,
    signY: 6.12,
  },
  farmer: {
    sprite: FARM_LIFE_BUILDING_SPRITES.timberShop,
    tileX: 1.75,
    tileY: 1.1,
    widthTiles: 5.8,
    signX: 4.55,
    signY: 6.12,
  },
  fisher: {
    sprite: FARM_LIFE_BUILDING_SPRITES.roofHouse,
    tileX: 2.35,
    tileY: 0.6,
    widthTiles: 4.3,
    signX: 4.55,
    signY: 6.12,
  },
  mage: {
    sprite: FARM_LIFE_BUILDING_SPRITES.stoneTower,
    tileX: 2.75,
    tileY: -0.85,
    widthTiles: 3.65,
    signX: 4.55,
    signY: 6.92,
  },
  mayor: {
    sprite: FARM_LIFE_BUILDING_SPRITES.forgeShop,
    tileX: 2.25,
    tileY: 0.78,
    widthTiles: 4.55,
    signX: 4.55,
    signY: 6.12,
  },
  rancher: {
    sprite: FARM_LIFE_BUILDING_SPRITES.roofHouse,
    tileX: 2.35,
    tileY: 0.6,
    widthTiles: 4.3,
    signX: 4.55,
    signY: 6.12,
  },
  scientist: {
    sprite: FARM_LIFE_BUILDING_SPRITES.stoneTower,
    tileX: 2.75,
    tileY: -0.85,
    widthTiles: 3.65,
    signX: 4.55,
    signY: 6.92,
  },
  seedSeller: {
    sprite: FARM_LIFE_BUILDING_SPRITES.timberShop,
    tileX: 1.75,
    tileY: 1.1,
    widthTiles: 5.8,
    signX: 4.55,
    signY: 6.12,
  },
  tavernKeeper: {
    sprite: FARM_LIFE_BUILDING_SPRITES.roofHouse,
    tileX: 3.05,
    tileY: 0.58,
    widthTiles: 4.85,
    signX: 5.55,
    signY: 6.15,
  },
};

function addPixelHouse(container: PIXI.Container, building: ProfessionBuilding, tileDim: number) {
  const shadow = new PIXI.Graphics();
  const width = building.region.width * tileDim;
  const visual = BUILDING_VISUALS[building.profession];

  shadow.beginFill(0x181425, 0.18);
  shadow.drawEllipse(width / 2, tileDim * 5.7, tileDim * 2.7, tileDim * 0.32);
  shadow.endFill();
  container.addChild(shadow);

  addFarmLifeSprite(
    container,
    visual.sprite,
    tileDim,
    visual.tileX,
    visual.tileY,
    visual.widthTiles,
  );

  const signBoard = new PIXI.Graphics();
  signBoard.lineStyle(2, 0x181425, 0.9);
  signBoard.beginFill(0xfec742);
  signBoard.drawRect(
    tileDim * (visual.signX - 1.95),
    tileDim * visual.signY,
    tileDim * 3.9,
    tileDim * 0.52,
  );
  signBoard.endFill();
  container.addChild(signBoard);

  const sign = new PIXI.Text(building.buildingName, {
    align: 'center',
    fill: '#181425',
    fontFamily: 'sans-serif',
    fontSize: Math.max(10, tileDim * 0.34),
    fontWeight: '700',
  });
  sign.anchor.set(0.5, 0.5);
  sign.x = tileDim * visual.signX;
  sign.y = tileDim * (visual.signY + 0.27);
  sign.resolution = 2;
  container.addChild(sign);
}

function buildProfessionBuildingSprite(building: ProfessionBuilding, tileDim: number) {
  const container = new PIXI.Container() as ProfessionBuildingHotspotContainer;

  addPixelHouse(container, building, tileDim);
  addGentleTile(container, GENTLE_TILES.rock, tileDim, 1.1, 6.05);
  addGentleTile(container, GENTLE_TILES.stump, tileDim, 7.35, 6.05);
  addGentleTile(container, GENTLE_TILES.flowerBlue, tileDim, 1.45, 5.25);
  addGentleTile(container, GENTLE_TILES.flowerGold, tileDim, 7.05, 5.15);

  return container;
}

export const ProfessionBuildingHotspot = PixiComponent('ProfessionBuildingHotspot', {
  create: (props: ProfessionBuildingHotspotProps) => {
    const container = buildProfessionBuildingSprite(props.building, props.tileDim);
    container.x = props.building.region.x * props.tileDim;
    container.y = props.building.region.y * props.tileDim;
    container.zIndex = (props.building.region.y + props.building.region.height) * props.tileDim;
    container.building = props.building;
    return container;
  },

  applyProps: (
    instance: ProfessionBuildingHotspotContainer,
    oldProps: ProfessionBuildingHotspotProps,
    newProps: ProfessionBuildingHotspotProps,
  ) => {
    instance.building = newProps.building;
    if (oldProps.tileDim !== newProps.tileDim || oldProps.building !== newProps.building) {
      instance.x = newProps.building.region.x * newProps.tileDim;
      instance.y = newProps.building.region.y * newProps.tileDim;
      instance.zIndex =
        (newProps.building.region.y + newProps.building.region.height) * newProps.tileDim;
    }
    applyDefaultProps(instance, oldProps, newProps);
  },
});
