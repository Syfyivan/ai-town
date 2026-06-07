import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { GENTLE_TILES, addGentlePathPatch, addGentleTile } from './gentleTownTiles';
import type { ProfessionBuilding } from './professionCatalog';

type ProfessionBuildingHotspotProps = {
  building: ProfessionBuilding;
  tileDim: number;
};

type ProfessionBuildingHotspotContainer = PIXI.Container & {
  building?: ProfessionBuilding;
};

function addPixelHouse(container: PIXI.Container, building: ProfessionBuilding, tileDim: number) {
  const graphics = new PIXI.Graphics();
  const width = building.region.width * tileDim;

  graphics.beginFill(0x181425, 0.18);
  graphics.drawEllipse(width / 2, tileDim * 5.7, tileDim * 2.7, tileDim * 0.32);
  graphics.endFill();

  graphics.lineStyle(4, 0x181425, 1);
  graphics.beginFill(building.accent);
  graphics.drawPolygon([
    tileDim * 2.2,
    tileDim * 2.1,
    tileDim * 4.5,
    tileDim * 0.8,
    tileDim * 6.8,
    tileDim * 2.1,
  ]);
  graphics.endFill();

  graphics.beginFill(0x9a5f3f);
  graphics.drawRect(tileDim * 2.55, tileDim * 2.05, tileDim * 3.9, tileDim * 3.35);
  graphics.endFill();

  graphics.beginFill(0x181425);
  graphics.drawRect(tileDim * 3.8, tileDim * 3.55, tileDim * 0.9, tileDim * 1.85);
  graphics.drawRect(tileDim * 2.9, tileDim * 2.7, tileDim * 0.78, tileDim * 0.7);
  graphics.drawRect(tileDim * 5.35, tileDim * 2.7, tileDim * 0.78, tileDim * 0.7);
  graphics.endFill();

  graphics.beginFill(0xfec742);
  graphics.drawRect(tileDim * 3.05, tileDim * 2.85, tileDim * 0.48, tileDim * 0.36);
  graphics.drawRect(tileDim * 5.5, tileDim * 2.85, tileDim * 0.48, tileDim * 0.36);
  graphics.endFill();

  graphics.beginFill(0x3a4466);
  graphics.drawRect(tileDim * 3.95, tileDim * 3.75, tileDim * 0.62, tileDim * 1.65);
  graphics.endFill();

  graphics.beginFill(0xfec742);
  graphics.lineStyle(3, 0x181425, 1);
  graphics.drawRect(tileDim * 2.65, tileDim * 5.15, tileDim * 3.75, tileDim * 0.48);
  graphics.endFill();

  container.addChild(graphics);

  const sign = new PIXI.Text(building.buildingName, {
    align: 'center',
    fill: '#181425',
    fontFamily: 'sans-serif',
    fontSize: Math.max(10, tileDim * 0.34),
    fontWeight: '700',
  });
  sign.anchor.set(0.5, 0.5);
  sign.x = tileDim * 4.52;
  sign.y = tileDim * 5.38;
  sign.resolution = 2;
  container.addChild(sign);
}

function buildProfessionBuildingSprite(building: ProfessionBuilding, tileDim: number) {
  const container = new PIXI.Container() as ProfessionBuildingHotspotContainer;

  addGentlePathPatch(container, tileDim, 3.55, 5.75);
  addGentlePathPatch(container, tileDim, 3.65, 4.55);
  addPixelHouse(container, building, tileDim);
  addGentleTile(container, GENTLE_TILES.post, tileDim, 2.3, 6.25);
  addGentleTile(container, GENTLE_TILES.post, tileDim, 5.85, 6.25);
  addGentleTile(container, GENTLE_TILES.flowerWhite, tileDim, 1.45, 5.35);
  addGentleTile(container, GENTLE_TILES.flowerYellow, tileDim, 6.95, 5.25);

  return container;
}

export const ProfessionBuildingHotspot = PixiComponent('ProfessionBuildingHotspot', {
  create: (props: ProfessionBuildingHotspotProps) => {
    const container = buildProfessionBuildingSprite(props.building, props.tileDim);
    container.x = props.building.region.x * props.tileDim;
    container.y = props.building.region.y * props.tileDim;
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
    }
    applyDefaultProps(instance, oldProps, newProps);
  },
});
