import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { GARDEN_PORTAL_REGION } from './GardenHotspot';
import { GENTLE_TILES, addGentlePathPatch, addGentleTile } from './gentleTownTiles';

type FarmRoadHotspotProps = {
  tileDim: number;
};

export const FARM_ROAD_EXIT_REGION = GARDEN_PORTAL_REGION;

function addRoadSign(container: PIXI.Container, tileDim: number, tileX: number, tileY: number) {
  const graphics = new PIXI.Graphics();
  graphics.beginFill(0x181425, 0.88);
  graphics.drawRoundedRect(tileX * tileDim, tileY * tileDim, tileDim * 2.75, tileDim * 0.68, 3);
  graphics.endFill();
  graphics.beginFill(0xfec742, 1);
  graphics.drawRect(tileX * tileDim + 4, tileY * tileDim + 4, tileDim * 2.75 - 8, tileDim * 0.68 - 8);
  graphics.endFill();
  container.addChild(graphics);

  const label = new PIXI.Text('去农场', {
    align: 'center',
    fill: '#181425',
    fontFamily: 'sans-serif',
    fontSize: Math.max(10, tileDim * 0.34),
    fontWeight: '700',
  });
  label.anchor.set(0.5);
  label.resolution = 2;
  label.x = (tileX + 1.38) * tileDim;
  label.y = (tileY + 0.34) * tileDim;
  container.addChild(label);
}

function buildFarmRoadSprite(tileDim: number) {
  const container = new PIXI.Container();
  const graphics = new PIXI.Graphics();

  graphics.beginFill(0x181425, 0.1);
  graphics.drawEllipse(tileDim * 37, tileDim * 36.7, tileDim * 12, tileDim * 0.7);
  graphics.endFill();
  container.addChild(graphics);

  for (let x = 24; x <= 46; x += 2) {
    addGentlePathPatch(container, tileDim, x, 36);
  }
  for (let y = 24; y <= 34; y += 2) {
    addGentlePathPatch(container, tileDim, 46, y);
  }
  for (let y = 26; y <= 34; y += 2) {
    addGentlePathPatch(container, tileDim, 44, y);
  }
  for (let x = 30; x <= 44; x += 2) {
    addGentlePathPatch(container, tileDim, x, 28);
  }

  addGentleTile(container, GENTLE_TILES.post, tileDim, 45.55, 35.1);
  addGentleTile(container, GENTLE_TILES.post, tileDim, 47.5, 35.1);
  addGentleTile(container, GENTLE_TILES.flowerYellow, tileDim, 43.55, 34.75);
  addGentleTile(container, GENTLE_TILES.flowerWhite, tileDim, 48.45, 34.7);
  addRoadSign(container, tileDim, 44.65, 34.55);

  return container;
}

export const FarmRoadHotspot = PixiComponent('FarmRoadHotspot', {
  create: (props: FarmRoadHotspotProps) => buildFarmRoadSprite(props.tileDim),

  applyProps: (
    instance: PIXI.Container,
    oldProps: FarmRoadHotspotProps,
    newProps: FarmRoadHotspotProps,
  ) => {
    if (oldProps.tileDim !== newProps.tileDim) {
      instance.removeChildren();
      instance.addChild(buildFarmRoadSprite(newProps.tileDim));
    }
    applyDefaultProps(instance, oldProps, newProps);
  },
});
