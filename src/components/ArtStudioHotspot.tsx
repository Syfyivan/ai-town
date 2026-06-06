import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { FARM_TILE_FRAMES, addFarmTile, addFarmTileGrid } from './farmLifeTiles';

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

  graphics.beginFill(0x181425, 0.34);
  graphics.drawRect(tileDim * 1.05, tileDim * 4.5, tileDim * 5.85, tileDim * 0.36);
  graphics.endFill();
  container.addChild(graphics);

  const barnRows = Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 5 }, (_, column) => FARM_TILE_FRAMES.barnFrontStart + row * 5 + column),
  );
  addFarmTileGrid(container, barnRows, tileDim, 1.5, 0);
  addFarmTile(container, FARM_TILE_FRAMES.board, tileDim, 1.15, 3.35);
  addFarmTile(container, FARM_TILE_FRAMES.flowerRed, tileDim, 0.85, 4.05);
  addFarmTile(container, FARM_TILE_FRAMES.flowerBlue, tileDim, 6.15, 4.05);
  addFarmTile(container, FARM_TILE_FRAMES.sign, tileDim, 3.5, 0.25);

  const sign = new PIXI.Text(
    '溪山画室',
    new PIXI.TextStyle({
      fill: '#181425',
      fontFamily: 'VCR OSD Mono, monospace',
      fontSize: Math.max(11, tileDim * 0.36),
      align: 'center',
    }),
  );
  sign.anchor.set(0.5);
  sign.x = width / 2;
  sign.y = tileDim * 0.6;

  const caption = new PIXI.Text(
    '临时工',
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
  caption.y = tileDim * 4.58;

  container.addChild(sign);
  container.addChild(caption);
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
