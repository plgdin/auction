import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { router } from './router';
import { useAuthStore } from './store/authStore';
import { useAppStore } from './store/appStore';
import { ErrorBoundary } from './components/common/ErrorBoundary';

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

    // Fetch latest currency rates dynamically on load (lazy-imported to reduce TBT)
    import('./utils/currency').then(({ fetchLatestRates }) => {
      fetchLatestRates()
        .then((rates) => {
          if (rates) {
            setCurrencyRates(rates);
          }
        })
        .catch((err) => console.warn('Dynamic exchange rate fetch failed:', err));
    });

    // Heavy embedding model pre-warming has been removed from App initialization.
    // It will be lazy-loaded on-demand during the first semantic search to prevent 
    // massive Total Blocking Time (TBT) penalties during Lighthouse performance tests.

    // Lazy load the pre-fetching to keep initial load lightweight
    const prefetchTimer = setTimeout(async () => {
      try {
        const { MstcSearchService } = await import('./services/publicService');
        const { auctionService } = await import('./services/auctionService');
        MstcSearchService.getMstcFilterOptions().catch(err => console.warn('Pre-fetching filter options failed:', err));
        auctionService.getCategories().catch(err => console.warn('Pre-fetching categories failed:', err));
      } catch (e) {
        console.warn('Failed to load search/auction services dynamically:', e);
      }
    }, 5000);

    return () => {
      clearTimeout(prefetchTimer);
    };
  }, [initializeAuth, setCurrencyRates]);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} />
        <Toaster
          position="top-right"
          containerClassName="print:hidden"
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
