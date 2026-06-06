import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';

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

function drawPixelRect(
  graphics: PIXI.Graphics,
  color: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  graphics.beginFill(color);
  graphics.drawRect(x, y, width, height);
  graphics.endFill();
}

function buildGardenSprite(tileDim: number) {
  const width = GARDEN_REGION.width * tileDim;
  const height = GARDEN_REGION.height * tileDim;
  const container = new PIXI.Container() as GardenHotspotContainer;
  const graphics = new PIXI.Graphics();

  graphics.lineStyle(4, 0x181425, 1);
  drawPixelRect(graphics, 0x3f2832, 0, tileDim * 0.65, width, height - tileDim * 0.65);
  drawPixelRect(
    graphics,
    0x8f563b,
    tileDim * 0.45,
    tileDim,
    width - tileDim * 0.9,
    height - tileDim * 1.45,
  );

  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      const x = tileDim * (0.95 + col * 2.45);
      const y = tileDim * (1.55 + row * 1.35);
      drawPixelRect(graphics, 0x5b6b34, x, y, tileDim * 1.65, tileDim * 0.85);
      drawPixelRect(
        graphics,
        0x6abe30,
        x + tileDim * 0.2,
        y + tileDim * 0.16,
        tileDim * 0.35,
        tileDim * 0.32,
      );
      drawPixelRect(
        graphics,
        0x99e550,
        x + tileDim * 0.85,
        y + tileDim * 0.18,
        tileDim * 0.42,
        tileDim * 0.34,
      );
    }
  }

  drawPixelRect(graphics, 0xfec742, tileDim * 1.45, tileDim * 0.25, tileDim * 4.1, tileDim * 0.48);
  drawPixelRect(
    graphics,
    0x181425,
    tileDim * 0.15,
    tileDim * 4.12,
    width - tileDim * 0.3,
    tileDim * 0.25,
  );

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
  sign.y = tileDim * 0.5;

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

  container.addChild(graphics);
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
