import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { router } from './router';
import { useAuthStore } from './store/authStore';
import { useAppStore } from './store/appStore';
import { fetchLatestRates } from './utils/currency';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { embeddingService } from './services/embeddingService';
import { MstcSearchService } from './services/publicService';
import { auctionService } from './services/auctionService';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const { initializeAuth } = useAuthStore();
  const { setCurrencyRates } = useAppStore();

  useEffect(() => {
    initializeAuth();
    
    // Fetch latest currency rates dynamically on load
    fetchLatestRates()
      .then((rates) => {
        if (rates) {
          setCurrencyRates(rates);
        }
      })
      .catch((err) => console.warn('Dynamic exchange rate fetch failed:', err));
    
    // Background pre-warming and pre-fetching to guarantee < 1s loading times
    embeddingService.prewarmModel().catch(err => console.warn('Pre-warming model failed:', err));
    MstcSearchService.getMstcFilterOptions().catch(err => console.warn('Pre-fetching filter options failed:', err));
    auctionService.getCategories().catch(err => console.warn('Pre-fetching categories failed:', err));
  }, [initializeAuth, setCurrencyRates]);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} />
        <Toaster 
          position="top-right" 
          toastOptions={{
            duration: 3000,
            success: {
              iconTheme: {
                primary: '#0284c7', // Matches primary theme color
                secondary: '#ffffff',
              },
              style: {
                borderRadius: '16px',
                background: '#ffffff',
                color: '#1e293b',
                fontWeight: '600',
                fontSize: '13px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                border: '1px solid #e2e8f0',
                padding: '12px 16px',
              }
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#ffffff',
              },
              style: {
                borderRadius: '16px',
                background: '#ffffff',
                color: '#1e293b',
                fontWeight: '600',
                fontSize: '13px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                border: '1px solid #fca5a5',
                padding: '12px 16px',
              }
            }
          }}
        />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
