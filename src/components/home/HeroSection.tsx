import { Link } from 'react-router-dom';
import { ArrowRight, Gavel, ShieldCheck, Zap } from 'lucide-react';

export function HeroSection() {
  return (
    <div className="relative bg-slate-900 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900 to-slate-900 mix-blend-multiply" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary-800/20 to-transparent" />
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
              className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary-600 transition-colors shadow-lg hover:shadow-primary/30"
            >
              View Live Auctions
              <ArrowRight className="ml-2 -mr-1 w-5 h-5" />
            </Link>
            <Link
              to="/tenders"
              className="inline-flex items-center justify-center px-8 py-4 border border-slate-600 text-base font-medium rounded-md text-white hover:bg-slate-800 transition-colors"
            >
              Browse Open Tenders
            </Link>
          </div>
        </div>

        {/* Feature badges */}
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3 max-w-3xl">
          <div className="flex items-center text-slate-300">
            <ShieldCheck className="h-6 w-6 text-primary-400 mr-3" />
            <span className="font-medium text-sm">Bank-Grade Security</span>
          </div>
          <div className="flex items-center text-slate-300">
            <Gavel className="h-6 w-6 text-primary-400 mr-3" />
            <span className="font-medium text-sm">Transparent Bidding</span>
          </div>
          <div className="flex items-center text-slate-300">
            <Zap className="h-6 w-6 text-primary-400 mr-3" />
            <span className="font-medium text-sm">Real-time Updates</span>
          </div>
        </div>
      </div>
    </div>
  );
}
