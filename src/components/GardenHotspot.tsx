import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { GENTLE_TILES, addGentleTile, addGentleTileGrid } from './gentleTownTiles';

type GardenHotspotProps = {
  onOpenGarden: () => void;
  tileDim: number;
};

type GardenHotspotContainer = PIXI.Container & {
  openGarden?: () => void;
};

export const GARDEN_REGION = {
  x: 43,
  y: 30,
  width: 7,
  height: 5,
};

function buildGardenSprite(tileDim: number) {
  const width = GARDEN_REGION.width * tileDim;
  const height = GARDEN_REGION.height * tileDim;
  const container = new PIXI.Container() as GardenHotspotContainer;
  const graphics = new PIXI.Graphics();

  graphics.beginFill(0x181425, 0.14);
  graphics.drawEllipse(width / 2, tileDim * 3.35, tileDim * 2.35, tileDim * 0.34);
  graphics.endFill();
  container.addChild(graphics);

  addGentleTileGrid(
    container,
    [
      [GENTLE_TILES.fieldTopLeft, GENTLE_TILES.fieldTopRight],
      [GENTLE_TILES.fieldBottomLeft, GENTLE_TILES.fieldBottomRight],
    ],
    tileDim,
    2.35,
    1.2,
  );
  addGentleTileGrid(
    container,
    [
      [GENTLE_TILES.fieldTopLeft, GENTLE_TILES.fieldTopRight],
      [GENTLE_TILES.fieldBottomLeft, GENTLE_TILES.fieldBottomRight],
    ],
    tileDim,
    3.6,
    2.15,
  );
  addGentleTile(container, GENTLE_TILES.stump, tileDim, 1.25, 2.45);
  addGentleTile(container, GENTLE_TILES.bush, tileDim, 5.1, 1.35);
  addGentleTile(container, GENTLE_TILES.flowerYellow, tileDim, 1.25, 1.2);
  addGentleTile(container, GENTLE_TILES.flowerWhite, tileDim, 5.35, 3.15);
  addGentleTile(container, GENTLE_TILES.mushroom, tileDim, 4.95, 3.75);
  container.hitArea = new PIXI.Rectangle(0, 0, width, height);
  container.eventMode = 'static';
  container.cursor = 'pointer';
  return container;
}

export const GardenHotspot = PixiComponent('GardenHotspot', {
  create: (props: GardenHotspotProps) => {
    const container = buildGardenSprite(props.tileDim);
    container.x = GARDEN_REGION.x * props.tileDim;
    container.y = GARDEN_REGION.y * props.tileDim;
    container.openGarden = props.onOpenGarden;
    container.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      event.stopPropagation();
    });
    container.on('pointerup', (event: PIXI.FederatedPointerEvent) => {
      event.stopPropagation();
    });
    container.on('pointertap', (event: PIXI.FederatedPointerEvent) => {
      event.stopPropagation();
      container.openGarden?.();
    });
    return container;
  },

  applyProps: (
    instance: GardenHotspotContainer,
    oldProps: GardenHotspotProps,
    newProps: GardenHotspotProps,
  ) => {
    instance.openGarden = newProps.onOpenGarden;
    if (oldProps.tileDim !== newProps.tileDim) {
      instance.x = GARDEN_REGION.x * newProps.tileDim;
      instance.y = GARDEN_REGION.y * newProps.tileDim;
    }
    applyDefaultProps(instance, oldProps, newProps);
  },
});
