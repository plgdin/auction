import { create } from 'zustand';
import type { Profile } from '../types/database.types';

const getAuthDependencies = () => Promise.all([
  import('../lib/supabase'),
  import('../services/authService'),
]);

interface AuthState {
  user: any | null; // Supabase auth.user
  session: any | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  setSession: (session: any | null) => void;
  setProfile: (profile: Profile | null) => void;
  initializeAuth: () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isAuthenticated: false,
  isLoading: true,
  isInitialized: false,

  setSession: (session) => {
    set({
      session,
      user: session?.user || null,
      isAuthenticated: !!session,
      profile: session ? get().profile : null
    });
  },

  setProfile: (profile) => set({ profile }),

  initializeAuth: () => {
    if (get().isInitialized) return;
    set({ isInitialized: true }); // Prevent strict mode double execution

    // Fallback timeout to prevent infinite loading screen if Supabase hangs (common on first load/incognito)
    const timeoutId = setTimeout(() => {
      if (get().isLoading) {
        console.warn('Supabase auth initialization timed out. Unlocking UI.');
        set({ isLoading: false });
      }
    }, 3000);

    getAuthDependencies().then(([{ supabase }, { authService }]) => {
      // Initial session check
      supabase.auth.getSession().then(({ data: { session } }) => {
        clearTimeout(timeoutId);
        if (session) {
          get().setSession(session);
          authService.getProfile(session.user.id).then((profile) => {
            set({ profile, isLoading: false });
          });
        } else {
          set({ isLoading: false });
        }
      }).catch((err) => {
        clearTimeout(timeoutId);
        console.error('Session check failed:', err);
        set({ isLoading: false });
      });

      // Listen to auth changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        const currentSession = get().session;
        const currentProfile = get().profile;

        if (session && currentSession?.access_token === session.access_token && currentProfile) {
          set({ isLoading: false });
          return;
        }

        get().setSession(session);

        if (session?.user) {
          const profile = await authService.getProfile(session.user.id);
          set({ profile, isLoading: false });
        } else {
          set({ profile: null, isLoading: false });
        }
      });
    }).catch((err) => {
      clearTimeout(timeoutId);
      console.error('Session dependencies failed:', err);
      set({ isLoading: false });
    });
  },

  logout: async () => {
    const user = get().user;
    const userId = user?.id;

    set({ isLoading: true });

    try {
      const [, { authService }] = await getAuthDependencies();
      await authService.signOut();
    } catch {
      // Ignore auth error on sign out
    }

    // 1. Reset Quote Store to clear drafts and quotes
    try {
      const { useQuoteStore } = await import('./quoteStore');
      useQuoteStore.getState().resetQuoteStore();
    } catch (err) {
      console.error('Failed to reset quote store on logout:', err);
    }

    // 2. Clear all user namespaced localStorage keys (usr_*_userId)
    if (userId) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('usr_') && key.endsWith(`_${userId}`)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (err) {
        console.error('Failed to clean user localStorage keys:', err);
      }
    }

    set({ user: null, session: null, profile: null, isAuthenticated: false, isLoading: false });
  },
}));
