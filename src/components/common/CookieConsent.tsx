import { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';

export function CookieConsent() {
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      // Small delay for clean entrance animation
      const timer = setTimeout(() => {
        setShowConsent(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setShowConsent(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined');
    setShowConsent(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('cookie-consent', 'dismissed');
    setShowConsent(false);
  };

  if (!showConsent) return null;

  return (
    <div className="fixed bottom-6 right-6 z-55 max-w-sm w-full bg-card border border-border rounded-xl shadow-xl animate-fade-in p-5 print:hidden">
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-primary/10 text-primary rounded-lg shrink-0">
          <Cookie className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground">
              Cookie Preferences
            </h4>
            <button 
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            We use cookies to analyze site traffic, personalize content, and enhance your user experience.
          </p>
          <div className="flex gap-2.5 mt-4">
            <button
              onClick={handleDecline}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-border text-xs font-bold rounded-lg bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-xs font-bold rounded-lg text-primary-foreground bg-primary hover:bg-primary/95 transition-colors cursor-pointer"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
