import { create } from 'zustand';
import { dashboardService } from '../services/dashboardService';
import { toast } from 'react-hot-toast';

interface AppState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  currency: string;
  currencyRates: Record<string, number>;
  activeAdminTab: string;
  interestedMstcIds: string[];
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setCurrency: (currency: string) => void;
  setCurrencyRates: (rates: Record<string, number>) => void;
  setActiveAdminTab: (tab: string) => void;
  fetchInterestedMstcIds: (userId: string) => void;
  toggleInterestedMstcId: (userId: string, itemId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'light',
  sidebarOpen: false,
  currency: 'INR',
  currencyRates: { USD: 0.010056, EUR: 0.00922, GBP: 0.00799 },
  activeAdminTab: 'overview',
  interestedMstcIds: [],
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
  setCurrency: (currency) => set({ currency }),
  setCurrencyRates: (rates) => set({ currencyRates: rates }),
  setActiveAdminTab: (tab) => set({ activeAdminTab: tab }),
  fetchInterestedMstcIds: (userId) => {
    if (!userId) {
      set({ interestedMstcIds: [] });
      return;
    }
    const ids = dashboardService.getInterestedAuctions(userId);
    set({ interestedMstcIds: ids });
  },
  toggleInterestedMstcId: (userId, itemId) => {
    if (!userId) return;
    const isAdded = dashboardService.toggleInterestedAuction(userId, itemId);
    const ids = dashboardService.getInterestedAuctions(userId);
    set({ interestedMstcIds: ids });

    if (isAdded) {
      toast.success('Added to interested auctions!', {
        icon: '❤️',
        style: {
          borderRadius: '10px',
          background: '#0f172a',
          color: '#fff',
        },
      });
    } else {
      toast.success('Removed from interested auctions.', {
        icon: '💔',
        style: {
          borderRadius: '10px',
          background: '#0f172a',
          color: '#fff',
        },
      });
    }
  },
}));

