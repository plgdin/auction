import { create } from 'zustand';

interface AppState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  currency: string;
  currencyRates: Record<string, number>;
  activeAdminTab: string;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setCurrency: (currency: string) => void;
  setCurrencyRates: (rates: Record<string, number>) => void;
  setActiveAdminTab: (tab: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'light',
  sidebarOpen: false,
  currency: 'INR',
  currencyRates: { USD: 0.010056, EUR: 0.00922, GBP: 0.00799 },
  activeAdminTab: 'overview',
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
  setCurrency: (currency) => set({ currency }),
  setCurrencyRates: (rates) => set({ currencyRates: rates }),
  setActiveAdminTab: (tab) => set({ activeAdminTab: tab }),
}));
