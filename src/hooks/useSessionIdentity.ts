import { useState } from 'react';

const SESSION_ID_KEY = 'xishan-town-session-id';
const PLAYER_NAME_KEY = 'xishan-town-player-name';

export type SessionIdentity = {
  sessionId: string;
  playerName: string;
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

function readSessionIdentity(): SessionIdentity {
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

  return { sessionId, playerName };
}

export function useSessionIdentity() {
  const [identity] = useState(readSessionIdentity);
  return identity;
}
