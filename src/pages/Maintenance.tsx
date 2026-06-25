import { Hammer, Clock } from 'lucide-react';

export function Maintenance() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center space-y-8 p-10 bg-white rounded-3xl border border-slate-200 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative flex justify-center">
          <div className="h-24 w-24 bg-primary rounded-2xl flex items-center justify-center border border-primary/10 shadow-lg shadow-primary/20 transform hover:scale-105 transition-transform duration-300">
            <Hammer className="h-10 w-10 text-white" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Maintenance Ongoing
          </h1>
          <p className="text-base text-slate-500 max-w-sm mx-auto font-light">
            Please check again later. We are performing system maintenance.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-center items-center gap-2 text-slate-400 text-sm font-medium">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>Expected back online soon</span>
        </div>
      </div>
    </div>
  );
}
