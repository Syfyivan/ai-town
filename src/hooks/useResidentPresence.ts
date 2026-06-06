import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useServerGame } from './serverGame';
import { useSessionIdentity } from './useSessionIdentity';

export function useResidentPresence() {
  const identity = useSessionIdentity();
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const game = useServerGame(worldId);
  const humanTokenIdentifier = useQuery(
    api.world.userStatus,
    worldId ? { worldId, sessionId: identity.sessionId } : 'skip',
  );
  const humanPlayerId =
    game && humanTokenIdentifier
      ? [...game.world.players.values()].find((player) => player.human === humanTokenIdentifier)?.id
      : undefined;

  return {
    game,
    humanPlayerId,
    isResident: humanPlayerId !== undefined,
    worldId,
  };
}
