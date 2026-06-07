import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import {
  GENTLE_TILES,
  addGentlePathPatch,
  addGentleTile,
  addGentleTileGrid,
} from './gentleTownTiles';

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

  addGentlePathPatch(container, tileDim, 4, 5.3);
  addGentlePathPatch(container, tileDim, 4.15, 4);
  addGentlePathPatch(container, tileDim, 3.35, 2.85);

  addGentleTileGrid(
    container,
    [
      [GENTLE_TILES.fieldTopLeft, GENTLE_TILES.fieldTopRight],
      [GENTLE_TILES.fieldBottomLeft, GENTLE_TILES.fieldBottomRight],
    ],
    tileDim,
    2.4,
    1,
  );
  addGentleTileGrid(
    container,
    [
      [GENTLE_TILES.fieldTopLeft, GENTLE_TILES.fieldTopRight],
      [GENTLE_TILES.fieldBottomLeft, GENTLE_TILES.fieldBottomRight],
    ],
    tileDim,
    4.05,
    1.95,
  );
  addGentleTile(container, GENTLE_TILES.stump, tileDim, 1.45, 3.25);
  addGentleTile(container, GENTLE_TILES.bush, tileDim, 7.1, 1.35);
  addGentleTile(container, GENTLE_TILES.flowerYellow, tileDim, 1.45, 1.3);
  addGentleTile(container, GENTLE_TILES.flowerWhite, tileDim, 7.45, 4.35);
  addGentleTile(container, GENTLE_TILES.mushroom, tileDim, 6.4, 4.9);
  addGentleTile(container, GENTLE_TILES.post, tileDim, 3.8, 6.05);
  addGentleTile(container, GENTLE_TILES.post, tileDim, 5.75, 6.05);
  return container;
}

export const GardenHotspot = PixiComponent('GardenHotspot', {
  create: (props: GardenHotspotProps) => {
    const container = buildGardenSprite(props.tileDim);
    container.x = GARDEN_REGION.x * props.tileDim;
    container.y = GARDEN_REGION.y * props.tileDim;
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
    }
    applyDefaultProps(instance, oldProps, newProps);
  },
});
