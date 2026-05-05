import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

import type { AuthUser } from '../api/auth';

const storage = createMMKV({ id: 'kkumdream-auth' });
const SESSION_KEY = 'session';

type PersistedSession = {
  token: string;
  userId: string;
  user: AuthUser;
};

function readPersistedSession(): PersistedSession | null {
  const raw = storage.getString(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PersistedSession;
  } catch {
    storage.remove(SESSION_KEY);
    return null;
  }
}

function writePersistedSession(session: PersistedSession) {
  storage.set(SESSION_KEY, JSON.stringify(session));
}

const persistedSession = readPersistedSession();

type SessionState = {
  token: string | null;
  userId: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setSession: (token: string, user: AuthUser) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>(set => ({
  token: persistedSession?.token ?? null,
  userId: persistedSession?.userId ?? null,
  user: persistedSession?.user ?? null,
  isAuthenticated: persistedSession !== null,
  setSession: (token, user) => {
    writePersistedSession({ token, userId: user.id, user });
    set({ token, userId: user.id, user, isAuthenticated: true });
  },
  clearSession: () => {
    storage.remove(SESSION_KEY);
    set({ token: null, userId: null, user: null, isAuthenticated: false });
  },
}));
