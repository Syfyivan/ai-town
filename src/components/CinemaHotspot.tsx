import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import {
  GENTLE_TILES,
  addGentlePathPatch,
  addGentleTile,
  addGentleTileGrid,
} from './gentleTownTiles';

type CinemaHotspotProps = {
  tileDim: number;
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
  const container = new PIXI.Container();
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

  return container;
}

export const CinemaHotspot = PixiComponent('CinemaHotspot', {
  create: (props: CinemaHotspotProps) => {
    const container = buildCinemaSprite(props.tileDim);
    container.x = CINEMA_REGION.x * props.tileDim;
    container.y = CINEMA_REGION.y * props.tileDim;
    return container;
  },

  applyProps: (
    instance: PIXI.Container,
    oldProps: CinemaHotspotProps,
    newProps: CinemaHotspotProps,
  ) => {
    if (oldProps.tileDim !== newProps.tileDim) {
      instance.x = CINEMA_REGION.x * newProps.tileDim;
      instance.y = CINEMA_REGION.y * newProps.tileDim;
    }
    applyDefaultProps(instance, oldProps, newProps);
  },
});
