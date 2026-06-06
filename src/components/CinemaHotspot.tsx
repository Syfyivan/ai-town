import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import {
  GENTLE_TILES,
  addGentlePathPatch,
  addGentleTile,
  addGentleTileGrid,
} from './gentleTownTiles';

type CinemaHotspotProps = {
  onOpenCinema: () => void;
  tileDim: number;
};

type CinemaHotspotContainer = PIXI.Container & {
  openCinema?: () => void;
};

export const CINEMA_REGION = {
  x: 31,
  y: 14,
  width: 12,
  height: 9,
};

export const CINEMA_PORTAL_REGION = {
  x: 35,
  y: 21,
  width: 2,
  height: 1,
};

function buildCinemaSprite(tileDim: number) {
  const container = new PIXI.Container() as CinemaHotspotContainer;
  const graphics = new PIXI.Graphics();

  graphics.beginFill(0x181425, 0.18);
  graphics.drawEllipse(tileDim * 5.15, tileDim * 5.55, tileDim * 2.25, tileDim * 0.32);
  graphics.endFill();
  container.addChild(graphics);

  addGentlePathPatch(container, tileDim, 4, 5.35);
  addGentlePathPatch(container, tileDim, 4.2, 4);
  addGentlePathPatch(container, tileDim, 4.55, 2.7);

  addGentleTileGrid(
    container,
    [
      [GENTLE_TILES.tentTopLeft, GENTLE_TILES.tentTop, GENTLE_TILES.tentTopRight],
      [GENTLE_TILES.tentMidLeft, GENTLE_TILES.tentMid, GENTLE_TILES.tentMidRight],
      [GENTLE_TILES.tentBottomLeft, GENTLE_TILES.tentBottom, GENTLE_TILES.tentBottomRight],
    ],
    tileDim,
    4.05,
    0.95,
  );
  addGentleTile(container, GENTLE_TILES.post, tileDim, 3.2, 6.05);
  addGentleTile(container, GENTLE_TILES.post, tileDim, 5.2, 6.05);
  addGentleTile(container, GENTLE_TILES.log, tileDim, 2.25, 4.85);
  addGentleTile(container, GENTLE_TILES.rock, tileDim, 7.45, 4.85);
  addGentleTile(container, GENTLE_TILES.flowerWhite, tileDim, 8.25, 3.75);

  container.hitArea = new PIXI.Rectangle(
    (CINEMA_PORTAL_REGION.x - CINEMA_REGION.x) * tileDim,
    (CINEMA_PORTAL_REGION.y - CINEMA_REGION.y) * tileDim,
    CINEMA_PORTAL_REGION.width * tileDim,
    CINEMA_PORTAL_REGION.height * tileDim,
  );
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
