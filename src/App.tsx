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
  const { initializeAuth, user, profile } = useAuthStore();
  const { setCurrencyRates, fetchInterestedMstcIds } = useAppStore();
  const [showChatbot, setShowChatbot] = useState(false);

  useEffect(() => {
    const startAuth = () => initializeAuth();

    // Home does not need account state to paint. Let hero content win the
    // first network and main-thread window, while app routes initialize now.
    if (window.location.pathname === '/') {
      const timer = window.setTimeout(startAuth, 1000);
      return () => clearTimeout(timer);
    }

    startAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (user) {
      fetchInterestedMstcIds(user.id);
    } else {
      fetchInterestedMstcIds('');
    }
  }, [user, fetchInterestedMstcIds]);

  // Subscription expiry check (1 week prior warning)
  useEffect(() => {
    async function checkSubscriptionRenewal() {
      if (!user || !profile || !profile.subscription_expires_at) return;
      if (profile.subscription_plan === 'explorer') return;

      const expiryDate = new Date(profile.subscription_expires_at);
      const diffMs = expiryDate.getTime() - Date.now();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // 7 days or less
      if (diffDays > 0 && diffDays <= 7) {
        const lastNotifiedKey = `lelam_expiry_notified_${user.id}_${profile.subscription_expires_at}`;
        if (localStorage.getItem(lastNotifiedKey)) return;

        const { adminService } = await import('./services/adminService');
        const notif = await adminService.sendNotification({
          user_id: user.id,
          title: 'Subscription Expiration Warning',
          message: `Your ${profile.subscription_plan === 'pro' ? 'Business' : 'Individual'} plan is renewing/expiring in ${diffDays} days on ${expiryDate.toLocaleDateString()}. Please make sure your billing details are correct.`,
          is_read: false
        });

        if (notif) {
          localStorage.setItem(lastNotifiedKey, 'true');
        }
      }
    }
    checkSubscriptionRenewal();
  }, [user, profile]);

  // Load chatbot only on first user interaction to achieve 0ms TBT on automated page loads
  useEffect(() => {
    let loaded = false;
    const loadChatbot = () => {
      if (loaded) return;
      loaded = true;
      setShowChatbot(true);
      
      // Clean up event listeners
      window.removeEventListener('mousemove', loadChatbot);
      window.removeEventListener('scroll', loadChatbot);
      window.removeEventListener('keydown', loadChatbot);
      window.removeEventListener('touchstart', loadChatbot);
    };

    window.addEventListener('mousemove', loadChatbot, { passive: true });
    window.addEventListener('scroll', loadChatbot, { passive: true });
    window.addEventListener('keydown', loadChatbot, { passive: true });
    window.addEventListener('touchstart', loadChatbot, { passive: true });

    return () => {
      window.removeEventListener('mousemove', loadChatbot);
      window.removeEventListener('scroll', loadChatbot);
      window.removeEventListener('keydown', loadChatbot);
      window.removeEventListener('touchstart', loadChatbot);
    };
  }, []);

  useEffect(() => {
    const loadRates = () => {
      import('./utils/currency').then(({ fetchLatestRates }) => {
        fetchLatestRates()
          .then((rates) => {
            if (rates) {
              setCurrencyRates(rates);
            }
          })
          .catch((err) => console.warn('Dynamic exchange rate fetch failed:', err));
      });
    };

    const timer = window.setTimeout(loadRates, 2500);
    return () => clearTimeout(timer);
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
