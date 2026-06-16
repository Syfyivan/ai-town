import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { GENTLE_TILES, addGentleTile } from './gentleTownTiles';

type GardenHotspotProps = {
  tileDim: number;
};

export const GARDEN_REGION = {
  x: 42,
  y: 29,
  width: 11,
  height: 8,
};

export const GARDEN_PORTAL_REGION = {
  x: 46,
  y: 36,
  width: 2,
  height: 1,
};

function buildGardenSprite(tileDim: number) {
  const width = GARDEN_REGION.width * tileDim;
  const container = new PIXI.Container();
  const graphics = new PIXI.Graphics();

  graphics.beginFill(0x181425, 0.14);
  graphics.drawEllipse(width / 2, tileDim * 5.4, tileDim * 2.45, tileDim * 0.32);
  graphics.endFill();
  container.addChild(graphics);

  graphics.beginFill(0x8f563b, 0.92);
  graphics.lineStyle(Math.max(1, tileDim * 0.05), 0x5b3a31, 0.9);
  graphics.drawRect(tileDim * 2.55, tileDim * 1.05, tileDim * 1.35, tileDim * 1.05);
  graphics.drawRect(tileDim * 4.2, tileDim * 1.95, tileDim * 1.35, tileDim * 1.05);
  graphics.endFill();
  graphics.lineStyle(Math.max(1, tileDim * 0.035), 0xead4aa, 0.35);
  graphics.moveTo(tileDim * 2.7, tileDim * 1.4);
  graphics.lineTo(tileDim * 3.75, tileDim * 1.4);
  graphics.moveTo(tileDim * 4.35, tileDim * 2.3);
  graphics.lineTo(tileDim * 5.4, tileDim * 2.3);

  addGentleTile(container, GENTLE_TILES.stump, tileDim, 1.45, 3.25);
  addGentleTile(container, GENTLE_TILES.tallGrassA, tileDim, 7.1, 1.35);
  addGentleTile(container, GENTLE_TILES.flowerGold, tileDim, 1.45, 1.3);
  addGentleTile(container, GENTLE_TILES.flowerBlue, tileDim, 7.45, 4.35);
  addGentleTile(container, GENTLE_TILES.grassClumpD, tileDim, 6.4, 4.9);
  addGentleTile(container, GENTLE_TILES.rock, tileDim, 3.8, 6.05);
  addGentleTile(container, GENTLE_TILES.stump, tileDim, 5.75, 6.05);
  return container;
}

export const GardenHotspot = PixiComponent('GardenHotspot', {
  create: (props: GardenHotspotProps) => {
    const container = buildGardenSprite(props.tileDim);
    container.x = GARDEN_REGION.x * props.tileDim;
    container.y = GARDEN_REGION.y * props.tileDim;
    container.zIndex = (GARDEN_REGION.y + GARDEN_REGION.height) * props.tileDim;
    return container;
  },

  applyProps: (
    instance: PIXI.Container,
    oldProps: GardenHotspotProps,
    newProps: GardenHotspotProps,
  ) => {
    if (oldProps.tileDim !== newProps.tileDim) {
      instance.x = GARDEN_REGION.x * newProps.tileDim;
      instance.y = GARDEN_REGION.y * newProps.tileDim;
      instance.zIndex = (GARDEN_REGION.y + GARDEN_REGION.height) * newProps.tileDim;
    }
    applyDefaultProps(instance, oldProps, newProps);
  },
});
