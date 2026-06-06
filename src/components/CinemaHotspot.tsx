import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { FARM_TILE_FRAMES, addFarmTile } from './farmLifeTiles';

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

  graphics.beginFill(0x181425, 0.35);
  graphics.drawRect(tileDim * 0.65, tileDim * 4.45, width - tileDim * 1.3, tileDim * 0.34);
  graphics.endFill();
  container.addChild(graphics);

  for (let x = 1; x <= 6; x += 1) {
    addFarmTile(container, FARM_TILE_FRAMES.roofPurple, tileDim, x, 0);
    addFarmTile(container, FARM_TILE_FRAMES.wallPurple, tileDim, x, 1);
    addFarmTile(container, FARM_TILE_FRAMES.wallPurple, tileDim, x, 2);
    addFarmTile(container, FARM_TILE_FRAMES.wallGray, tileDim, x, 3);
  }
  addFarmTile(container, FARM_TILE_FRAMES.roofGray, tileDim, 0, 1);
  addFarmTile(container, FARM_TILE_FRAMES.roofGray, tileDim, 7, 1);
  addFarmTile(container, FARM_TILE_FRAMES.wallGray, tileDim, 0, 2);
  addFarmTile(container, FARM_TILE_FRAMES.wallGray, tileDim, 7, 2);
  addFarmTile(container, FARM_TILE_FRAMES.door, tileDim, 3.5, 3);
  addFarmTile(container, FARM_TILE_FRAMES.board, tileDim, 2.1, 2.1);
  addFarmTile(container, FARM_TILE_FRAMES.board, tileDim, 4.9, 2.1);
  addFarmTile(container, FARM_TILE_FRAMES.lantern, tileDim, 0.65, 3.35);
  addFarmTile(container, FARM_TILE_FRAMES.lantern, tileDim, 6.95, 3.35);
  addFarmTile(container, FARM_TILE_FRAMES.sign, tileDim, 3.5, 0.25);

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
  sign.y = tileDim * 0.58;

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
  caption.y = tileDim * 2.72;

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
