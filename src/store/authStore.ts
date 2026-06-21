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

    // Support mockAdmin query param or localStorage bypass for testing admin features
    const isMock = typeof window !== 'undefined' && (
      localStorage.getItem('lelam_mock_admin') === 'true' || 
      window.location.search.includes('mockAdmin=true')
    );

    if (isMock) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('lelam_mock_admin', 'true');
      }
      const mockProfile: Profile = {
        id: 'mock-admin-id',
        first_name: 'Mock',
        last_name: 'Admin',
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        phone: undefined,
        organization_id: undefined,
        is_active: true
      };
      set({
        session: { user: { id: 'mock-admin-id', email: 'admin@lelam.com' } },
        user: { id: 'mock-admin-id', email: 'admin@lelam.com' },
        profile: mockProfile,
        isAuthenticated: true,
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
      // If mock admin is active, ignore Supabase auth state change
      const currentIsMock = typeof window !== 'undefined' && localStorage.getItem('lelam_mock_admin') === 'true';
      if (currentIsMock) return;

      // On TOKEN_REFRESHED, avoid re-setting state if the user hasn't actually changed
      // This prevents unnecessary re-renders across all components that depend on `user`
      if (_event === 'TOKEN_REFRESHED') {
        const currentUserId = get().user?.id;
        const newUserId = session?.user?.id;
        if (currentUserId === newUserId) {
          // Silently update the session token in store without triggering user object change
          set({ session });
          return;
        }
      }

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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lelam_mock_admin');
    }
    try {
      await authService.signOut();
    } catch (e) {
      // Ignore auth error on sign out
    }
    set({ user: null, session: null, profile: null, isAuthenticated: false, isLoading: false });
  },
}));
