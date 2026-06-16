import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { GENTLE_TILES, addGentleTile } from './gentleTownTiles';
import { FARM_LIFE_BUILDING_SPRITES, addFarmLifeSprite } from './farmLifeSprites';

type ArtStudioHotspotProps = {
  tileDim: number;
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
  const container = new PIXI.Container();
  const graphics = new PIXI.Graphics();

  graphics.beginFill(0x181425, 0.18);
  graphics.drawEllipse(tileDim * 4.55, tileDim * 5.55, tileDim * 2.2, tileDim * 0.3);
  graphics.endFill();
  container.addChild(graphics);

  addFarmLifeSprite(
    container,
    FARM_LIFE_BUILDING_SPRITES.houseStudio,
    tileDim,
    2.05,
    1.05,
    5.85,
  );

  addGentleTile(container, GENTLE_TILES.stump, tileDim, 1.55, 5.2);
  addGentleTile(container, GENTLE_TILES.flowerPurple, tileDim, 1.55, 5.95);
  addGentleTile(container, GENTLE_TILES.flowerBlue, tileDim, 7.1, 5.35);
  addGentleTile(container, GENTLE_TILES.rock, tileDim, 3.75, 6.05);
  addGentleTile(container, GENTLE_TILES.grassSprig, tileDim, 5.7, 6.05);
  return container;
}

export const ArtStudioHotspot = PixiComponent('ArtStudioHotspot', {
  create: (props: ArtStudioHotspotProps) => {
    const container = buildArtStudioSprite(props.tileDim);
    container.x = ART_STUDIO_REGION.x * props.tileDim;
    container.y = ART_STUDIO_REGION.y * props.tileDim;
    container.zIndex = (ART_STUDIO_REGION.y + ART_STUDIO_REGION.height) * props.tileDim;
    return container;
  },

  applyProps: (
    instance: PIXI.Container,
    oldProps: ArtStudioHotspotProps,
    newProps: ArtStudioHotspotProps,
  ) => {
    if (oldProps.tileDim !== newProps.tileDim) {
      instance.x = ART_STUDIO_REGION.x * newProps.tileDim;
      instance.y = ART_STUDIO_REGION.y * newProps.tileDim;
      instance.zIndex = (ART_STUDIO_REGION.y + ART_STUDIO_REGION.height) * newProps.tileDim;
    }
    applyDefaultProps(instance, oldProps, newProps);
  },
});
