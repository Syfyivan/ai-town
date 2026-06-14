import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import {
  GENTLE_TILES,
  addGentlePathPatch,
  addGentleTile,
  addGentleTileGrid,
} from './gentleTownTiles';

type SpyglassHotspotProps = {
  tileDim: number;
};

// The "观景台" (spyglass / observatory) building footprint. Walk onto the portal
// tile and press X to open the infinite visual canvas — looking through the
// telescope zooms you deeper into the living town.
export const SPYGLASS_REGION = {
  x: 31,
  y: 14,
  width: 12,
  height: 9,
};

export const SPYGLASS_PORTAL_REGION = {
  x: 35,
  y: 21,
  width: 2,
  height: 1,
};

function buildSpyglassSprite(tileDim: number) {
  const container = new PIXI.Container();
  const graphics = new PIXI.Graphics();

  // Ground shadow.
  graphics.beginFill(0x181425, 0.18);
  graphics.drawEllipse(tileDim * 5.15, tileDim * 5.55, tileDim * 2.25, tileDim * 0.32);
  graphics.endFill();
  container.addChild(graphics);

  addGentlePathPatch(container, tileDim, 4, 5.35);
  addGentlePathPatch(container, tileDim, 4.2, 4);
  addGentlePathPatch(container, tileDim, 4.55, 2.7);

  // Observation platform.
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

  // A small brass telescope on a tripod, so the building reads as an observatory.
  const scope = new PIXI.Graphics();
  const baseX = tileDim * 5.55;
  const baseY = tileDim * 2.65;
  scope.lineStyle(Math.max(1, tileDim * 0.06), 0x3b2f2f, 1);
  // Tripod legs.
  scope.moveTo(baseX, baseY + tileDim * 0.7);
  scope.lineTo(baseX - tileDim * 0.45, baseY + tileDim * 1.5);
  scope.moveTo(baseX, baseY + tileDim * 0.7);
  scope.lineTo(baseX + tileDim * 0.45, baseY + tileDim * 1.5);
  scope.moveTo(baseX, baseY + tileDim * 0.7);
  scope.lineTo(baseX, baseY + tileDim * 1.5);
  // Barrel pointing up at the sky.
  scope.lineStyle(0);
  scope.beginFill(0xfec742, 1);
  scope.drawRoundedRect(baseX - tileDim * 0.15, baseY - tileDim * 0.6, tileDim * 0.9, tileDim * 0.42, tileDim * 0.18);
  scope.endFill();
  scope.beginFill(0x5acde8, 0.9);
  scope.drawCircle(baseX + tileDim * 0.78, baseY - tileDim * 0.42, tileDim * 0.22);
  scope.endFill();
  scope.angle = -28;
  scope.pivot.set(baseX, baseY);
  scope.position.set(baseX, baseY);
  container.addChild(scope);

  return container;
}

export const SpyglassHotspot = PixiComponent('SpyglassHotspot', {
  create: (props: SpyglassHotspotProps) => {
    const container = buildSpyglassSprite(props.tileDim);
    container.x = SPYGLASS_REGION.x * props.tileDim;
    container.y = SPYGLASS_REGION.y * props.tileDim;
    return container;
  },

  applyProps: (
    instance: PIXI.Container,
    oldProps: SpyglassHotspotProps,
    newProps: SpyglassHotspotProps,
  ) => {
    if (oldProps.tileDim !== newProps.tileDim) {
      instance.x = SPYGLASS_REGION.x * newProps.tileDim;
      instance.y = SPYGLASS_REGION.y * newProps.tileDim;
    }
    applyDefaultProps(instance, oldProps, newProps);
  },
});
