import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';

type CinemaHotspotProps = {
  onOpenCinema: () => void;
  tileDim: number;
};

type CinemaHotspotContainer = PIXI.Container & {
  openCinema?: () => void;
};

const CINEMA_TILE_X = 33;
const CINEMA_TILE_Y = 16;
const CINEMA_WIDTH_TILES = 8;
const CINEMA_HEIGHT_TILES = 5;

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

function buildCinemaSprite(tileDim: number) {
  const width = CINEMA_WIDTH_TILES * tileDim;
  const height = CINEMA_HEIGHT_TILES * tileDim;
  const container = new PIXI.Container() as CinemaHotspotContainer;
  const graphics = new PIXI.Graphics();

  graphics.lineStyle(4, 0x181425, 1);
  drawPixelRect(graphics, 0x181425, 0, tileDim, width, height - tileDim);
  drawPixelRect(graphics, 0x3f2832, tileDim / 2, tileDim * 1.3, width - tileDim, height - tileDim * 1.5);
  drawPixelRect(graphics, 0x743f39, tileDim, tileDim * 1.65, width - tileDim * 2, height - tileDim * 2.2);
  drawPixelRect(graphics, 0x0f1020, tileDim * 1.4, tileDim * 2, width - tileDim * 2.8, tileDim * 1.65);

  graphics.lineStyle(3, 0xfec742, 0.95);
  graphics.beginFill(0x2a1b2d);
  graphics.drawRect(tileDim * 1.55, tileDim * 2.15, width - tileDim * 3.1, tileDim * 1.35);
  graphics.endFill();

  graphics.lineStyle(0);
  for (let i = 0; i < 9; i += 1) {
    const x = tileDim * 1.8 + i * tileDim * 0.55;
    drawPixelRect(graphics, i % 2 === 0 ? 0xfec742 : 0x5acde8, x, tileDim * 2.4, tileDim * 0.26, tileDim * 0.42);
  }

  graphics.beginFill(0x6e2146);
  graphics.drawPolygon([
    0,
    tileDim,
    width / 2,
    0,
    width,
    tileDim,
    width - tileDim * 0.4,
    tileDim * 1.35,
    tileDim * 0.4,
    tileDim * 1.35,
  ]);
  graphics.endFill();

  drawPixelRect(graphics, 0xfec742, tileDim * 2.15, tileDim * 0.48, tileDim * 3.7, tileDim * 0.5);
  drawPixelRect(graphics, 0xdd7c42, tileDim * 2.35, tileDim * 0.64, tileDim * 3.3, tileDim * 0.18);
  drawPixelRect(graphics, 0x181425, tileDim * 3.4, tileDim * 3.9, tileDim * 1.2, tileDim * 1.1);

  const sign = new PIXI.Text(
    'AI 影院',
    new PIXI.TextStyle({
      fill: '#181425',
      fontFamily: 'VCR OSD Mono, monospace',
      fontSize: Math.max(12, tileDim * 0.42),
      align: 'center',
    }),
  );
  sign.anchor.set(0.5);
  sign.x = width / 2;
  sign.y = tileDim * 0.72;

  const caption = new PIXI.Text(
    '无限视觉',
    new PIXI.TextStyle({
      fill: '#ffffff',
      fontFamily: 'VCR OSD Mono, monospace',
      fontSize: Math.max(10, tileDim * 0.34),
      align: 'center',
      dropShadow: true,
      dropShadowColor: '#181425',
      dropShadowDistance: 2,
    }),
  );
  caption.anchor.set(0.5);
  caption.x = width / 2;
  caption.y = tileDim * 2.98;

  container.addChild(graphics);
  container.addChild(sign);
  container.addChild(caption);
  container.hitArea = new PIXI.Rectangle(0, 0, width, height);
  container.eventMode = 'static';
  container.cursor = 'pointer';
  return container;
}

export const CinemaHotspot = PixiComponent('CinemaHotspot', {
  create: (props: CinemaHotspotProps) => {
    const container = buildCinemaSprite(props.tileDim);
    container.x = CINEMA_TILE_X * props.tileDim;
    container.y = CINEMA_TILE_Y * props.tileDim;
    container.openCinema = props.onOpenCinema;
    container.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      event.stopPropagation();
    });
    container.on('pointerup', (event: PIXI.FederatedPointerEvent) => {
      event.stopPropagation();
    });
    container.on('pointertap', (event: PIXI.FederatedPointerEvent) => {
      event.stopPropagation();
      container.openCinema?.();
    });
    return container;
  },

  applyProps: (instance: CinemaHotspotContainer, oldProps: CinemaHotspotProps, newProps: CinemaHotspotProps) => {
    instance.openCinema = newProps.onOpenCinema;
    if (oldProps.tileDim !== newProps.tileDim) {
      instance.x = CINEMA_TILE_X * newProps.tileDim;
      instance.y = CINEMA_TILE_Y * newProps.tileDim;
    }
    applyDefaultProps(instance, oldProps, newProps);
  },
});
