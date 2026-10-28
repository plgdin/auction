import { useState } from 'react';
import { 
  Hammer, Sparkles, CheckCircle2, Clock, ChevronRight, 
  X, ShieldCheck, Compass
} from 'lucide-react';
import { Link } from 'react-router-dom';


export function DevBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return (
      <button 
        onClick={() => setIsDismissed(false)}
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-full shadow-lg border border-amber-300 transition-all hover:scale-105"
        title="Open Development Status"
      >
        <Hammer className="w-3.5 h-3.5" />
        <span>Dev Mode: alan/cool</span>
      </button>
    );
  }

  return (
    <>
      <aside aria-label="Development preview banner" className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 px-4 py-2 text-xs sm:text-sm font-medium border-b border-amber-400/50 shadow-sm relative z-50">
        <div className="container mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950 text-amber-400 text-xs font-black uppercase tracking-wider shrink-0">
              <Hammer className="w-3 h-3" /> Dev Preview
            </span>
            <span className="truncate">
              <strong>Branch alan/cool:</strong> Platform is under active development. Experimental modules & simulated flows enabled.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-900 text-amber-300 hover:text-white font-semibold text-xs transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Status & Roadmap</span>
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 hover:bg-black/10 rounded text-slate-950 hover:text-black transition-colors"
              title="Minimize banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Development Roadmap & Status Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Under Development Build</h3>
                  <p className="text-xs text-slate-400">Active branch: <code className="text-amber-400 font-mono">alan/cool</code> • Safe Sandbox</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-900 leading-relaxed">
                  <strong>Backend Protection Active:</strong> Live production database is fully isolated. Experimental features in this branch run in safe sandbox & client preview mode.
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Feature Readiness Status</h4>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-800 text-xs">Auction Catalog & Bidding Engine</p>
                        <p className="text-[11px] text-slate-500">Realtime bids, watchlist, dynamic filters</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full">Live</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50/60 border border-amber-200">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-800 text-xs">Live Auction Bidding Floor</p>
                        <p className="text-[11px] text-slate-500">Live stream room, hammer countdown, sound alerts</p>
                      </div>
                    </div>
                    <Link 
                      to="/dashboard/live-auction"
                      onClick={() => setIsOpen(false)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-md transition-colors flex items-center gap-1"
                    >
                      Try Beta <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-50/60 border border-indigo-200">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-800 text-xs">Market Analytics & Price Indices</p>
                        <p className="text-[11px] text-slate-500">Historical lot price trends, volume prediction</p>
                      </div>
                    </div>
                    <Link 
                      to="/dashboard/analytics"
                      onClick={() => setIsOpen(false)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors flex items-center gap-1"
                    >
                      Preview <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50/60 border border-purple-200">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-purple-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-800 text-xs">Smart Escrow & Milestone Settlement</p>
                        <p className="text-[11px] text-slate-500">Automated gate pass, physical lot release</p>
                      </div>
                    </div>
                    <Link 
                      to="/dashboard/escrow"
                      onClick={() => setIsOpen(false)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors flex items-center gap-1"
                    >
                      Inspect <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors"
              >
                Close Preview Info
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
