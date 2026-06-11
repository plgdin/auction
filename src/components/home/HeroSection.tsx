import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Gavel, Zap } from 'lucide-react';

export function HeroSection() {
  return (
    <div className="relative bg-foreground overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-foreground mix-blend-multiply" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/10 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl mb-6">
            Enterprise e-Procurement & Forward Auctions
          </h1>
          <p className="mt-4 text-xl text-slate-300 max-w-2xl leading-relaxed mb-10">
            A secure, transparent, and highly scalable platform for government and corporate asset disposal, procurement, and competitive bidding.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/auctions"
              className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded text-white bg-primary hover:bg-primary/95 transition-colors shadow-lg hover:shadow-primary/30"
            >
              View Auctions
              <ArrowRight className="ml-2 -mr-1 w-5 h-5" />
            </Link>
            <Link
              to="/tenders"
              className="inline-flex items-center justify-center px-8 py-4 border border-white/30 text-base font-medium rounded text-white hover:bg-white/10 transition-colors"
            >
              Browse Open Tenders
            </Link>
          </div>
        </div>

        {/* Feature badges */}
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3 max-w-3xl">
          <div className="flex items-center text-slate-300">
            <ShieldCheck className="h-6 w-6 text-primary mr-3" />
            <span className="font-medium text-sm">Bank-Grade Security</span>
          </div>
          <div className="flex items-center text-slate-300">
            <Gavel className="h-6 w-6 text-primary mr-3" />
            <span className="font-medium text-sm">Transparent Bidding</span>
          </div>
          <div className="flex items-center text-slate-300">
            <Zap className="h-6 w-6 text-primary mr-3" />
            <span className="font-medium text-sm">Real-time Updates</span>
          </div>
        </div>
      </div>
    </div>
  );
}
