import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { logUserActivity } from '../../services/auditService';

export function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    // Log the page view action
    logUserActivity('page_view', 'page', undefined, {
      pathname: location.pathname,
      search: location.search
    });
  }, [location.pathname, location.search]);

  return null;
}
