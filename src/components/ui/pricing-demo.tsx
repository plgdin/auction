"use client";

import { Pricing } from "@/components/ui/pricing";

const lelamPlans = [
  {
    name: "EXPLORER",
    price: "0",
    yearlyPrice: "0",
    period: "forever",
    features: [
      "Auction search & browse with filters",
      "View auction details & PDF catalogs",
      "Save up to 10 auctions to watchlist",
      "Basic commodity market prices",
      "Blog, news & FAQ access",
      "Direct redirect to MSTC portal",
      "Email closing reminders",
    ],
    description: "Start discovering auctions for free — no credit card needed",
    buttonText: "Get Started Free",
    href: "/auth/register",
    isPopular: false,
    isContactSales: false,
  },
  {
    name: "BIDDER PRO",
    price: "1999",
    yearlyPrice: "21110",
    period: "per month",
    features: [
      "Everything in Explorer",
      "Unlimited watchlist items",
      "AI Valuation Engine (Profit & Loss)",
      "ML Scrap Price Predictor",
      "Live market rates & price history charts",
      "NLP natural language search",
      "Document vault for auction paperwork",
      "Custom reminders & deadline alerts",
      "Vendor directory access",
      "Inventory management",
      "Logistics quote requests",
      "International price comparison (IN/US/UK)",
      "Up to 3 team member seats",
      "Priority support (24hr response)",
    ],
    description: "Everything you need to find, value, and win auctions",
    buttonText: "Start 14-Day Free Trial",
    href: "/auth/register",
    isPopular: true,
    isContactSales: false,
  },
  {
    name: "ENTERPRISE",
    price: "0",
    yearlyPrice: "0",
    period: "custom",
    features: [
      "Everything in Bidder Pro",
      "Smart AI-powered bid recommendations",
      "Multi-user team accounts (up to 5 seats)",
      "Seller portal — list your own auctions",
      "Bulk Valuation REST API",
      "Custom commodity indices",
      "White-label branded PDF reports",
      "Advanced analytics & bid insights",
      "Dedicated account manager",
      "99.9% uptime SLA agreement",
      "SSO / SAML authentication",
      "Compliance & audit trail",
      "Priority onboarding & training",
    ],
    description: "For organizations that need scale, security, and dedicated support",
    buttonText: "Contact Sales",
    href: "/contact",
    isPopular: false,
    isContactSales: true,
  },
];

export function PricingBasic() {
  return (
    <Pricing 
      plans={lelamPlans}
      title="Simple, Transparent Pricing"
      description={"Choose the plan that fits your auction strategy\nAll plans include full access to our discovery platform with direct MSTC portal integration."}
    />
  );
}
