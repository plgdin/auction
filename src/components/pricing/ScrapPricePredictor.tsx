import { useState, useEffect } from 'react';
import { BrainCircuit, TrendingUp, RefreshCw, Calculator, Database, AlertCircle } from 'lucide-react';
import { mlPredictionService, ML_DEFAULT_INPUTS } from '../../services/mlPredictionService';
import type { PredictorInputs } from '../../services/mlPredictionService';
import { formatPrice } from '../../utils/currency';
import { useAppStore } from '../../store/appStore';

export function ScrapPricePredictor() {
  const { currency } = useAppStore();
  const metadata = mlPredictionService.getMetadata();
  
  const [inputs, setInputs] = useState<PredictorInputs>(ML_DEFAULT_INPUTS);
  const [result, setResult] = useState<{ price: number, breakdown: Record<string, number> } | null>(null);
  const [dbComparison, setDbComparison] = useState<{ mlPrice: number; dbPrice: number | null; avgPrice: number } | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Recalculate prediction whenever inputs change
  useEffect(() => {
    const res = mlPredictionService.predict(inputs);
    setResult(res);
  }, [inputs]);

  const handleInputChange = (field: keyof PredictorInputs, value: string | number) => {
    setInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCompare = async () => {
    setIsComparing(true);
    try {
      const comp = await mlPredictionService.compareWithCurrentWay(inputs);
      setDbComparison(comp);
    } catch (e) {
      console.error("Failed to compare", e);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-6 py-4.5 border-b border-slate-150 flex justify-between items-center bg-slate-900 text-white">
        <div>
          <h3 className="font-extrabold text-sm uppercase tracking-wider flex items-center gap-2">
            <BrainCircuit className="w-4.5 h-4.5 text-sky-400" /> ML Scrap Price Predictor
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Predict prices using the trained linear regression model.
          </p>
        </div>
        <button
          onClick={() => setInputs(ML_DEFAULT_INPUTS)}
          className="text-[10px] text-slate-300 hover:text-white font-bold border border-slate-700 hover:border-slate-500 rounded-lg px-2.5 py-1.5 bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" /> Reset
        </button>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Col: Inputs */}
        <div className="space-y-4">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b pb-2">Model Features</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Scrap Grade</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-primary focus:outline-none bg-slate-50"
                value={inputs.Grade}
                onChange={(e) => handleInputChange('Grade', e.target.value)}
              >
                {metadata.grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Region</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-primary focus:outline-none bg-slate-50"
                value={inputs.Region}
                onChange={(e) => handleInputChange('Region', e.target.value)}
              >
                {metadata.regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">LME Steel Scrap (USD)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-1 focus:ring-primary focus:outline-none bg-slate-50"
                value={inputs.LME_Steel_Scrap_USD}
                onChange={(e) => handleInputChange('LME_Steel_Scrap_USD', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">USD to INR</label>
              <input
                type="number"
                step="0.01"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-1 focus:ring-primary focus:outline-none bg-slate-50"
                value={inputs.USD_INR}
                onChange={(e) => handleInputChange('USD_INR', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Domestic Iron Ore (INR)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-1 focus:ring-primary focus:outline-none bg-slate-50"
                value={inputs.Domestic_Iron_Ore_INR}
                onChange={(e) => handleInputChange('Domestic_Iron_Ore_INR', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Domestic Coal (INR)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-1 focus:ring-primary focus:outline-none bg-slate-50"
                value={inputs.Domestic_Coal_INR}
                onChange={(e) => handleInputChange('Domestic_Coal_INR', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Construction Index</label>
              <input
                type="number"
                step="0.1"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-1 focus:ring-primary focus:outline-none bg-slate-50"
                value={inputs.Construction_Index}
                onChange={(e) => handleInputChange('Construction_Index', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monsoon Season Active</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-primary focus:outline-none bg-slate-50"
                value={inputs.Monsoon_Season}
                onChange={(e) => handleInputChange('Monsoon_Season', parseInt(e.target.value))}
              >
                <option value={1}>Yes (1)</option>
                <option value={0}>No (0)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right Col: Output & Comparison */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-150 flex flex-col space-y-5">
          <div>
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5" /> ML Predicted Price
            </h4>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {result ? formatPrice(result.price, currency) : '---'}
              </span>
              <span className="text-xs font-bold text-slate-500 mb-1.5">/ Ton</span>
            </div>
            {result && (
              <p className="text-[10px] font-mono text-slate-400 mt-1">
                Equivalent to {formatPrice(result.price / 1000, currency)} / kg
              </p>
            )}
          </div>

          {/* Breakdown */}
          {result && (
            <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 overflow-y-auto max-h-[160px] custom-scrollbar shadow-3xs">
              <h5 className="text-[9px] font-black uppercase text-slate-400 mb-2 border-b pb-1">Factor Contribution Breakdown</h5>
              <div className="space-y-1.5">
                {Object.entries(result.breakdown).map(([factor, impact]) => (
                  <div key={factor} className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-600 font-medium">{factor}</span>
                    <span className={`font-mono font-bold ${impact >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {impact >= 0 ? '+' : ''}{formatPrice(impact, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Way Comparison */}
          <div className="border-t border-slate-200 pt-4">
            <button
              onClick={handleCompare}
              disabled={isComparing}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1.5 mb-3 disabled:opacity-70"
            >
              {isComparing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              Compare with Current Database Price
            </button>
            
            {dbComparison && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-indigo-800">ML Prediction:</span>
                  <span className="text-[11px] font-mono font-black text-indigo-900">{formatPrice(dbComparison.mlPrice, currency)} / Ton</span>
                </div>
                <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
                  <span className="text-[10px] font-bold text-indigo-800">Current DB Price (scaled to Ton):</span>
                  <span className="text-[11px] font-mono font-black text-indigo-900">
                    {dbComparison.dbPrice !== null ? formatPrice(dbComparison.dbPrice, currency) : 'Not found'} 
                    {dbComparison.dbPrice !== null ? ' / Ton' : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Suggested Average
                  </span>
                  <span className="text-sm font-mono font-black text-indigo-700">{formatPrice(dbComparison.avgPrice, currency)} / Ton</span>
                </div>
                {dbComparison.dbPrice === null && (
                  <p className="text-[9px] text-amber-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Could not find an exact match in the current live database. Using ML model only.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
