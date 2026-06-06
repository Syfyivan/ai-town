import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { GENTLE_TILES, addGentleTile, addGentleTileGrid } from './gentleTownTiles';

type ArtStudioHotspotProps = {
  onOpenArtStudio: () => void;
  tileDim: number;
};

type ArtStudioHotspotContainer = PIXI.Container & {
  openArtStudio?: () => void;
};

export const ART_STUDIO_REGION = {
  x: 12,
  y: 28,
  width: 8,
  height: 5,
};

function buildArtStudioSprite(tileDim: number) {
  const width = ART_STUDIO_REGION.width * tileDim;
  const height = ART_STUDIO_REGION.height * tileDim;
  const container = new PIXI.Container() as ArtStudioHotspotContainer;
  const graphics = new PIXI.Graphics();

  graphics.beginFill(0x181425, 0.18);
  graphics.drawEllipse(tileDim * 4, tileDim * 4.42, tileDim * 2.25, tileDim * 0.34);
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
    2.5,
    1,
  );

  addGentleTile(container, GENTLE_TILES.log, tileDim, 1.45, 3.35);
  addGentleTile(container, GENTLE_TILES.flowerRed, tileDim, 1.2, 4.05);
  addGentleTile(container, GENTLE_TILES.flowerWhite, tileDim, 5.55, 4.08);
  addGentleTile(container, GENTLE_TILES.post, tileDim, 5.7, 3.05);
  container.hitArea = new PIXI.Rectangle(0, 0, width, height);
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
