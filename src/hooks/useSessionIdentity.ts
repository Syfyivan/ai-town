import { useCallback, useEffect, useState } from 'react';
import {
  getCharacterAppearance,
  randomCharacterName,
  selectCharacterNameFromSeed,
} from '../../data/characters';

const SESSION_ID_KEY = 'xishan-town-session-id';
const PLAYER_NAME_KEY = 'xishan-town-player-name';
const PLAYER_CHARACTER_KEY = 'xishan-town-player-character';
const SESSION_IDENTITY_EVENT = 'xishan-town-session-identity-updated';

export type SessionIdentity = {
  sessionId: string;
  playerName: string;
  playerCharacter: string;
  setPlayerCharacter: (character: string) => void;
  randomizePlayerCharacter: () => void;
};

type StoredSessionIdentity = {
  sessionId: string;
  playerName: string;
  playerCharacter: string;
};

function randomSessionId() {
  if ('crypto' in window && 'randomUUID' in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function defaultPlayerName(sessionId: string) {
  const suffix = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  return `画友${suffix || '0000'}`;
}

function dispatchSessionIdentityUpdate() {
  window.dispatchEvent(new Event(SESSION_IDENTITY_EVENT));
}

function readStoredSessionIdentity(): StoredSessionIdentity {
  let sessionId = window.localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = randomSessionId();
    window.localStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  let playerName = window.localStorage.getItem(PLAYER_NAME_KEY);
  if (!playerName) {
    playerName = defaultPlayerName(sessionId);
    window.localStorage.setItem(PLAYER_NAME_KEY, playerName);
  }

  let playerCharacter = window.localStorage.getItem(PLAYER_CHARACTER_KEY);
  if (!playerCharacter || !getCharacterAppearance(playerCharacter)) {
    playerCharacter = selectCharacterNameFromSeed(sessionId);
    window.localStorage.setItem(PLAYER_CHARACTER_KEY, playerCharacter);
  }

  return { sessionId, playerName, playerCharacter };
}

export function useSessionIdentity() {
  const [identity, setIdentity] = useState(readStoredSessionIdentity);

  useEffect(() => {
    const refreshIdentity = () => setIdentity(readStoredSessionIdentity());
    window.addEventListener(SESSION_IDENTITY_EVENT, refreshIdentity);
    window.addEventListener('storage', refreshIdentity);
    return () => {
      window.removeEventListener(SESSION_IDENTITY_EVENT, refreshIdentity);
      window.removeEventListener('storage', refreshIdentity);
    };
  }, []);

  const setPlayerCharacter = useCallback((character: string) => {
    if (!getCharacterAppearance(character)) {
      return;
    }
    window.localStorage.setItem(PLAYER_CHARACTER_KEY, character);
    setIdentity(readStoredSessionIdentity());
    dispatchSessionIdentityUpdate();
  }, []);

  const randomizePlayerCharacter = useCallback(() => {
    setPlayerCharacter(randomCharacterName());
  }, [setPlayerCharacter]);

  return { ...identity, setPlayerCharacter, randomizePlayerCharacter };
}
