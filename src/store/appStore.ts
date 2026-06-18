import { create } from 'zustand';

interface AppState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  currency: string;
  activeAdminTab: string;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setCurrency: (currency: string) => void;
  setActiveAdminTab: (tab: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'light',
  sidebarOpen: false,
  currency: 'INR',
  activeAdminTab: 'overview',
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
  setCurrency: (currency) => set({ currency }),
  setActiveAdminTab: (tab) => set({ activeAdminTab: tab }),
}));
