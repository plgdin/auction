import { PricingBasic } from '../components/ui/pricing-demo';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Minus, ChevronDown, Zap, Shield, BarChart3, Brain, Truck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

// Feature comparison data for the detailed table
const COMPARISON_CATEGORIES = [
  {
    name: 'Discovery & Search',
    icon: Zap,
    features: [
      { name: 'Auction search & browse', free: true, pro: true, enterprise: true },
      { name: 'Category filters', free: true, pro: true, enterprise: true },
      { name: 'Auction detail & PDF catalogs', free: true, pro: true, enterprise: true },
      { name: 'NLP natural language search', free: false, pro: true, enterprise: true },
      { name: 'Smart AI bid recommendations', free: false, pro: false, enterprise: true },
    ],
  },
  {
    name: 'Valuation & Pricing',
    icon: Brain,
    features: [
      { name: 'Basic commodity prices', free: true, pro: true, enterprise: true },
      { name: 'Live market rates & history charts', free: false, pro: true, enterprise: true },
      { name: 'AI Valuation Engine (Profit & Loss)', free: false, pro: true, enterprise: true },
      { name: 'ML Scrap Price Predictor', free: false, pro: true, enterprise: true },
      { name: 'International price comparison', free: false, pro: true, enterprise: true },
      { name: 'Custom commodity indices', free: false, pro: false, enterprise: true },
      { name: 'Bulk Valuation REST API', free: false, pro: false, enterprise: true },
    ],
  },
  {
    name: 'Dashboard & Tools',
    icon: BarChart3,
    features: [
      { name: 'Watchlist items', free: '10', pro: 'Unlimited', enterprise: 'Unlimited' },
      { name: 'Document vault', free: false, pro: true, enterprise: true },
      { name: 'Custom reminders & alerts', free: false, pro: true, enterprise: true },
      { name: 'Inventory management', free: false, pro: true, enterprise: true },
      { name: 'Vendor directory', free: false, pro: true, enterprise: true },
      { name: 'Advanced analytics & insights', free: false, pro: false, enterprise: true },
      { name: 'White-label branded reports', free: false, pro: false, enterprise: true },
    ],
  },
  {
    name: 'Logistics & Operations',
    icon: Truck,
    features: [
      { name: 'MSTC portal redirect', free: true, pro: true, enterprise: true },
      { name: 'Logistics quote requests', free: false, pro: true, enterprise: true },
      { name: 'Seller portal access', free: false, pro: false, enterprise: true },
    ],
  },
  {
    name: 'Security & Support',
    icon: Shield,
    features: [
      { name: 'Email notifications', free: true, pro: true, enterprise: true },
      { name: 'Priority support (24hr)', free: false, pro: true, enterprise: true },
      { name: 'SSO / SAML authentication', free: false, pro: false, enterprise: true },
      { name: 'Compliance & audit trail', free: false, pro: false, enterprise: true },
      { name: 'Dedicated account manager', free: false, pro: false, enterprise: true },
      { name: '99.9% uptime SLA', free: false, pro: false, enterprise: true },
    ],
  },
  {
    name: 'Team & Organization',
    icon: Users,
    features: [
      { name: 'Team seats', free: '1', pro: '3', enterprise: '5' },
      { name: 'Priority onboarding & training', free: false, pro: false, enterprise: true },
    ],
  },
];

function renderCellValue(value: boolean | string) {
  if (typeof value === 'string') {
    return <span className="text-xs font-bold text-slate-700">{value}</span>;
  }
  if (value) {
    return <Check className="w-4 h-4 text-emerald-500 mx-auto" />;
  }
  return <Minus className="w-4 h-4 text-slate-300 mx-auto" />;
}

// Pricing FAQ data
const PRICING_FAQ = [
  {
    q: 'Is there a free trial for Bidder Pro?',
    a: 'Yes! Every new account starts with a 14-day free trial of Bidder Pro. No credit card required. You can downgrade to the Explorer plan at any time.',
  },
  {
    q: 'Can I switch plans at any time?',
    a: 'Absolutely. You can upgrade or downgrade your plan at any time from your dashboard. When upgrading, you\'ll get immediate access to new features. When downgrading, your current plan stays active until the end of the billing period.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept UPI, credit/debit cards, net banking, and popular wallets through our secure payment gateway. Enterprise customers can also pay via bank transfer / NEFT.',
  },
  {
    q: 'Does Lelam handle the actual auction bidding?',
    a: 'No. Lelam is an auction discovery and intelligence platform. We help you find, research, and value auctions — then redirect you to the official MSTC eCommerce portal for registration, bidding, and payment.',
  },
  {
    q: 'What is included in the AI Valuation Engine?',
    a: 'The AI Valuation Engine analyses auction lot items using live market commodity prices, ML predictions, and international price comparisons. It generates detailed ROI calculations to help you determine a profitable bidding range.',
  },
  {
    q: 'How does Enterprise pricing work?',
    a: 'Enterprise pricing is tailored to your organization\'s size and needs. Contact our sales team and we\'ll build a custom package that fits your requirements, including volume discounts for large teams.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left cursor-pointer group"
        aria-expanded={open}
      >
        <span className="text-sm sm:text-base font-semibold text-slate-800 group-hover:text-primary transition-colors pr-4">
          {q}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-300 ${
            open ? 'rotate-180 text-primary' : ''
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm text-slate-600 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <PricingBasic />
      </div>

      {/* Feature Comparison Table */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Compare Plans in Detail
          </h2>
          <p className="mt-3 text-slate-500 text-base max-w-xl mx-auto">
            See exactly what's included in each plan to find the right fit for your auction strategy.
          </p>
        </div>

        {/* Desktop comparison table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-4 pr-4 text-sm font-bold text-slate-500 uppercase tracking-wider w-[40%]">
                  Feature
                </th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-500 uppercase tracking-wider">
                  Explorer
                </th>
                <th className="text-center py-4 px-4 text-sm font-bold uppercase tracking-wider bg-primary/5 text-primary rounded-t-xl">
                  Bidder Pro
                </th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-500 uppercase tracking-wider">
                  Enterprise
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_CATEGORIES.map((category) => {
                const Icon = category.icon;
                return (
                  <tbody key={category.name}>
                    <tr>
                      <td
                        colSpan={4}
                        className="pt-8 pb-3 text-xs font-black text-slate-800 uppercase tracking-widest"
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-primary" />
                          {category.name}
                        </span>
                      </td>
                    </tr>
                    {category.features.map((feature) => (
                      <tr
                        key={feature.name}
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="py-3.5 pr-4 text-sm text-slate-700 font-medium">
                          {feature.name}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {renderCellValue(feature.free)}
                        </td>
                        <td className="py-3.5 px-4 text-center bg-primary/5">
                          {renderCellValue(feature.pro)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {renderCellValue(feature.enterprise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile comparison — collapsed cards */}
        <div className="md:hidden space-y-6">
          {COMPARISON_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <div key={category.name} className="bg-slate-50 rounded-2xl p-4">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <Icon className="w-4 h-4 text-primary" />
                  {category.name}
                </h3>
                <div className="space-y-3">
                  {category.features.map((feature) => (
                    <div key={feature.name} className="bg-white rounded-xl p-3 border border-slate-100">
                      <p className="text-sm font-semibold text-slate-800 mb-2">{feature.name}</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Explorer</p>
                          {renderCellValue(feature.free)}
                        </div>
                        <div className="bg-primary/5 rounded-lg py-1">
                          <p className="text-[9px] font-bold text-primary uppercase mb-1">Pro</p>
                          {renderCellValue(feature.pro)}
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Enterprise</p>
                          {renderCellValue(feature.enterprise)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-slate-50/70 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-slate-500 text-base">
              Everything you need to know about Lelam pricing.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 sm:px-8 divide-y divide-slate-100">
            {PRICING_FAQ.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-4">
            Ready to win your next auction?
          </h2>
          <p className="text-slate-500 text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of buyers who use Lelam to discover, value, and win auctions on the MSTC platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/auth/register"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl text-base font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"
            >
              Start Free — No Credit Card
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl text-base font-bold text-slate-700 bg-white border border-slate-200 hover:border-primary hover:text-primary shadow-sm transition-all hover:-translate-y-0.5"
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
