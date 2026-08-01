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
    starter: boolean | string;
    go: boolean | string;
    premium: boolean | string;
    enterprise: boolean | string;
  };
}

export const COMPARISON_FEATURES: FeatureDef[] = [
  // Discovery & Search
  {
    id: 'search_browse',
    name: 'Auction search & browse',
    category: 'Discovery & Search',
    values: { starter: true, go: true, premium: true, enterprise: true },
  },
  {
    id: 'category_filters',
    name: 'Category filters',
    category: 'Discovery & Search',
    values: { starter: true, go: true, premium: true, enterprise: true },
  },
  {
    id: 'detail_catalogs',
    name: 'Auction detail & PDF catalogs',
    category: 'Discovery & Search',
    values: { starter: true, go: true, premium: true, enterprise: true },
  },
  {
    id: 'nlp_search',
    name: 'Smart Plain-English Search',
    category: 'Discovery & Search',
    values: { starter: false, go: false, premium: true, enterprise: true },
  },
  {
    id: 'bid_recommendations',
    name: 'Smart Top Bid Suggestions',
    category: 'Discovery & Search',
    values: { starter: false, go: false, premium: false, enterprise: true },
  },
  {
    id: 'blog_news_faq',
    name: 'Blog, news & FAQ access',
    category: 'Discovery & Search',
    values: { starter: true, go: true, premium: true, enterprise: true },
  },
  // Valuation & Pricing
  {
    id: 'basic_commodity_prices',
    name: 'Basic commodity prices',
    category: 'Valuation & Pricing',
    values: { starter: true, go: true, premium: true, enterprise: true },
  },
  {
    id: 'tax_transport_estimator',
    name: 'GST, Tax & Transport Cost Estimator',
    category: 'Valuation & Pricing',
    values: { starter: false, go: true, premium: true, enterprise: true },
  },
  {
    id: 'max_bid_calculator',
    name: 'Max Bid & Strategy Calculator',
    category: 'Valuation & Pricing',
    values: { starter: false, go: 'Basic', premium: 'Advanced', enterprise: 'Custom' },
  },
  {
    id: 'live_market_rates',
    name: 'Live market rates & history charts',
    category: 'Valuation & Pricing',
    values: { starter: false, go: false, premium: true, enterprise: true },
  },
  {
    id: 'valuation_engine',
    name: 'Profit & Loss Valuation Calculator',
    category: 'Valuation & Pricing',
    values: { starter: false, go: false, premium: true, enterprise: true },
  },
  {
    id: 'price_predictor',
    name: 'Scrap Price Trend Forecasts',
    category: 'Valuation & Pricing',
    values: { starter: false, go: false, premium: true, enterprise: true },
  },
  {
    id: 'scrap_resale_breakdown',
    name: 'Scrap vs. Resale Value Breakdown',
    category: 'Valuation & Pricing',
    values: { starter: false, go: false, premium: true, enterprise: true },
  },
  {
    id: 'risk_margin_warnings',
    name: 'Valuation Risk & Margin Warnings',
    category: 'Valuation & Pricing',
    values: { starter: false, go: false, premium: true, enterprise: true },
  },
  {
    id: 'international_price',
    name: 'International price comparison',
    category: 'Valuation & Pricing',
    values: { starter: false, go: false, premium: true, enterprise: true },
  },
  {
    id: 'what_if_simulator',
    name: 'What-If Bid Scenario Simulator',
    category: 'Valuation & Pricing',
    values: { starter: false, go: false, premium: false, enterprise: true },
  },
  {
    id: 'custom_indices',
    name: 'Custom commodity indices',
    category: 'Valuation & Pricing',
    values: { starter: false, go: false, premium: false, enterprise: true },
  },

  // Dashboard & Tools
  {
    id: 'watchlist_items',
    name: 'Watchlist items',
    category: 'Dashboard & Tools',
    values: { starter: '10 items', go: '50 items', premium: 'Unlimited', enterprise: 'Unlimited' },
  },
  {
    id: 'document_vault',
    name: 'Document vault',
    category: 'Dashboard & Tools',
    values: { starter: false, go: true, premium: true, enterprise: true },
  },
  {
    id: 'custom_reminders',
    name: 'Custom reminders & alerts',
    category: 'Dashboard & Tools',
    values: { starter: false, go: true, premium: true, enterprise: true },
  },
  {
    id: 'inventory_management',
    name: 'Inventory management',
    category: 'Dashboard & Tools',
    values: { starter: false, go: true, premium: true, enterprise: true },
  },
  {
    id: 'vendor_directory',
    name: 'Vendor directory',
    category: 'Dashboard & Tools',
    values: { starter: false, go: true, premium: true, enterprise: true },
  },
  {
    id: 'advanced_analytics',
    name: 'Advanced analytics & insights',
    category: 'Dashboard & Tools',
    values: { starter: false, go: false, premium: false, enterprise: true },
  },
  // Logistics & Operations
  {
    id: 'mstc_redirect',
    name: 'Direct Link to Official MSTC Auctions',
    category: 'Logistics & Operations',
    values: { starter: true, go: true, premium: true, enterprise: true },
  },
  {
    id: 'logistics_quotes',
    name: 'Logistics quote requests',
    category: 'Logistics & Operations',
    values: { starter: false, go: true, premium: true, enterprise: true },
  },
  {
    id: 'seller_portal',
    name: 'Seller portal access',
    category: 'Logistics & Operations',
    values: { starter: false, go: false, premium: false, enterprise: true },
  },
  // Security & Support
  {
    id: 'email_notifs',
    name: 'Email notifications',
    category: 'Security & Support',
    values: { starter: true, go: true, premium: true, enterprise: true },
  },
  {
    id: 'priority_support',
    name: 'Priority support (24hr)',
    category: 'Security & Support',
    values: { starter: false, go: true, premium: true, enterprise: true },
  },
  {
    id: 'sso_auth',
    name: 'Single Sign-On (SSO)',
    category: 'Security & Support',
    values: { starter: false, go: false, premium: false, enterprise: true },
  },
  {
    id: 'compliance_audit',
    name: 'Compliance & audit trail',
    category: 'Security & Support',
    values: { starter: false, go: false, premium: false, enterprise: true },
  },
  {
    id: 'account_manager',
    name: 'Dedicated account manager',
    category: 'Security & Support',
    values: { starter: false, go: false, premium: false, enterprise: true },
  },
  {
    id: 'uptime_sla',
    name: '99.9% Guaranteed Platform Uptime',
    category: 'Security & Support',
    values: { starter: false, go: false, premium: false, enterprise: true },
  },
  // Team & Organization
  {
    id: 'team_seats',
    name: 'Team seats',
    category: 'Team & Organization',
    values: { starter: '1', go: '2', premium: '3', enterprise: '5+' },
  },
  {
    id: 'priority_onboarding',
    name: 'Priority onboarding & training',
    category: 'Team & Organization',
    values: { starter: false, go: false, premium: false, enterprise: true },
  },
];

// ── Backward-compatible exports for legacy components (pricing-demo.tsx, pricing.tsx) ──

export interface CardFeatureHighlight {
  text: string;
  subtext?: string;
  isHighlighted?: boolean;
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

export const PLANS: Plan[] = [
  {
    id: 'explorer',
    name: 'STARTER',
    price: '0',
    yearlyPrice: '0',
    period: 'forever',
    description: 'Start discovering auctions for free — no credit card needed',
    buttonText: 'Get Started Free',
    href: '/checkout',
    isPopular: false,
    features: [
      'Auction search & browse',
      'View details & PDF catalogs',
      'Basic commodity prices',
      'Email closing reminders',
      'MSTC portal redirect',
    ],
  },
  {
    id: 'pro',
    name: 'PREMIUM',
    price: '1999',
    yearlyPrice: '21110',
    period: 'per month',
    description: 'Everything you need to find, value, and win auctions',
    buttonText: 'Start 14-Day Free Trial',
    href: '/checkout',
    isPopular: true,
    features: [
      'NLP natural language search',
      'Live market rates & price history',
      { text: 'AI Valuation Engine (Profit & Loss)', subtext: 'Catch one overpriced lot before you bid and the plan pays for itself.', isHighlighted: true },
      'ML Scrap Price Predictor',
      'Unlimited watchlist items',
    ],
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
    features: [
      'Smart AI-powered bid recommendations',
      'Custom commodity indices',
      'Bulk Valuation REST API',
      'Seller portal — list your own auctions',
      'Dedicated account manager',
    ],
  },
];
