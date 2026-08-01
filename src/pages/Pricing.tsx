import PricingSection3 from '../components/ui/pricing-section-3';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Minus, ChevronDown, Zap, Shield, BarChart3, Brain, Truck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { COMPARISON_FEATURES } from '../utils/pricingConfig';

const CATEGORY_ICONS: Record<string, any> = {
  'Discovery & Search': Zap,
  'Valuation & Pricing': Brain,
  'Dashboard & Tools': BarChart3,
  'Logistics & Operations': Truck,
  'Security & Support': Shield,
  'Team & Organization': Users,
};

// Dynamically construct COMPARISON_CATEGORIES from the single source of truth COMPARISON_FEATURES
const COMPARISON_CATEGORIES = Object.entries(
  COMPARISON_FEATURES.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push({
      name: feature.name,
      starter: feature.values.starter,
      go: feature.values.go,
      premium: feature.values.premium,
      enterprise: feature.values.enterprise,
    });
    return acc;
  }, {} as Record<string, any[]>)
).map(([name, features]) => ({
  name,
  icon: CATEGORY_ICONS[name] || Zap,
  features,
}));

function renderCellValue(value: boolean | string) {
  if (typeof value === 'string') {
    return <span className="text-sm font-black text-slate-800">{value}</span>;
  }
  if (value) {
    return <Check className="w-5.5 h-5.5 text-emerald-500 mx-auto stroke-[2.5]" />;
  }
  return <Minus className="w-5.5 h-5.5 text-slate-300 mx-auto" />;
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
    q: 'Can I get a refund if I cancel my subscription?',
    a: 'You can cancel your subscription at any time. Since we offer a 14-day free trial for Bidder Pro to evaluate all features, we generally do not issue refunds for active billing cycles. Your access will remain active until the end of your current cycle.',
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
    <div className="border-b border-blue-100/60 last:border-0">
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
  const [expandedMobileCategories, setExpandedMobileCategories] = useState<Record<string, boolean>>({});

  const toggleMobileCategory = (name: string) => {
    setExpandedMobileCategories((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <PricingSection3 />
      </div>

      {/* Feature Comparison Table */}
      <section id="comparison-table" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 scroll-mt-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Compare Plans in Detail
          </h2>
          <p className="mt-4 text-slate-500 text-lg max-w-2xl mx-auto">
            See exactly what's included in each plan to find the right fit for your auction strategy.
          </p>
        </div>

        {/* Desktop comparison table */}
        <div className="hidden md:block overflow-x-auto bg-gradient-to-b from-neutral-100 to-neutral-200 rounded-lg p-4 sm:p-6">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="border-b-2 border-blue-200/60">
                <th className="text-left py-5 pr-4 text-base font-extrabold text-slate-600 uppercase tracking-wider w-[32%]">
                  Feature
                </th>
                <th className="text-center py-5 px-3 text-sm font-extrabold text-slate-600 uppercase tracking-wider w-[17%]">
                  Free
                </th>
                <th className="text-center py-5 px-3 text-sm font-extrabold text-slate-600 uppercase tracking-wider w-[17%]">
                  Individual
                </th>
                <th className="text-center py-5 px-3 text-sm font-black uppercase tracking-wider bg-gradient-to-b from-blue-100/80 to-blue-50/60 text-primary rounded-t-xl w-[17%] ring-1 ring-blue-200/60">
                  Business
                </th>
                <th className="text-center py-5 px-3 text-sm font-extrabold text-slate-600 uppercase tracking-wider w-[17%]">
                  Enterprise
                </th>
              </tr>
            </thead>
            {COMPARISON_CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <tbody key={category.name}>
                  <tr>
                    <td
                      colSpan={5}
                      className="pt-10 pb-4 text-sm font-black text-slate-900 uppercase tracking-widest border-b border-blue-200/40"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="h-8 w-8 rounded-lg bg-gradient-to-t from-blue-100 to-blue-50 border border-blue-200/60 grid place-content-center">
                          <Icon className="w-4.5 h-4.5 text-primary" />
                        </span>
                        {category.name}
                      </span>
                    </td>
                  </tr>
                  {category.features.map((feature: any) => (
                    <tr
                      key={feature.name}
                      className="border-b border-slate-200/50 hover:bg-white/40 transition-colors"
                    >
                      <td className="py-4 pr-4 text-base text-slate-800 font-semibold">
                        {feature.name}
                      </td>
                      <td className="py-4 px-3 text-center">
                        {renderCellValue(feature.starter)}
                      </td>
                      <td className="py-4 px-3 text-center">
                        {renderCellValue(feature.go)}
                      </td>
                      <td className="py-4 px-3 text-center bg-blue-50/40 ring-1 ring-blue-200/30 ring-inset">
                        {renderCellValue(feature.premium)}
                      </td>
                      <td className="py-4 px-3 text-center">
                        {renderCellValue(feature.enterprise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>

        {/* Mobile comparison — collapsible cards */}
        <div className="md:hidden space-y-4">
          {COMPARISON_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isExpanded = !!expandedMobileCategories[category.name];
            return (
              <div key={category.name} className="bg-gradient-to-b from-neutral-100 to-neutral-200 rounded-2xl p-5 border border-blue-200/40 shadow-sm">
                <button
                  onClick={() => toggleMobileCategory(category.name)}
                  className="w-full text-sm font-black text-slate-800 uppercase tracking-widest flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="h-7 w-7 rounded-lg bg-gradient-to-t from-blue-100 to-blue-50 border border-blue-200/60 grid place-content-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </span>
                    {category.name}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${
                      isExpanded ? 'rotate-180 text-primary' : ''
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, marginTop: 0 }}
                      animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4">
                        {category.features.map((feature: any) => (
                          <div key={feature.name} className="bg-white/80 backdrop-blur-xs rounded-xl p-4 border border-blue-100/60 shadow-3xs">
                            <p className="text-base font-bold text-slate-800 mb-3">{feature.name}</p>
                            <div className="grid grid-cols-4 gap-1.5 text-center">
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1.5">Free</p>
                                {renderCellValue(feature.starter)}
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1.5">Individual</p>
                                {renderCellValue(feature.go)}
                              </div>
                              <div className="bg-blue-50/60 rounded-lg py-1 ring-1 ring-blue-200/40 ring-inset">
                                <p className="text-[10px] font-black text-primary uppercase mb-1.5">Business</p>
                                {renderCellValue(feature.premium)}
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1.5">Enterprise</p>
                                {renderCellValue(feature.enterprise)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
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
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl text-base font-bold text-white bg-gradient-to-t from-blue-900 to-blue-700 shadow-lg shadow-blue-950/30 border border-blue-800 transition-all hover:-translate-y-0.5 hover:opacity-95"
            >
              Start Free — No Credit Card
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl text-base font-bold text-blue-950 bg-gradient-to-t from-blue-50 via-blue-100 to-blue-200 border border-blue-300 shadow-sm transition-all hover:-translate-y-0.5 hover:opacity-95"
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gradient-to-b from-neutral-100 to-neutral-200/60 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-slate-500 text-base">
              Everything you need to know about Lelam pricing.
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-xs rounded-2xl border border-blue-200/40 shadow-sm px-6 sm:px-8 divide-y divide-blue-100/40">
            {PRICING_FAQ.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
