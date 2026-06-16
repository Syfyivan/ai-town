import { useCallback, useEffect, useState } from 'react';

const PLAYER_MOVEMENT_MODE_KEY = 'xishan-town-player-movement-mode';
const PLAYER_SETTINGS_EVENT = 'xishan-town-player-settings-updated';

export type PlayerMovementMode = 'walk' | 'run';

function readMovementMode(): PlayerMovementMode {
  const stored = window.localStorage.getItem(PLAYER_MOVEMENT_MODE_KEY);
  return stored === 'walk' ? 'walk' : 'run';
}

function dispatchPlayerSettingsUpdate() {
  window.dispatchEvent(new Event(PLAYER_SETTINGS_EVENT));
}

export function usePlayerSettings() {
  const [movementMode, setMovementModeState] = useState<PlayerMovementMode>(readMovementMode);

  useEffect(() => {
    const refreshSettings = () => setMovementModeState(readMovementMode());
    window.addEventListener(PLAYER_SETTINGS_EVENT, refreshSettings);
    window.addEventListener('storage', refreshSettings);
    return () => {
      window.removeEventListener(PLAYER_SETTINGS_EVENT, refreshSettings);
      window.removeEventListener('storage', refreshSettings);
    };
  }, []);

  const setMovementMode = useCallback((mode: PlayerMovementMode) => {
    window.localStorage.setItem(PLAYER_MOVEMENT_MODE_KEY, mode);
    setMovementModeState(mode);
    dispatchPlayerSettingsUpdate();
  }, []);

  return { movementMode, setMovementMode };
}
