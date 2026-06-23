import { useState } from 'react';
import { Sparkles, MapPin, Shield, CreditCard, ChevronRight, Check } from 'lucide-react';
import type { UserPreference } from '../../services/recommendationService';

interface PreferenceQuestionnaireModalProps {
  isOpen: boolean;
  onSave: (prefs: UserPreference) => Promise<void>;
}

const INDIAN_STATES = [
  'Maharashtra', 'Kerala', 'Tamil Nadu', 'Delhi', 'Karnataka', 
  'West Bengal', 'Gujarat', 'Uttar Pradesh', 'Rajasthan'
];

const CATEGORIES = [
  { id: 'scrap & scrap material', label: 'Scrap Metal & Surplus' },
  { id: 'plant & machinery', label: 'Plant & Machineries' },
  { id: 'vehicles', label: 'Transport Vehicles' },
  { id: 'real estate', label: 'Immovable Real Estate' },
  { id: 'e-waste', label: 'E-Waste & Electronics' },
  { id: 'minerals & ores', label: 'Minerals & Ores' }
];

const BUDGET_OPTIONS = [
  { value: 500000, label: 'Under 5 Lakhs' },
  { value: 2500000, label: '5 - 25 Lakhs' },
  { value: 10000000, label: '25 Lakhs - 1 Crore' },
  { value: 50000000, label: 'Over 1 Crore' }
];

export function PreferenceQuestionnaireModal({ isOpen, onSave }: PreferenceQuestionnaireModalProps) {
  const [step, setStep] = useState(1);
  const [selectedCats, setSelectedCats] = useState<string[]>(['scrap & scrap material']);
  const [selectedLocs, setSelectedLocs] = useState<string[]>(['Maharashtra', 'Delhi']);
  const [budget, setBudget] = useState<number>(2500000);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleCategory = (id: string) => {
    setSelectedCats(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleLocation = (state: string) => {
    setSelectedLocs(prev => 
      prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
    );
  };

  const handleNext = async () => {
    if (step < 4) {
      setStep(prev => prev + 1);
    } else {
      const preferences: UserPreference = {
        categories: selectedCats,
        locations: selectedLocs,
        maxBudget: budget,
        riskLevel: risk
      };
      setIsSaving(true);
      setSaveError(null);
      try {
        await onSave(preferences);
      } catch {
        setSaveError('Could not save your recommendation profile. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col transform transition-all">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-6 text-white relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles className="w-24 h-24" />
          </div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
            Configure Your eAuctions Feed
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            Let us customize your B2B auction recommendations based on your preferences.
          </p>
          
          {/* Progress bar */}
          <div className="w-full bg-blue-900/40 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className="bg-yellow-400 h-full transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 flex-grow min-h-[280px]">
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">What materials are you looking to buy?</h3>
                  <p className="text-xs text-slate-500">Select all categories that interest you</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {CATEGORIES.map(cat => {
                  const isSelected = selectedCats.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-left text-sm font-medium transition-all ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-500/20' 
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/30'
                      }`}
                    >
                      <span>{cat.label}</span>
                      {isSelected ? (
                        <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-300" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Select regions or states of interest</h3>
                  <p className="text-xs text-slate-500">Find auctions closer to your logistics hubs</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 pt-2">
                {INDIAN_STATES.map(state => {
                  const isSelected = selectedLocs.includes(state);
                  return (
                    <button
                      key={state}
                      onClick={() => toggleLocation(state)}
                      className={`py-2.5 px-3 rounded-lg border text-center text-xs font-semibold transition-all ${
                        isSelected 
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900' 
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/30'
                      }`}
                    >
                      {state}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Select your bidding budget tier</h3>
                  <p className="text-xs text-slate-500">Filters target auctions matching your budget limits</p>
                </div>
              </div>
              
              <div className="space-y-3 pt-2">
                {BUDGET_OPTIONS.map(opt => {
                  const isSelected = budget === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setBudget(opt.value)}
                      className={`flex items-center justify-between w-full p-4 rounded-xl border text-left text-sm font-semibold transition-all ${
                        isSelected 
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20' 
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/30'
                      }`}
                    >
                      <span>{opt.label}</span>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">What is your bidding risk tolerance?</h3>
                  <p className="text-xs text-slate-500">Risk matches material inspection state & volume</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-3 pt-2">
                {(['low', 'medium', 'high'] as const).map(level => {
                  const isSelected = risk === level;
                  const desc = level === 'low' 
                    ? 'Prefer verified catalogs, public undertakings, low-variability materials.' 
                    : level === 'medium' 
                      ? 'Balanced mix of public auctions, standard lot descriptions, and machinery.'
                      : 'High-yield salvage material, mixed open lots, and uninspected items.';
                  return (
                    <button
                      key={level}
                      onClick={() => setRisk(level)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        isSelected 
                          ? 'border-amber-600 bg-amber-50/55 text-slate-900 ring-2 ring-amber-500/20' 
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/30'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold capitalize text-sm">{level} Risk Preference</span>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-amber-600 bg-amber-600' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 font-normal leading-relaxed">{desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-t border-slate-100">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className={`text-sm font-semibold px-4 py-2 rounded-lg border border-slate-200 transition-all ${
              step === 1 
                ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400' 
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            Back
          </button>
          
          <button
            onClick={handleNext}
            disabled={isSaving || (step === 1 && selectedCats.length === 0)}
            className={`text-sm font-semibold px-5 py-2.5 rounded-lg bg-blue-700 text-white hover:bg-blue-800 flex items-center gap-1.5 shadow-sm transition-all ${
              step === 1 && selectedCats.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSaving ? 'Saving...' : step === 4 ? 'Save & Build Feed' : 'Continue'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {saveError && (
          <div className="px-6 pb-4 bg-slate-50 text-sm text-red-600" role="alert">{saveError}</div>
        )}
      </div>
    </div>
  );
}
