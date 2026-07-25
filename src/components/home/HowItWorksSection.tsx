import { Link } from 'react-router-dom';
import { Calculator, FileText, FolderLock, Heart, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const features = [
  {
    id: '01',
    name: 'ROI Calculator',
    description: 'Calculate customs duty rates, logistics fees, tax components, and estimated net profit margin for any lot.',
    highlights: ['Duty & GST Calculation', 'Logistics Estimator', 'Net Margin Projection'],
    icon: Calculator,
    authPath: '/auctions',
  },
  {
    id: '02',
    name: 'Quote Builder',
    description: 'Generate professional procurement quotes with automatic pricing, tax computation, and exportable documentation.',
    highlights: ['Instant PDF Export', 'Tax & Fee Breakdowns', 'Custom Payment Terms'],
    icon: FileText,
    authPath: '/dashboard/quotes',
  },
  {
    id: '03',
    name: 'Document Vault',
    description: 'Securely store and organize your bid documents, compliance certificates, KYC records, and tender submissions.',
    highlights: ['Encrypted Vault Storage', 'KYC & License Storage', 'One-Click Bid Attachment'],
    icon: FolderLock,
    authPath: '/dashboard/documents',
  },
  {
    id: '04',
    name: 'Watchlist & Alerts',
    description: 'Save auctions you\'re interested in, set bid reminders, and receive real-time notifications on status changes.',
    highlights: ['Real-Time Status Alerts', 'Calendar Syncing', 'Live Price Triggers'],
    icon: Heart,
    authPath: '/dashboard/interested',
  },
];

export function HowItWorksSection() {
  const { isAuthenticated } = useAuthStore();

  return (
    <section className="py-14 sm:py-16 bg-slate-50/70 border-t border-slate-200/70 relative">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl tracking-tight">
            Built-In Tools & Features
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
            Everything you need to analyze, bid, and win high-value eAuctions — all inside one platform.
          </p>
        </div>

        {/* Mobile Left-Right Horizontal Slider */}
        <div className="flex sm:hidden overflow-x-auto snap-x snap-mandatory gap-4 -my-4 py-4 pb-6 -mx-6 px-6 hide-scrollbar">
          {features.map((feature) => {
            const Icon = feature.icon;
            const linkTo = isAuthenticated ? feature.authPath : '/auth/register';

            return (
              <div 
                key={feature.id} 
                className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col justify-between hover:border-primary/40 transition-all duration-300 group w-[82vw] max-w-[320px] shrink-0 snap-center"
              >
                <div>
                  <div className="mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-2xs">
                      <Icon className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2.5 group-hover:text-primary transition-colors">
                    {feature.name}
                  </h3>

                  <p className="text-sm text-slate-500 leading-relaxed mb-5">
                    {feature.description}
                  </p>

                  <ul className="space-y-2 pt-3 border-t border-slate-100">
                    {feature.highlights.map((item, i) => (
                      <li key={i} className="flex items-center text-xs font-medium text-slate-600">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary mr-2 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to={linkTo}
                  className="pt-5 mt-6 border-t border-slate-100 flex items-center text-xs font-bold text-primary group-hover:translate-x-1 transition-transform"
                >
                  <span>Explore Feature</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Link>
              </div>
            );
          })}
        </div>

        {/* Tablet & Desktop Grid */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            const linkTo = isAuthenticated ? feature.authPath : '/auth/register';

            return (
              <div 
                key={feature.id} 
                className="bg-white border border-slate-200/80 rounded-2xl p-7 min-h-[350px] flex flex-col justify-between hover:border-primary/40 hover:shadow-xl transition-all duration-300 group"
              >
                <div>
                  <div className="mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-2xs">
                      <Icon className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-2.5 group-hover:text-primary transition-colors">
                    {feature.name}
                  </h3>

                  <p className="text-sm text-slate-500 leading-relaxed mb-5">
                    {feature.description}
                  </p>

                  <ul className="space-y-2 pt-3 border-t border-slate-100">
                    {feature.highlights.map((item, i) => (
                      <li key={i} className="flex items-center text-xs font-medium text-slate-600">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary mr-2 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to={linkTo}
                  className="pt-5 mt-6 border-t border-slate-100 flex items-center text-xs font-bold text-primary group-hover:translate-x-1 transition-transform"
                >
                  <span>Explore Feature</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
