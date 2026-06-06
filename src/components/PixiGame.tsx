import * as PIXI from 'pixi.js';
import { useApp } from '@pixi/react';
import { Player, SelectElement } from './Player.tsx';
import { useEffect, useRef, useState } from 'react';
import { PixiStaticMap } from './PixiStaticMap.tsx';
import PixiViewport from './PixiViewport.tsx';
import { Viewport } from 'pixi-viewport';
import { Id } from '../../convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api.js';
import { useSendInput } from '../hooks/sendInput.ts';
import { toastOnError } from '../toasts.ts';
import { DebugPath } from './DebugPath.tsx';
import { PositionIndicator } from './PositionIndicator.tsx';
import { SHOW_DEBUG_UI } from './Game.tsx';
import { ServerGame } from '../hooks/serverGame.ts';
import { CINEMA_PORTAL_REGION, CinemaHotspot } from './CinemaHotspot.tsx';
import { ART_STUDIO_PORTAL_REGION, ArtStudioHotspot } from './ArtStudioHotspot.tsx';
import { GARDEN_PORTAL_REGION, GardenHotspot } from './GardenHotspot.tsx';
import { useSessionIdentity } from '../hooks/useSessionIdentity.ts';
import { Point } from '../../convex/util/types.ts';
import { usePlayerSettings } from '../hooks/usePlayerSettings.ts';
import { MailboxLayer } from './MailboxLayer.tsx';

type TileRegion = { x: number; y: number; width: number; height: number };

function pointInRegion(position: Point, region: TileRegion) {
  return (
    position.x >= region.x &&
    position.x < region.x + region.width &&
    position.y >= region.y &&
    position.y < region.y + region.height
  );
}

function tilePosition(position: Point) {
  return {
    x: Math.floor(position.x),
    y: Math.floor(position.y),
  };
}

function positionKey(position: Point) {
  return `${Math.floor(position.x)}:${Math.floor(position.y)}`;
}

export const PixiGame = (props: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  historicalTime: number | undefined;
  width: number;
  height: number;
  onOpenCinema?: () => void;
  onOpenArtStudio?: () => void;
  onOpenGarden?: () => void;
  setSelectedElement: SelectElement;
}) => {
  // PIXI setup.
  const pixiApp = useApp();
  const viewportRef = useRef<Viewport | undefined>();
  const identity = useSessionIdentity();
  const settings = usePlayerSettings();

  const humanTokenIdentifier =
    useQuery(api.world.userStatus, {
      worldId: props.worldId,
      sessionId: identity.sessionId,
    }) ?? null;
  const humanPlayerId = [...props.game.world.players.values()].find(
    (p) => p.human === humanTokenIdentifier,
  )?.id;

  const moveTo = useSendInput(props.engineId, 'moveTo');
  const lastKeyboardMoveAt = useRef(0);
  const previousPortalPositionRef = useRef<string | null>(null);

  // Interaction for clicking on the world to navigate.
  const dragStart = useRef<{ screenX: number; screenY: number } | null>(null);
  const onMapPointerDown = (e: PIXI.FederatedPointerEvent) => {
    // https://pixijs.download/dev/docs/PIXI.FederatedPointerEvent.html
    dragStart.current = { screenX: e.screenX, screenY: e.screenY };
  };

  const [lastDestination, setLastDestination] = useState<{
    x: number;
    y: number;
    t: number;
  } | null>(null);
  const onMapPointerUp = async (e: PIXI.FederatedPointerEvent) => {
    if (dragStart.current) {
      const { screenX, screenY } = dragStart.current;
      dragStart.current = null;
      const [dx, dy] = [screenX - e.screenX, screenY - e.screenY];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        console.log(`Skipping navigation on drag event (${dist}px)`);
        return;
      }
    }
    if (!humanPlayerId) {
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const gameSpacePx = viewport.toWorld(e.screenX, e.screenY);
    const tileDim = props.game.worldMap.tileDim;
    const gameSpaceTiles = {
      x: gameSpacePx.x / tileDim,
      y: gameSpacePx.y / tileDim,
    };
    setLastDestination({ t: Date.now(), ...gameSpaceTiles });
    const roundedTiles = {
      x: Math.floor(gameSpaceTiles.x),
      y: Math.floor(gameSpaceTiles.y),
    };
    console.log(`Moving to ${JSON.stringify(roundedTiles)}`);
    await toastOnError(moveTo({ playerId: humanPlayerId, destination: roundedTiles }));
  };
  const { width, height, tileDim } = props.game.worldMap;
  const players = [...props.game.world.players.values()];
  const mailboxCount = players.filter((player) => !player.human).length;

  useEffect(() => {
    const isTextInput = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
    };

    const nearRegion = (
      position: Point,
      region: { x: number; y: number; width: number; height: number },
    ) =>
      position.x >= region.x - 1.5 &&
      position.x <= region.x + region.width + 1.5 &&
      position.y >= region.y - 1.5 &&
      position.y <= region.y + region.height + 1.5;

    const selectNearestResident = (position: Point) => {
      let nearest:
        | {
            id: typeof humanPlayerId;
            distanceSq: number;
          }
        | undefined;
      for (const player of props.game.world.players.values()) {
        if (player.id === humanPlayerId) {
          continue;
        }
        const dx = player.position.x - position.x;
        const dy = player.position.y - position.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq > 9) {
          continue;
        }
        if (!nearest || distanceSq < nearest.distanceSq) {
          nearest = { id: player.id, distanceSq };
        }
      }
      if (nearest?.id) {
        props.setSelectedElement({ kind: 'player', id: nearest.id });
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!humanPlayerId || isTextInput(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      const humanPlayer = props.game.world.players.get(humanPlayerId);
      if (!humanPlayer) {
        return;
      }
      const movement: Record<string, Point> = {
        w: { x: 0, y: -1 },
        arrowup: { x: 0, y: -1 },
        a: { x: -1, y: 0 },
        arrowleft: { x: -1, y: 0 },
        s: { x: 0, y: 1 },
        arrowdown: { x: 0, y: 1 },
        d: { x: 1, y: 0 },
        arrowright: { x: 1, y: 0 },
      };

      if (movement[key]) {
        event.preventDefault();
        const now = Date.now();
        const keyboardMoveDelay = settings.movementMode === 'run' ? 95 : 180;
        if (now - lastKeyboardMoveAt.current < keyboardMoveDelay) {
          return;
        }
        lastKeyboardMoveAt.current = now;
        const destination = {
          x: Math.floor(humanPlayer.position.x + movement[key].x),
          y: Math.floor(humanPlayer.position.y + movement[key].y),
        };
        setLastDestination({ t: now, ...destination });
        void toastOnError(moveTo({ playerId: humanPlayerId, destination }));
        return;
      }

      if (key === 'x') {
        event.preventDefault();
        if (props.onOpenArtStudio && nearRegion(humanPlayer.position, ART_STUDIO_PORTAL_REGION)) {
          props.onOpenArtStudio();
          return;
        }
        if (props.onOpenGarden && nearRegion(humanPlayer.position, GARDEN_PORTAL_REGION)) {
          props.onOpenGarden();
          return;
        }
        if (props.onOpenCinema && nearRegion(humanPlayer.position, CINEMA_PORTAL_REGION)) {
          props.onOpenCinema();
          return;
        }
        selectNearestResident(humanPlayer.position);
        return;
      }

      if (key === 'z') {
        event.preventDefault();
        props.setSelectedElement(undefined);
        void toastOnError(moveTo({ playerId: humanPlayerId, destination: null }));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    humanPlayerId,
    moveTo,
    props.game.world.players,
    props.onOpenArtStudio,
    props.onOpenCinema,
    props.onOpenGarden,
    props.setSelectedElement,
    settings.movementMode,
  ]);

  useEffect(() => {
    if (!humanPlayerId) {
      previousPortalPositionRef.current = null;
      return;
    }
    const humanPlayer = props.game.world.players.get(humanPlayerId);
    if (!humanPlayer) {
      previousPortalPositionRef.current = null;
      return;
    }

    const currentPosition = tilePosition(humanPlayer.position);
    const currentKey = positionKey(currentPosition);
    const previousKey = previousPortalPositionRef.current;
    previousPortalPositionRef.current = currentKey;
    if (!previousKey || previousKey === currentKey) {
      return;
    }

    const [previousX, previousY] = previousKey.split(':').map(Number);
    const previousPosition = { x: previousX, y: previousY };
    const portals = [
      {
        open: props.onOpenArtStudio,
        region: ART_STUDIO_PORTAL_REGION,
      },
      {
        open: props.onOpenGarden,
        region: GARDEN_PORTAL_REGION,
      },
      {
        open: props.onOpenCinema,
        region: CINEMA_PORTAL_REGION,
      },
    ];
    const portal = portals.find(
      (candidate) =>
        candidate.open &&
        pointInRegion(currentPosition, candidate.region) &&
        !pointInRegion(previousPosition, candidate.region),
    );
    portal?.open?.();
  }, [
    humanPlayerId,
    props.game.world.players,
    props.onOpenArtStudio,
    props.onOpenCinema,
    props.onOpenGarden,
  ]);

  // Zoom on the user’s avatar when it is created
  useEffect(() => {
    if (!viewportRef.current || humanPlayerId === undefined) return;

    const humanPlayer = props.game.world.players.get(humanPlayerId)!;
    viewportRef.current.animate({
      position: new PIXI.Point(humanPlayer.position.x * tileDim, humanPlayer.position.y * tileDim),
      scale: 1.5,
    });
  }, [humanPlayerId]);

  return (
    <PixiViewport
      app={pixiApp}
      screenWidth={props.width}
      screenHeight={props.height}
      worldWidth={width * tileDim}
      worldHeight={height * tileDim}
      viewportRef={viewportRef}
    >
      <PixiStaticMap
        map={props.game.worldMap}
        onpointerup={onMapPointerUp}
        onpointerdown={onMapPointerDown}
      />
      <MailboxLayer count={mailboxCount} tileDim={tileDim} />
      {props.onOpenCinema && <CinemaHotspot tileDim={tileDim} onOpenCinema={props.onOpenCinema} />}
      {props.onOpenArtStudio && (
        <ArtStudioHotspot tileDim={tileDim} onOpenArtStudio={props.onOpenArtStudio} />
      )}
      {props.onOpenGarden && <GardenHotspot tileDim={tileDim} onOpenGarden={props.onOpenGarden} />}
      {players.map(
        (p) =>
          // Only show the path for the human player in non-debug mode.
          (SHOW_DEBUG_UI || p.id === humanPlayerId) && (
            <DebugPath key={`path-${p.id}`} player={p} tileDim={tileDim} />
          ),
      )}
      {lastDestination && <PositionIndicator destination={lastDestination} tileDim={tileDim} />}
      {players.map((p) => (
        <Player
          key={`player-${p.id}`}
          game={props.game}
          player={p}
          isViewer={p.id === humanPlayerId}
          onClick={props.setSelectedElement}
          historicalTime={props.historicalTime}
        />
      ))}
    </PixiViewport>
  );
};
export default PixiGame;
