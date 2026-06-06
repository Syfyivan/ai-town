import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { FARM_TILE_FRAMES, addFarmTile } from './farmLifeTiles';

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

  graphics.beginFill(0x1f1308, 0.2);
  graphics.drawRect(tileDim * 0.35, tileDim * 0.55, width - tileDim * 0.7, height - tileDim);
  graphics.endFill();
  container.addChild(graphics);

  for (let x = 0.55; x < 6.2; x += 1) {
    addFarmTile(container, FARM_TILE_FRAMES.fence, tileDim, x, 0.35);
    addFarmTile(container, FARM_TILE_FRAMES.fence, tileDim, x, 4.15);
  }
  for (let y = 1.2; y < 4.1; y += 1) {
    addFarmTile(container, FARM_TILE_FRAMES.fence, tileDim, 0.25, y);
    addFarmTile(container, FARM_TILE_FRAMES.fence, tileDim, 6.25, y);
  }

  const plots = [
    { x: 1.25, y: 1.35, frame: FARM_TILE_FRAMES.soil },
    { x: 2.25, y: 1.35, frame: FARM_TILE_FRAMES.wet },
    { x: 3.25, y: 1.35, frame: FARM_TILE_FRAMES.soil },
    { x: 4.25, y: 1.35, frame: FARM_TILE_FRAMES.wet },
    { x: 1.25, y: 2.35, frame: FARM_TILE_FRAMES.wet },
    { x: 2.25, y: 2.35, frame: FARM_TILE_FRAMES.soil },
    { x: 3.25, y: 2.35, frame: FARM_TILE_FRAMES.wet },
    { x: 4.25, y: 2.35, frame: FARM_TILE_FRAMES.soil },
  ];
  for (const plot of plots) {
    addFarmTile(container, plot.frame, tileDim, plot.x, plot.y);
  }

  addFarmTile(container, FARM_TILE_FRAMES.scarecrow, tileDim, 5.05, 1.35);
  addFarmTile(container, FARM_TILE_FRAMES.flowerRed, tileDim, 5.05, 2.35);
  addFarmTile(container, FARM_TILE_FRAMES.flowerBlue, tileDim, 0.95, 3.25);
  addFarmTile(container, FARM_TILE_FRAMES.sign, tileDim, 2.8, 0.05);

  const sign = new PIXI.Text(
    '小菜园',
    new PIXI.TextStyle({
      fill: '#181425',
      fontFamily: 'VCR OSD Mono, monospace',
      fontSize: Math.max(11, tileDim * 0.36),
      align: 'center',
    }),
  );
  sign.anchor.set(0.5);
  sign.x = width / 2;
  sign.y = tileDim * 0.38;

  const caption = new PIXI.Text(
    '种菜',
    new PIXI.TextStyle({
      fill: '#ffffff',
      fontFamily: 'VCR OSD Mono, monospace',
      fontSize: Math.max(10, tileDim * 0.32),
      align: 'center',
      dropShadow: true,
      dropShadowColor: '#181425',
      dropShadowDistance: 2,
    }),
  );
  caption.anchor.set(0.5);
  caption.x = width / 2;
  caption.y = tileDim * 4.55;

  container.addChild(sign);
  container.addChild(caption);
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
