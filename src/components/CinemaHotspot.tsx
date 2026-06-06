import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { GENTLE_TILES, addGentleTile, addGentleTileGrid } from './gentleTownTiles';

type CinemaHotspotProps = {
  onOpenCinema: () => void;
  tileDim: number;
};

type CinemaHotspotContainer = PIXI.Container & {
  openCinema?: () => void;
};

export const CINEMA_REGION = {
  x: 33,
  y: 16,
  width: 8,
  height: 5,
};

function buildCinemaSprite(tileDim: number) {
  const width = CINEMA_REGION.width * tileDim;
  const height = CINEMA_REGION.height * tileDim;
  const container = new PIXI.Container() as CinemaHotspotContainer;
  const graphics = new PIXI.Graphics();

  graphics.beginFill(0x181425, 0.18);
  graphics.drawEllipse(width / 2, tileDim * 4.15, tileDim * 2.25, tileDim * 0.32);
  graphics.endFill();
  container.addChild(graphics);

  addGentleTileGrid(
    container,
    [
      [GENTLE_TILES.tentTopLeft, GENTLE_TILES.tentTop, GENTLE_TILES.tentTopRight],
      [GENTLE_TILES.tentMidLeft, GENTLE_TILES.tentMid, GENTLE_TILES.tentMidRight],
      [GENTLE_TILES.tentBottomLeft, GENTLE_TILES.tentBottom, GENTLE_TILES.tentBottomRight],
    ],
    tileDim,
    2.65,
    0.95,
  );
  addGentleTile(container, GENTLE_TILES.post, tileDim, 1.45, 2.15);
  addGentleTile(container, GENTLE_TILES.post, tileDim, 5.95, 2.15);
  addGentleTile(container, GENTLE_TILES.log, tileDim, 1.35, 3.45);
  addGentleTile(container, GENTLE_TILES.rock, tileDim, 5.85, 3.38);
  addGentleTile(container, GENTLE_TILES.flowerWhite, tileDim, 6.25, 2.95);

  container.hitArea = new PIXI.Rectangle(0, 0, width, height);
  container.eventMode = 'static';
  container.cursor = 'pointer';
  return container;
}

export const CinemaHotspot = PixiComponent('CinemaHotspot', {
  create: (props: CinemaHotspotProps) => {
    const container = buildCinemaSprite(props.tileDim);
    container.x = CINEMA_REGION.x * props.tileDim;
    container.y = CINEMA_REGION.y * props.tileDim;
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

  applyProps: (
    instance: CinemaHotspotContainer,
    oldProps: CinemaHotspotProps,
    newProps: CinemaHotspotProps,
  ) => {
    instance.openCinema = newProps.onOpenCinema;
    if (oldProps.tileDim !== newProps.tileDim) {
      instance.x = CINEMA_REGION.x * newProps.tileDim;
      instance.y = CINEMA_REGION.y * newProps.tileDim;
    }
    applyDefaultProps(instance, oldProps, newProps);
  },
});
