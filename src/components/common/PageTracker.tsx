import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function updateMetaTag(propertyOrName: { name?: string; property?: string }, content: string) {
  const selector = propertyOrName.name
    ? `meta[name="${propertyOrName.name}"]`
    : `meta[property="${propertyOrName.property}"]`;
  
  let element = document.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    if (propertyOrName.name) element.setAttribute('name', propertyOrName.name);
    if (propertyOrName.property) element.setAttribute('property', propertyOrName.property);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    // Scroll to top of the page on route change
    window.scrollTo({ top: 0, behavior: 'instant' });

    let title = 'MSTC eAuctions & Scrap Bidding Analytics | Lelam';
    let description = 'Lelam (www.lelam.co) is India\'s leading B2B eAuction intelligence and scrap metal analytics platform for MSTC, Railways & Defence PSUs. Automatically calculate total landed costs (GST 18%, TCS 1%, loading & freight), forecast scrap prices via LME benchmarks, track EMD deposits, build quotes, and manage compliance.';
    let keywords = 'Lelam, Lelam.co, MSTC eAuctions, Indian eAuctions, scrap metal bidding, landed cost calculator, eAuction analytics, scrap price valuation, LME scrap metal, MSTC bidding assistant, HMS 1 scrap price, EMD tracking, CPCB license';
    let isPublic = true;
    const path = location.pathname;

    // Breadcrumbs list for JSON-LD schema
    const breadcrumbs: { name: string; item: string }[] = [{ name: 'Home', item: 'https://www.lelam.co/' }];

    if (path === '/') {
      title = 'Lelam | MSTC eAuctions Bidding Assistant & Analytics';
    } else if (path.startsWith('/auctions/')) {
      const parts = path.split('/');
      const auctionId = parts[2] || '';
      title = `Auction ${auctionId} Details | Lelam`;
      description = `View details, bidding status, landed costs, EMD rates, and document requirements for MSTC auction ${auctionId}.`;
      breadcrumbs.push(
        { name: 'Auctions Catalog', item: 'https://www.lelam.co/auctions' },
        { name: `Auction ${auctionId}`, item: `https://www.lelam.co/auctions/${auctionId}` }
      );
    } else if (path === '/auctions') {
      title = 'MSTC eAuction Catalog | Lelam';
      description = 'Browse active MSTC catalogs, scrap steel, vehicle auctions, and non-ferrous metal listings on Lelam Bidding Assistant.';
      breadcrumbs.push({ name: 'Auctions Catalog', item: 'https://www.lelam.co/auctions' });
    } else if (path === '/quotes') {
      title = 'Bidding Landed Cost & Quote Builder | Lelam';
      description = 'Calculate landed auction costs including GST, TCS, Customs duties, loading fees, and projected ROI margins.';
      breadcrumbs.push({ name: 'Quotes Builder', item: 'https://www.lelam.co/quotes' });
    } else if (path === '/news') {
      title = 'Scrap Industry Market Trends & News | Lelam';
      description = 'Get the latest market prices, macroeconomic indicators, LME steel scrap indexes, and industry news on Lelam.';
      breadcrumbs.push({ name: 'News & Trends', item: 'https://www.lelam.co/news' });
    } else if (path === '/notices') {
      title = 'Official eAuction Notices & Updates | Lelam';
      description = 'Read official government eAuction updates, seller depot notices, and regulatory guidelines for MSTC auctions.';
      breadcrumbs.push({ name: 'Notices', item: 'https://www.lelam.co/notices' });
    } else if (path === '/faq') {
      title = 'Frequently Asked Questions | Lelam';
      description = 'Find answers to common questions about MSTC eAuctions, pre-bid deposits, EMD refund procedures, and the Lelam tool.';
      breadcrumbs.push({ name: 'FAQ', item: 'https://www.lelam.co/faq' });
    } else if (path === '/about') {
      title = 'About Lelam | B2B Auction Analytics';
      description = 'Learn about our team, technology stack, and machine learning models designed to simplify B2B scrap procurement.';
      breadcrumbs.push({ name: 'About Us', item: 'https://www.lelam.co/about' });
    } else if (path === '/contact') {
      title = 'Contact Support & Helpdesk | Lelam';
      description = 'Reach out to the Lelam support team for help with your auction analytics account, billing, or custom valuation reports.';
      breadcrumbs.push({ name: 'Contact Us', item: 'https://www.lelam.co/contact' });
    } else if (path.startsWith('/blog/')) {
      title = 'Blog Article | Lelam Insights';
      description = 'Read in-depth guides, strategies, and scrap procurement tips for MSTC eAuctions on Lelam.';
      breadcrumbs.push(
        { name: 'Blog', item: 'https://www.lelam.co/blog' },
        { name: 'Article', item: `https://www.lelam.co${path}` }
      );
    } else if (path === '/blog') {
      title = 'Lelam Blog | Insights on MSTC eAuctions & Metal Scrap Trading';
      description = 'Read comprehensive guides, tips, and strategies for participating in MSTC eAuctions and managing scrap procurement on Lelam.';
      breadcrumbs.push({ name: 'Blog', item: 'https://www.lelam.co/blog' });
    } else if (path === '/privacy') {
      title = 'Privacy Policy | Lelam';
      breadcrumbs.push({ name: 'Privacy Policy', item: 'https://www.lelam.co/privacy' });
    } else if (path === '/terms') {
      title = 'Terms of Service | Lelam';
      breadcrumbs.push({ name: 'Terms of Service', item: 'https://www.lelam.co/terms' });
    } else if (path === '/cookies') {
      title = 'Cookie Policy | Lelam';
      breadcrumbs.push({ name: 'Cookie Policy', item: 'https://www.lelam.co/cookies' });
    } else if (path === '/pricing') {
      title = 'Plans & Pricing | Lelam';
      description = 'Choose a Lelam subscription plan for advanced eAuction analytics, unlimited quotes, and premium bidding tools.';
      breadcrumbs.push({ name: 'Pricing', item: 'https://www.lelam.co/pricing' });
    } else if (path.startsWith('/checkout')) {
      title = 'Checkout | Lelam';
      description = 'Complete your Lelam subscription purchase securely.';
      isPublic = false;
    } else if (path.startsWith('/auth') || path === '/adminlogin') {
      title = 'Account Authentication | Lelam';
      description = 'Sign in or register for access to Lelam B2B eAuction bidding tools, document vault, and saved watchlist.';
      isPublic = false;
    } else if (path.startsWith('/dashboard')) {
      isPublic = false;
      if (path === '/dashboard/bids') title = 'My Active & Won Bids | Lelam';
      else if (path === '/dashboard/interested') title = 'My Watchlist | Lelam';
      else if (path === '/dashboard/documents') title = 'Document Vault & Compliance | Lelam';
      else if (path === '/dashboard/quotes') title = 'Bidding Quote Builder | Lelam';
      else if (path === '/dashboard/profile') title = 'Account Settings | Lelam';
      else if (path === '/dashboard/inventory') title = 'Inventory Checklists | Lelam';
      else if (path === '/dashboard/vendors') title = 'Personal Vendors | Lelam';
      else if (path === '/dashboard/reminders') title = 'Reminders & Calendar | Lelam';
      else title = 'User Dashboard | Lelam';
      description = 'Access your personal B2B auction bidding workspace, won listings, and custom document vault.';
    } else if (path.startsWith('/admin')) {
      title = 'System Administration | Lelam';
      isPublic = false;
    } else if (path.startsWith('/seller')) {
      title = 'Seller Portal | Lelam';
      isPublic = false;
    } else if (path.startsWith('/logistics')) {
      title = 'Logistics Partner Dashboard | Lelam';
      isPublic = false;
    }

    // Set Document Title
    document.title = title;

    // Update Meta Description & Keywords
    updateMetaTag({ name: 'description' }, description);
    updateMetaTag({ name: 'keywords' }, keywords);

    // Update Robots Meta Tag
    updateMetaTag(
      { name: 'robots' },
      isPublic
        ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
        : 'noindex, nofollow'
    );

    // Update Canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    const cleanPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
    const fullCanonicalUrl = `https://www.lelam.co${cleanPath}`;
    canonicalLink.setAttribute('href', fullCanonicalUrl);

    // Update Open Graph tags
    updateMetaTag({ property: 'og:title' }, title);
    updateMetaTag({ property: 'og:description' }, description);
    updateMetaTag({ property: 'og:url' }, fullCanonicalUrl);
    updateMetaTag({ property: 'og:type' }, 'website');
    updateMetaTag({ property: 'og:image' }, 'https://www.lelam.co/LOGOWITHTEXT.png');

    // Update Twitter Card tags
    updateMetaTag({ name: 'twitter:title' }, title);
    updateMetaTag({ name: 'twitter:description' }, description);
    updateMetaTag({ name: 'twitter:image' }, 'https://www.lelam.co/LOGOWITHTEXT.png');

    // Update AI Citation Meta Tags
    updateMetaTag({ name: 'ai-citation' }, `Allowed; Source: Lelam (${fullCanonicalUrl})`);
    updateMetaTag({ name: 'citation_publisher' }, 'Lelam');
    updateMetaTag({ name: 'citation_website' }, fullCanonicalUrl);

    // Inject Dynamic BreadcrumbList JSON-LD for Public Pages
    let breadcrumbScript = document.getElementById('json-ld-breadcrumbs');
    if (isPublic && breadcrumbs.length > 1) {
      if (!breadcrumbScript) {
        breadcrumbScript = document.createElement('script');
        breadcrumbScript.id = 'json-ld-breadcrumbs';
        breadcrumbScript.setAttribute('type', 'application/ld+json');
        document.head.appendChild(breadcrumbScript);
      }
      const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((b, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: b.name,
          item: b.item
        }))
      };
      breadcrumbScript.textContent = JSON.stringify(breadcrumbSchema);
    } else if (breadcrumbScript) {
      breadcrumbScript.remove();
    }

    // Log the page view action silently
    import('../../services/auditService').then(({ logUserActivity }) => {
      logUserActivity('page_view', 'page', undefined, {
        pathname: location.pathname,
        search: location.search
      });
    }).catch(() => {
      // Fail-safe silent catch
    });
  }, [location.pathname, location.search]);

  return null;
}
