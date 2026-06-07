import { useRef, useState } from 'react';
import PixiGame from './PixiGame.tsx';

import { useElementSize } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import PlayerDetails from './PlayerDetails.tsx';
import { api } from '../../convex/_generated/api';
import { useWorldHeartbeat } from '../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../hooks/useHistoricalTime.ts';
import { DebugTimeManager } from './DebugTimeManager.tsx';
import { GameId } from '../../convex/aiTown/ids.ts';
import { useServerGame } from '../hooks/serverGame.ts';
import type { ProfessionId } from './professionCatalog.ts';

export const SHOW_DEBUG_UI = !!import.meta.env.VITE_SHOW_DEBUG_UI;

export default function Game(props: {
  immersive?: boolean;
  onOpenCinema?: () => void;
  onOpenArtStudio?: () => void;
  onOpenGarden?: () => void;
  onOpenProfession?: (profession: ProfessionId) => void;
}) {
  const convex = useConvex();
  const [selectedElement, setSelectedElement] = useState<{
    kind: 'player';
    id: GameId<'players'>;
  }>();
  const [gameWrapperRef, { width, height }] = useElementSize();

  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const engineId = worldStatus?.engineId;

  const game = useServerGame(worldId);

  // Send a periodic heartbeat to our world to keep it alive.
  useWorldHeartbeat();

  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);

  const scrollViewRef = useRef<HTMLDivElement>(null);

  if (!worldId || !engineId || !game) {
    return null;
  }
  const frameClass = props.immersive
    ? 'town-game-frame town-game-frame-immersive town-game-frame-fullscreen'
    : 'town-game-frame game-frame';
  return (
    <>
      {SHOW_DEBUG_UI && <DebugTimeManager timeManager={timeManager} width={200} height={100} />}
      <div className={frameClass}>
        {/* Game area */}
        <div className="relative overflow-hidden bg-brown-900" ref={gameWrapperRef}>
          <div className="absolute inset-0">
            <div className="town-stage-container">
              <Stage width={width} height={height} options={{ backgroundColor: 0x7ab5ff }}>
                {/* Re-propagate context because contexts are not shared between renderers.
https://github.com/michalochman/react-pixi-fiber/issues/145#issuecomment-531549215 */}
                <ConvexProvider client={convex}>
                  <PixiGame
                    game={game}
                    worldId={worldId}
                    engineId={engineId}
                    width={width}
                    height={height}
                    historicalTime={historicalTime}
                    onOpenCinema={props.onOpenCinema}
                    onOpenArtStudio={props.onOpenArtStudio}
                    onOpenGarden={props.onOpenGarden}
                    onOpenProfession={props.onOpenProfession}
                    setSelectedElement={setSelectedElement}
                  />
                </ConvexProvider>
              </Stage>
            </div>
          </div>
        </div>
        {/* Right column area */}
        {!props.immersive && (
          <div className="town-side-panel" ref={scrollViewRef}>
            <PlayerDetails
              worldId={worldId}
              engineId={engineId}
              game={game}
              playerId={selectedElement?.id}
              setSelectedElement={setSelectedElement}
              scrollViewRef={scrollViewRef}
            />
          </div>
        )}
        {props.immersive && selectedElement && (
          <div className="town-floating-details" ref={scrollViewRef}>
            <PlayerDetails
              worldId={worldId}
              engineId={engineId}
              game={game}
              playerId={selectedElement.id}
              setSelectedElement={setSelectedElement}
              scrollViewRef={scrollViewRef}
            />
          </div>
        )}
      </div>
    </>
  );
}
