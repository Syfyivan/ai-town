import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { FARM_LIFE_BUILDING_SPRITES, addFarmLifeSprite } from './farmLifeSprites';

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

  // Ground shadow.
  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x181425, 0.18);
  shadow.drawEllipse(tileDim * 5.5, tileDim * 7.4, tileDim * 2.6, tileDim * 0.34);
  shadow.endFill();
  container.addChild(shadow);

  // Clean lookout-tower building from the Farm RPG pack.
  addFarmLifeSprite(container, FARM_LIFE_BUILDING_SPRITES.lookoutTower, tileDim, 3.7, 0.0, 3.55);

  return container;
}

export const SpyglassHotspot = PixiComponent('SpyglassHotspot', {
  create: (props: SpyglassHotspotProps) => {
    const container = buildSpyglassSprite(props.tileDim);
    container.x = SPYGLASS_REGION.x * props.tileDim;
    container.y = SPYGLASS_REGION.y * props.tileDim;
    container.zIndex = (SPYGLASS_REGION.y + SPYGLASS_REGION.height) * props.tileDim;
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
      instance.zIndex = (SPYGLASS_REGION.y + SPYGLASS_REGION.height) * newProps.tileDim;
    }
    applyDefaultProps(instance, oldProps, newProps);
  },
});
