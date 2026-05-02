import { create } from 'zustand';

type SessionState = {
  token: string | null;
  userId: string | null;
  setSession: (token: string, userId: string) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>(set => ({
  token: null,
  userId: null,
  setSession: (token, userId) => set({ token, userId }),
  clearSession: () => set({ token: null, userId: null }),
}));

