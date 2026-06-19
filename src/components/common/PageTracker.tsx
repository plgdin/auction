import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { logUserActivity } from '../../services/auditService';

export function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    // Scroll to top of the page on route change
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Log the page view action
    logUserActivity('page_view', 'page', undefined, {
      pathname: location.pathname,
      search: location.search
    });
  }, [location.pathname, location.search]);

  return null;
}
