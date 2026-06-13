import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { authService } from '../services/authService';
import type { Profile } from '../types/database.types';

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
    const isMock = !!localStorage.getItem('mock_session');
    set({
      session,
      user: session?.user || null,
      isAuthenticated: !!session,
      profile: isMock && session?.user ? {
        id: session.user.id,
        first_name: session.user.email === 'test@mail.com' ? 'Test' : 'Temp',
        last_name: 'User',
        role: 'buyer',
        is_active: true
      } as any : (session ? get().profile : null)
    });
  },

  setProfile: (profile) => set({ profile }),

  initializeAuth: () => {
    if (get().isInitialized) return;

    const mockSessionStr = localStorage.getItem('mock_session');
    if (mockSessionStr) {
      const session = JSON.parse(mockSessionStr);
      set({ 
        session, 
        user: session.user, 
        isAuthenticated: true, 
        profile: { 
          id: session.user.id, 
          first_name: session.user.email === 'test@mail.com' ? 'Test' : 'Temp', 
          last_name: 'User', 
          role: 'buyer', 
          is_active: true 
        } as any, 
        isLoading: false, 
        isInitialized: true 
      });
      return;
    }

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        get().setSession(session);
        authService.getProfile(session.user.id).then((profile) => {
          set({ profile, isLoading: false, isInitialized: true });
        });
      } else {
        set({ isLoading: false, isInitialized: true });
      }
    });

    // Listen to auth changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (localStorage.getItem('mock_session')) return;
      get().setSession(session);
      
      if (session?.user) {
        const profile = await authService.getProfile(session.user.id);
        set({ profile, isLoading: false });
      } else {
        set({ profile: null, isLoading: false });
      }
    });
  },

  logout: async () => {
    set({ isLoading: true });
    localStorage.removeItem('mock_session');
    try {
      await authService.signOut();
    } catch (e) {
      // Ignore auth error on sign out
    }
    set({ user: null, session: null, profile: null, isAuthenticated: false, isLoading: false });
  },
}));
