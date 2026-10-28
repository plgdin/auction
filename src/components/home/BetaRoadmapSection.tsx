import { useState } from 'react';
import { 
  Hammer, CheckCircle2, 
  ArrowRight, Radio, Lock, BarChart3, Send
} from 'lucide-react';
import { Link } from 'react-router-dom';


export function BetaRoadmapSection() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitted(true);
  };

  return (
    <section className="py-16 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold uppercase tracking-wider mb-4">
            <Hammer className="w-3.5 h-3.5" />
            <span>Platform Roadmap & Active Development</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Building The Next Generation Of Enterprise E-Auctions
          </h2>
          <p className="mt-4 text-base text-slate-400 leading-relaxed">
            We are actively innovating high-velocity auction workflows. Explore newly released beta modules currently in sandbox preview.
          </p>
        </div>

        {/* Feature Roadmap Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Card 1: Live Auction Floor */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 flex flex-col justify-between transition-all hover:shadow-xl hover:shadow-amber-500/5 group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
                  <Radio className="w-6 h-6 animate-pulse" />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase font-mono">
                  Beta v0.9
                </span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                Live Auction Floor & Podium Room
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Sub-second audio/video streaming with interactive hammer countdown, real-time bid pulse ticker, and live floor chat.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800">
              <Link 
                to="/dashboard/live-auction"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
              >
                Launch Sandbox Room <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 2: Market Analytics */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 flex flex-col justify-between transition-all hover:shadow-xl hover:shadow-indigo-500/5 group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase font-mono">
                  WIP Engine
                </span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                Market Analytics & Price Indices
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Macro commodity price indexes, category realization multiples over reserve, and asset depreciation curves.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800">
              <Link 
                to="/dashboard/analytics"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Inspect Telemetry <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 3: Smart Escrow */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-6 flex flex-col justify-between transition-all hover:shadow-xl hover:shadow-purple-500/5 group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold">
                  <Lock className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold uppercase font-mono">
                  In Sandbox
                </span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">
                Smart Escrow & Milestone Release
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Institutional custodial escrow protecting buyer deposits with physical lot inspection sign-offs and gate clearance.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800">
              <Link 
                to="/dashboard/escrow"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors"
              >
                View Escrow Flow <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Early Beta Tester Signup Box */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 p-8 rounded-3xl max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <h4 className="text-base font-bold text-white">Join Early Access Developer Previews</h4>
            <p className="text-xs text-slate-400 mt-1">Get invited to participate in private live testing auctions.</p>
          </div>

          {isSubmitted ? (
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-950/60 border border-emerald-800/60 px-4 py-2.5 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
              <span>Added to Early Access Cohort!</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2 w-full sm:w-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@company.com"
                required
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 flex-1 sm:w-64"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shrink-0 flex items-center gap-1.5"
              >
                <span>Request Access</span>
                <Send className="w-3 h-3" />
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
