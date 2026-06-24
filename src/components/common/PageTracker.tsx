import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    // Scroll to top of the page on route change
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Dynamic SEO Titles & Meta Descriptions
    let title = 'Lelam | MSTC eAuctions Bidding Assistant & Analytics';
    let description = 'Lelam is an advanced bidding assistant and analytics platform for MSTC eAuctions, offering asset valuation, cost calculations, and procurement tools.';

    const path = location.pathname;
    if (path === '/') {
      title = 'Lelam | MSTC eAuctions Bidding Assistant & Analytics';
    } else if (path.startsWith('/auctions/')) {
      const parts = path.split('/');
      const auctionId = parts[2] || '';
      title = `Auction ${auctionId} Details | Lelam`;
      description = `View details, bidding status, EMD rates, and document requirements for MSTC auction ${auctionId}.`;
    } else if (path === '/auctions') {
      title = 'MSTC eAuction Catalog | Lelam';
      description = 'Browse active MSTC catalogs, scrap steel, vehicle auctions, and non-ferrous listings on Lelam Bidding Assistant.';
    } else if (path === '/news') {
      title = 'Scrap Industry Market Trends & News | Lelam';
      description = 'Get the latest market prices, macroeconomic indicators, LME steel scrap indexes, and industry news on Lelam.';
    } else if (path === '/faq') {
      title = 'Frequently Asked Questions | Lelam';
      description = 'Find answers to common questions about MSTC eAuctions, pre-bid deposits, EMD refund procedures, and the Lelam tool.';
    } else if (path === '/about') {
      title = 'About Lelam | B2B Auction Analytics';
      description = 'Learn about our team, technology stack, and machine learning models designed to simplify B2B scrap procurement.';
    } else if (path === '/contact') {
      title = 'Contact Support & Helpdesk | Lelam';
      description = 'Reach out to the Lelam support team for help with your auction analytics account, billing, or custom valuation reports.';
    } else if (path === '/privacy') {
      title = 'Privacy Policy | Lelam';
    } else if (path === '/terms') {
      title = 'Terms of Service | Lelam';
    } else if (path === '/cookies') {
      title = 'Cookie Policy | Lelam';
    } else if (path.startsWith('/dashboard')) {
      if (path === '/dashboard/bids') {
        title = 'My Active & Won Bids | Lelam';
      } else if (path === '/dashboard/interested') {
        title = 'My Watchlist | Lelam';
      } else if (path === '/dashboard/documents') {
        title = 'Document Vault & Compliance | Lelam';
      } else if (path === '/dashboard/quotes') {
        title = 'Bidding Quote Builder | Lelam';
      } else if (path === '/dashboard/profile') {
        title = 'Account Settings | Lelam';
      } else if (path === '/dashboard/inventory') {
        title = 'Inventory Checklists | Lelam';
      } else if (path === '/dashboard/vendors') {
        title = 'Personal Vendors | Lelam';
      } else if (path === '/dashboard/reminders') {
        title = 'Reminders & Calendar | Lelam';
      } else {
        title = 'User Dashboard | Lelam';
      }
      description = 'Access your personal B2B auction bidding workspace, won listings, and custom document vault.';
    } else if (path.startsWith('/admin')) {
      title = 'System Administration | Lelam';
    } else if (path.startsWith('/seller')) {
      title = 'Seller Portal | Lelam';
    }

    document.title = title;

    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', description);
    }

    // Log the page view action (lazy-loaded to avoid pulling supabase into initial bundle)
    import('../../services/auditService').then(({ logUserActivity }) => {
      logUserActivity('page_view', 'page', undefined, {
        pathname: location.pathname,
        search: location.search
      });
    }).catch(() => {
      // Non-critical — silently fail
    });
  }, [location.pathname, location.search]);

  return null;
}
