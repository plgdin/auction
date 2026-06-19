import { Search, TrendingUp, Sliders, LayoutDashboard } from 'lucide-react';

const steps = [
  {
    id: '01',
    name: 'Access MSTC Auctions',
    description: 'Instantly search and browse through synchronized government and corporate auction schedules and catalog listings.',
    icon: Search,
  },
  {
    id: '02',
    name: 'Track Market Prices',
    description: 'View live and historical metal index trends, currency rates, and regression models to determine accurate valuations.',
    icon: TrendingUp,
  },
  {
    id: '03',
    name: 'Compare & Calculate',
    description: 'Adjust customs duties and logistics charges, toggle price visibility, and evaluate potential ROI dynamically.',
    icon: Sliders,
  },
  {
    id: '04',
    name: 'Interactive Dashboard',
    description: 'Monitor your bookmarked items, manage analyzed lots, and customize your settings from the admin sidebar.',
    icon: LayoutDashboard,
  },
];

export function HowItWorksSection() {

  return (
    <section className="py-20 bg-white border-t border-slate-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">How the Platform Works</h2>
          <p className="mt-4 text-lg text-slate-600">
            Empowering MSTC buyers with data-driven auction intelligence in 4 simple steps.
          </p>
        </div>

        <div className="relative">
          {/* Connecting line for desktop */}
          <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-slate-200" aria-hidden="true" />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="relative flex flex-col items-center text-center">
                  <div className="w-24 h-24 rounded-full bg-white border-4 border-slate-50 shadow-sm flex items-center justify-center relative z-10 mb-6 group hover:border-primary/20 transition-colors">
                    <div className="absolute inset-0 bg-primary/5 rounded-full scale-0 group-hover:scale-100 transition-transform duration-300"></div>
                    <Icon className="w-10 h-10 text-primary relative z-10" />
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md">
                      {step.id}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{step.name}</h3>
                  <p className="text-slate-600 leading-relaxed text-sm">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
