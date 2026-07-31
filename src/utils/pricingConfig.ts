export interface CardFeatureHighlight {
  text: string;
  subtext?: string;
  isHighlighted?: boolean;
}

export interface FeatureDef {
  id: string;
  name: string;
  category:
    | 'Discovery & Search'
    | 'Valuation & Pricing'
    | 'Dashboard & Tools'
    | 'Logistics & Operations'
    | 'Security & Support'
    | 'Team & Organization';
  values: {
    explorer: boolean | string;
    pro: boolean | string;
    enterprise: boolean | string;
  };
  cardHighlight?: {
    explorer?: string | CardFeatureHighlight;
    pro?: string | CardFeatureHighlight;
    enterprise?: string | CardFeatureHighlight;
  };
}

export interface Plan {
  id: 'explorer' | 'pro' | 'enterprise';
  name: string;
  price: string | null;
  yearlyPrice: string | null;
  period: string;
  description: string;
  buttonText: string;
  href: string;
  isPopular: boolean;
  features: (string | CardFeatureHighlight)[];
}

export const COMPARISON_FEATURES: FeatureDef[] = [
  // Discovery & Search
  {
    id: 'search_browse',
    name: 'Auction search & browse',
    category: 'Discovery & Search',
    values: { explorer: true, pro: true, enterprise: true },
    cardHighlight: { explorer: 'Auction search & browse with filters' }
  },
  {
    id: 'category_filters',
    name: 'Category filters',
    category: 'Discovery & Search',
    values: { explorer: true, pro: true, enterprise: true }
  },
  {
    id: 'detail_catalogs',
    name: 'Auction detail & PDF catalogs',
    category: 'Discovery & Search',
    values: { explorer: true, pro: true, enterprise: true },
    cardHighlight: { explorer: 'View auction details & PDF catalogs' }
  },
  {
    id: 'nlp_search',
    name: 'NLP natural language search',
    category: 'Discovery & Search',
    values: { explorer: false, pro: true, enterprise: true },
    cardHighlight: { pro: 'NLP natural language search' }
  },
  {
    id: 'bid_recommendations',
    name: 'Smart AI bid recommendations',
    category: 'Discovery & Search',
    values: { explorer: false, pro: false, enterprise: true },
    cardHighlight: { enterprise: 'Smart AI-powered bid recommendations' }
  },
  {
    id: 'blog_news_faq',
    name: 'Blog, news & FAQ access',
    category: 'Discovery & Search',
    values: { explorer: true, pro: true, enterprise: true },
    cardHighlight: { explorer: 'Blog, news & FAQ access' }
  },
  // Valuation & Pricing
  {
    id: 'basic_commodity_prices',
    name: 'Basic commodity prices',
    category: 'Valuation & Pricing',
    values: { explorer: true, pro: true, enterprise: true },
    cardHighlight: { explorer: 'Basic commodity market prices' }
  },
  {
    id: 'live_market_rates',
    name: 'Live market rates & history charts',
    category: 'Valuation & Pricing',
    values: { explorer: false, pro: true, enterprise: true },
    cardHighlight: { pro: 'Live market rates & price history' }
  },
  {
    id: 'valuation_engine',
    name: 'AI Valuation Engine (Profit & Loss)',
    category: 'Valuation & Pricing',
    values: { explorer: false, pro: true, enterprise: true },
    cardHighlight: {
      pro: {
        text: 'AI Valuation Engine (Profit & Loss)',
        subtext: 'Catch one overpriced lot before you bid and the plan pays for itself.',
        isHighlighted: true
      }
    }
  },
  {
    id: 'price_predictor',
    name: 'ML Scrap Price Predictor',
    category: 'Valuation & Pricing',
    values: { explorer: false, pro: true, enterprise: true },
    cardHighlight: { pro: 'ML Scrap Price Predictor' }
  },
  {
    id: 'international_price',
    name: 'International price comparison',
    category: 'Valuation & Pricing',
    values: { explorer: false, pro: true, enterprise: true }
  },
  {
    id: 'custom_indices',
    name: 'Custom commodity indices',
    category: 'Valuation & Pricing',
    values: { explorer: false, pro: false, enterprise: true },
    cardHighlight: { enterprise: 'Custom commodity indices' }
  },
  {
    id: 'valuation_api',
    name: 'Bulk Valuation REST API',
    category: 'Valuation & Pricing',
    values: { explorer: false, pro: false, enterprise: true },
    cardHighlight: { enterprise: 'Bulk Valuation REST API' }
  },
  // Dashboard & Tools
  {
    id: 'watchlist_items',
    name: 'Watchlist items',
    category: 'Dashboard & Tools',
    values: { explorer: '10 items', pro: 'Unlimited', enterprise: 'Unlimited' },
    cardHighlight: {
      explorer: 'Save up to 10 auctions to watchlist',
      pro: 'Unlimited watchlist items'
    }
  },
  {
    id: 'document_vault',
    name: 'Document vault',
    category: 'Dashboard & Tools',
    values: { explorer: false, pro: true, enterprise: true },
    cardHighlight: { pro: 'Document vault for auction paperwork' }
  },
  {
    id: 'custom_reminders',
    name: 'Custom reminders & alerts',
    category: 'Dashboard & Tools',
    values: { explorer: false, pro: true, enterprise: true }
  },
  {
    id: 'inventory_management',
    name: 'Inventory management',
    category: 'Dashboard & Tools',
    values: { explorer: false, pro: true, enterprise: true }
  },
  {
    id: 'vendor_directory',
    name: 'Vendor directory',
    category: 'Dashboard & Tools',
    values: { explorer: false, pro: true, enterprise: true }
  },
  {
    id: 'advanced_analytics',
    name: 'Advanced analytics & insights',
    category: 'Dashboard & Tools',
    values: { explorer: false, pro: false, enterprise: true },
    cardHighlight: { enterprise: 'Advanced analytics & bid insights' }
  },
  // Logistics & Operations
  {
    id: 'mstc_redirect',
    name: 'MSTC portal redirect',
    category: 'Logistics & Operations',
    values: { explorer: true, pro: true, enterprise: true },
    cardHighlight: { explorer: 'Direct redirect to MSTC portal' }
  },
  {
    id: 'logistics_quotes',
    name: 'Logistics quote requests',
    category: 'Logistics & Operations',
    values: { explorer: false, pro: true, enterprise: true }
  },
  {
    id: 'seller_portal',
    name: 'Seller portal access',
    category: 'Logistics & Operations',
    values: { explorer: false, pro: false, enterprise: true },
    cardHighlight: { enterprise: 'Seller portal — list your own auctions' }
  },
  // Security & Support
  {
    id: 'email_notifs',
    name: 'Email notifications',
    category: 'Security & Support',
    values: { explorer: true, pro: true, enterprise: true },
    cardHighlight: { explorer: 'Email closing reminders' }
  },
  {
    id: 'priority_support',
    name: 'Priority support (24hr)',
    category: 'Security & Support',
    values: { explorer: false, pro: true, enterprise: true }
  },
  {
    id: 'sso_auth',
    name: 'SSO / SAML authentication',
    category: 'Security & Support',
    values: { explorer: false, pro: false, enterprise: true }
  },
  {
    id: 'compliance_audit',
    name: 'Compliance & audit trail',
    category: 'Security & Support',
    values: { explorer: false, pro: false, enterprise: true }
  },
  {
    id: 'account_manager',
    name: 'Dedicated account manager',
    category: 'Security & Support',
    values: { explorer: false, pro: false, enterprise: true },
    cardHighlight: { enterprise: 'Dedicated account manager' }
  },
  {
    id: 'uptime_sla',
    name: '99.9% uptime SLA',
    category: 'Security & Support',
    values: { explorer: false, pro: false, enterprise: true }
  },
  // Team & Organization
  {
    id: 'team_seats',
    name: 'Team seats',
    category: 'Team & Organization',
    values: { explorer: '1', pro: '3', enterprise: '5' },
    cardHighlight: {
      pro: 'Up to 3 team member seats',
      enterprise: 'Multi-user team accounts (up to 5 seats)'
    }
  },
  {
    id: 'priority_onboarding',
    name: 'Priority onboarding & training',
    category: 'Team & Organization',
    values: { explorer: false, pro: false, enterprise: true }
  }
];

export const getCardFeaturesForPlan = (
  planId: 'explorer' | 'pro' | 'enterprise'
): (string | CardFeatureHighlight)[] => {
  return COMPARISON_FEATURES.filter(
    (f) => f.cardHighlight && f.cardHighlight[planId] !== undefined
  ).map((f) => f.cardHighlight![planId]!);
};

export const PLANS: Plan[] = [
  {
    id: 'explorer',
    name: 'EXPLORER',
    price: '0',
    yearlyPrice: '0',
    period: 'forever',
    description: 'Start discovering auctions for free — no credit card needed',
    buttonText: 'Get Started Free',
    href: '/checkout',
    isPopular: false,
    features: getCardFeaturesForPlan('explorer')
  },
  {
    id: 'pro',
    name: 'BIDDER PRO',
    price: '1999',
    yearlyPrice: '21110',
    period: 'per month',
    description: 'Everything you need to find, value, and win auctions',
    buttonText: 'Start 14-Day Free Trial',
    href: '/checkout',
    isPopular: true,
    features: getCardFeaturesForPlan('pro')
  },
  {
    id: 'enterprise',
    name: 'ENTERPRISE',
    price: null,
    yearlyPrice: null,
    period: 'custom',
    description: 'For organizations that need scale, security, and dedicated support',
    buttonText: 'Contact Sales',
    href: '/contact',
    isPopular: false,
    features: getCardFeaturesForPlan('enterprise')
  }
];
