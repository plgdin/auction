import { lazy, Suspense, useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { router } from './router';
import { useAuthStore } from './store/authStore';
import { useAppStore } from './store/appStore';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const Chatbox = lazy(() => import('./components/common/Chatbox').then(m => ({ default: m.Chatbox })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const { initializeAuth, user } = useAuthStore();
  const { setCurrencyRates, fetchInterestedMstcIds } = useAppStore();
  const [showChatbot, setShowChatbot] = useState(false);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (user) {
      fetchInterestedMstcIds(user.id);
    } else {
      fetchInterestedMstcIds('');
    }
  }, [user, fetchInterestedMstcIds]);

  // Delay chatbot mount until after initial paint to prevent flash of the orb
  useEffect(() => {
    const timer = setTimeout(() => setShowChatbot(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    import('./utils/currency').then(({ fetchLatestRates }) => {
      fetchLatestRates()
        .then((rates) => {
          if (rates) {
            setCurrencyRates(rates);
          }
        })
        .catch((err) => console.warn('Dynamic exchange rate fetch failed:', err));
    });
  }, [initializeAuth, setCurrencyRates]);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} />
        {showChatbot && (
          <Suspense fallback={null}>
            <Chatbox />
          </Suspense>
        )}
        <Toaster
          position="top-right"
          containerClassName="print:hidden"
          toastOptions={{
            className: "print:hidden",
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
