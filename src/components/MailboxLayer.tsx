import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';

type MailboxLayerProps = {
  count: number;
  tileDim: number;
};

type MailboxLayerContainer = PIXI.Container & {
  mailboxCount?: number;
  tileDim?: number;
};

const MAILBOX_POSITIONS = [
  { x: 8.2, y: 8.8 },
  { x: 18.6, y: 9.2 },
  { x: 25.4, y: 16.1 },
  { x: 49.2, y: 12.7 },
  { x: 58.4, y: 21.4 },
  { x: 8.8, y: 31.7 },
  { x: 27.6, y: 33.2 },
  { x: 51.1, y: 33.8 },
];

function addMailbox(container: PIXI.Container, tileDim: number, tileX: number, tileY: number) {
  const x = tileX * tileDim;
  const y = tileY * tileDim;
  const graphics = new PIXI.Graphics();
  const unit = tileDim / 16;

  graphics.beginFill(0x181425, 0.28);
  graphics.drawEllipse(x + unit * 8, y + unit * 14, unit * 6, unit * 1.8);
  graphics.endFill();

  graphics.beginFill(0x5b3a31);
  graphics.drawRect(x + unit * 7, y + unit * 8, unit * 2, unit * 7);
  graphics.endFill();

  graphics.beginFill(0x181425);
  graphics.drawRect(x + unit * 3, y + unit * 4, unit * 11, unit * 7);
  graphics.endFill();

  graphics.beginFill(0x8f563b);
  graphics.drawRect(x + unit * 4, y + unit * 5, unit * 9, unit * 5);
  graphics.endFill();

  graphics.beginFill(0xead4aa);
  graphics.drawRect(x + unit * 5, y + unit * 6, unit * 5, unit * 1);
  graphics.endFill();

  graphics.beginFill(0xd95763);
  graphics.drawRect(x + unit * 12, y + unit * 3, unit * 2, unit * 5);
  graphics.endFill();

  container.addChild(graphics);
}

function rebuildMailboxes(container: MailboxLayerContainer, props: MailboxLayerProps) {
  container.removeChildren();
  const mailboxCount = Math.min(Math.max(0, props.count), MAILBOX_POSITIONS.length);
  for (let index = 0; index < mailboxCount; index += 1) {
    const position = MAILBOX_POSITIONS[index];
    addMailbox(container, props.tileDim, position.x, position.y);
  }
  container.mailboxCount = props.count;
  container.tileDim = props.tileDim;
}

export const MailboxLayer = PixiComponent('MailboxLayer', {
  create: (props: MailboxLayerProps) => {
    const container = new PIXI.Container() as MailboxLayerContainer;
    container.eventMode = 'none';
    rebuildMailboxes(container, props);
    return container;
  },

  applyProps: (
    instance: MailboxLayerContainer,
    oldProps: MailboxLayerProps,
    newProps: MailboxLayerProps,
  ) => {
    if (oldProps.count !== newProps.count || oldProps.tileDim !== newProps.tileDim) {
      rebuildMailboxes(instance, newProps);
    }
    applyDefaultProps(instance, oldProps, newProps);
  },
});
