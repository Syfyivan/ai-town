import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';

type ArtStudioHotspotProps = {
  onOpenArtStudio: () => void;
  tileDim: number;
};

type ArtStudioHotspotContainer = PIXI.Container & {
  openArtStudio?: () => void;
};

const ART_STUDIO_TILE_X = 12;
const ART_STUDIO_TILE_Y = 28;
const ART_STUDIO_WIDTH_TILES = 8;
const ART_STUDIO_HEIGHT_TILES = 5;

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

function buildArtStudioSprite(tileDim: number) {
  const width = ART_STUDIO_WIDTH_TILES * tileDim;
  const height = ART_STUDIO_HEIGHT_TILES * tileDim;
  const container = new PIXI.Container() as ArtStudioHotspotContainer;
  const graphics = new PIXI.Graphics();

  graphics.lineStyle(4, 0x181425, 1);
  drawPixelRect(graphics, 0x181425, 0, tileDim * 1.1, width, height - tileDim * 1.1);
  drawPixelRect(graphics, 0xecd8a7, tileDim * 0.45, tileDim * 1.45, width - tileDim * 0.9, height - tileDim * 1.9);
  drawPixelRect(graphics, 0xb86f50, tileDim, tileDim * 1.85, width - tileDim * 2, height - tileDim * 2.45);

  graphics.beginFill(0x6e2146);
  graphics.drawPolygon([
    tileDim * 0.1,
    tileDim * 1.15,
    width / 2,
    tileDim * 0.05,
    width - tileDim * 0.1,
    tileDim * 1.15,
    width - tileDim * 0.5,
    tileDim * 1.55,
    tileDim * 0.5,
    tileDim * 1.55,
  ]);
  graphics.endFill();

  drawPixelRect(graphics, 0xfec742, tileDim * 2.15, tileDim * 0.55, tileDim * 3.7, tileDim * 0.5);
  drawPixelRect(graphics, 0x181425, tileDim * 1.15, tileDim * 2.35, tileDim * 1.45, tileDim * 1.9);
  drawPixelRect(graphics, 0x3a4466, tileDim * 4.95, tileDim * 2.05, tileDim * 1.35, tileDim * 1.25);

  graphics.lineStyle(3, 0x181425, 1);
  graphics.beginFill(0xfff1c1);
  graphics.drawRect(tileDim * 3.05, tileDim * 2.15, tileDim * 1.45, tileDim * 1.15);
  graphics.endFill();
  graphics.lineStyle(2, 0xdd7c42, 1);
  graphics.moveTo(tileDim * 3.22, tileDim * 2.95);
  graphics.lineTo(tileDim * 3.75, tileDim * 2.42);
  graphics.lineTo(tileDim * 4.25, tileDim * 2.78);

  graphics.lineStyle(3, 0x181425, 1);
  graphics.moveTo(tileDim * 3.75, tileDim * 3.3);
  graphics.lineTo(tileDim * 3.25, tileDim * 4.15);
  graphics.moveTo(tileDim * 3.75, tileDim * 3.3);
  graphics.lineTo(tileDim * 4.28, tileDim * 4.15);

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
  sign.y = tileDim * 0.83;

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
  caption.y = tileDim * 4.42;

  container.addChild(graphics);
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
    container.x = ART_STUDIO_TILE_X * props.tileDim;
    container.y = ART_STUDIO_TILE_Y * props.tileDim;
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
      instance.x = ART_STUDIO_TILE_X * newProps.tileDim;
      instance.y = ART_STUDIO_TILE_Y * newProps.tileDim;
    }
    applyDefaultProps(instance, oldProps, newProps);
  },
});
