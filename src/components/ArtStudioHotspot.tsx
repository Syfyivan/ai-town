import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import {
  GENTLE_TILES,
  addGentlePathPatch,
  addGentleTile,
  addGentleTileGrid,
} from './gentleTownTiles';

type ArtStudioHotspotProps = {
  onOpenArtStudio: () => void;
  tileDim: number;
};

type ArtStudioHotspotContainer = PIXI.Container & {
  openArtStudio?: () => void;
};

export const ART_STUDIO_REGION = {
  x: 12,
  y: 27,
  width: 10,
  height: 8,
};

export const ART_STUDIO_PORTAL_REGION = {
  x: 16,
  y: 33,
  width: 2,
  height: 1,
};

function buildArtStudioSprite(tileDim: number) {
  const container = new PIXI.Container() as ArtStudioHotspotContainer;
  const graphics = new PIXI.Graphics();

  graphics.beginFill(0x181425, 0.18);
  graphics.drawEllipse(tileDim * 4.55, tileDim * 5.55, tileDim * 2.2, tileDim * 0.3);
  graphics.endFill();
  container.addChild(graphics);

  addGentlePathPatch(container, tileDim, 4, 5.35);
  addGentlePathPatch(container, tileDim, 3.6, 4);
  addGentlePathPatch(container, tileDim, 3.9, 2.7);

  addGentleTileGrid(
    container,
    [
      [GENTLE_TILES.tentTopLeft, GENTLE_TILES.tentTop, GENTLE_TILES.tentTopRight],
      [GENTLE_TILES.tentMidLeft, GENTLE_TILES.tentMid, GENTLE_TILES.tentMidRight],
      [GENTLE_TILES.tentBottomLeft, GENTLE_TILES.tentBottom, GENTLE_TILES.tentBottomRight],
    ],
    tileDim,
    3.35,
    1,
  );

  addGentleTile(container, GENTLE_TILES.log, tileDim, 2, 4.6);
  addGentleTile(container, GENTLE_TILES.flowerRed, tileDim, 1.55, 5.45);
  addGentleTile(container, GENTLE_TILES.flowerWhite, tileDim, 7.1, 5.35);
  addGentleTile(container, GENTLE_TILES.post, tileDim, 3.75, 6.05);
  addGentleTile(container, GENTLE_TILES.post, tileDim, 5.7, 6.05);
  container.hitArea = new PIXI.Rectangle(
    (ART_STUDIO_PORTAL_REGION.x - ART_STUDIO_REGION.x) * tileDim,
    (ART_STUDIO_PORTAL_REGION.y - ART_STUDIO_REGION.y) * tileDim,
    ART_STUDIO_PORTAL_REGION.width * tileDim,
    ART_STUDIO_PORTAL_REGION.height * tileDim,
  );
  container.eventMode = 'static';
  container.cursor = 'pointer';
  return container;
}

export const ArtStudioHotspot = PixiComponent('ArtStudioHotspot', {
  create: (props: ArtStudioHotspotProps) => {
    const container = buildArtStudioSprite(props.tileDim);
    container.x = ART_STUDIO_REGION.x * props.tileDim;
    container.y = ART_STUDIO_REGION.y * props.tileDim;
    container.openArtStudio = props.onOpenArtStudio;
    container.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      event.stopPropagation();
    });
    container.on('pointerup', (event: PIXI.FederatedPointerEvent) => {
      event.stopPropagation();
    });
    container.on('pointertap', (event: PIXI.FederatedPointerEvent) => {
      event.stopPropagation();
      container.openArtStudio?.();
    });
    return container;
  },

  applyProps: (
    instance: ArtStudioHotspotContainer,
    oldProps: ArtStudioHotspotProps,
    newProps: ArtStudioHotspotProps,
  ) => {
    instance.openArtStudio = newProps.onOpenArtStudio;
    if (oldProps.tileDim !== newProps.tileDim) {
      instance.x = ART_STUDIO_REGION.x * newProps.tileDim;
      instance.y = ART_STUDIO_REGION.y * newProps.tileDim;
    }
    applyDefaultProps(instance, oldProps, newProps);
  },
});
