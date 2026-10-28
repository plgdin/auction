import { useState } from 'react';
import { 
  BarChart3, Sparkles, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const priceIndexData = [
  { month: 'May 25', industrialMachinery: 104, metals: 98, electronics: 100 },
  { month: 'Jul 25', industrialMachinery: 112, metals: 105, electronics: 104 },
  { month: 'Sep 25', industrialMachinery: 118, metals: 110, electronics: 108 },
  { month: 'Nov 25', industrialMachinery: 125, metals: 115, electronics: 112 },
  { month: 'Jan 26', industrialMachinery: 134, metals: 122, electronics: 119 },
  { month: 'Mar 26', industrialMachinery: 142, metals: 129, electronics: 125 },
];

const categoryVolumeData = [
  { category: 'Heavy Machinery', lots: 145, avgMultiplier: 1.34 },
  { category: 'Ferrous Scrap', lots: 230, avgMultiplier: 1.18 },
  { category: 'Commercial Vehicles', lots: 88, avgMultiplier: 1.45 },
  { category: 'Electrical & Transformers', lots: 64, avgMultiplier: 1.22 },
  { category: 'Infrastructure Surplus', lots: 112, avgMultiplier: 1.28 },
];

export function MarketAnalytics() {
  const [timeframe, setTimeframe] = useState<'30d' | '90d' | '1y'>('90d');


  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Dev Header Badge */}
      <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-md shadow-indigo-600/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900 text-base sm:text-lg">Market Analytics & Price Indices</h1>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                Beta Engine v0.9
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Under active development: Macro e-procurement indices, lot price valuation algorithms, and bidding volume telemetry.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-900 shadow-sm flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Predictive AI Valuation (Q1 Roadmap)
          </span>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Market Price Index</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 font-mono">142.4 pts</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-full">
              <ArrowUpRight className="w-3.5 h-3.5" /> +8.6%
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Compared to previous quarter average</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Bid Competition</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 font-mono">14.2 bids/lot</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-full">
              <ArrowUpRight className="w-3.5 h-3.5" /> +12.1%
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Highest in Heavy Industrial Machinery</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reserve Realization Ratio</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 font-mono">132.8%</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-full">
              <ArrowUpRight className="w-3.5 h-3.5" /> +5.4%
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Winning bid vs initial reserve price</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Settlement Velocity</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 font-mono">3.4 Days</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-full">
              <ArrowDownRight className="w-3.5 h-3.5" /> -18% time
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Time from hammer down to gate clearance</p>
        </div>
      </div>

      {/* Main Price Index Chart */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Historical Price Trend Index (Baseline 100)</h2>
            <p className="text-xs text-slate-500">Track industrial commodity & capital equipment realization indices.</p>
          </div>
          <div className="flex items-center gap-2">
            {(['30d', '90d', '1y'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  timeframe === t 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={priceIndexData}>
              <defs>
                <linearGradient id="colorMachinery" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorMetals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[80, 160]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Area type="monotone" dataKey="industrialMachinery" name="Industrial Machinery" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMachinery)" />
              <Area type="monotone" dataKey="metals" name="Ferrous & Non-Ferrous Metals" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMetals)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Realization Multipliers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Category Volume & Multiplier Analysis</h2>
            <p className="text-xs text-slate-500">Distribution of auction lots versus final price multiplier over reserve.</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryVolumeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="category" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="lots" name="Active / Completed Lots" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">AI Valuation Radar (Under Development)</h2>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                WIP Preview
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Automated econometric asset appraisal model combining scrap commodity prices with depreciation curves.
            </p>

            <div className="mt-6 space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">Estimated Fair Market Index</span>
                  <span className="font-mono font-bold text-emerald-600">₹32.4 Lakhs (Avg)</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '74%' }}></div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">Bidder Liquidity Index</span>
                  <span className="font-mono font-bold text-indigo-600">High (8.7/10)</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                  <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: '87%' }}></div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">Scrap Floor Price Sensitivity</span>
                  <span className="font-mono font-bold text-amber-600">Moderate (+4.2%)</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: '58%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Model Version: <code>v0.9.2-alpha</code></span>
            <button className="text-primary font-bold hover:underline">Download Whitepaper Draft →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
