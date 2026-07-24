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
  const [isMobile, setIsMobile] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
  }, [initializeAuth, setCurrencyRates]);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-card/80 backdrop-blur-md border border-border/50 rounded-3xl p-8 text-center shadow-2xl">
          <div className="inline-flex p-4 bg-primary/10 rounded-full text-primary mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="3" rx="2" />
              <line x1="8" x2="16" y1="21" y2="21" />
              <line x1="12" x2="12" y1="17" y2="21" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Desktop View Required</h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Mobile view is not available. Please access this platform from a desktop.
          </p>

        </div>
      </div>
    );
  }

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
