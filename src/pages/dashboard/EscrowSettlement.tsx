import { useState } from 'react';
import { 
  ShieldCheck, Clock, CheckCircle2, Lock
} from 'lucide-react';
import clsx from 'clsx';


interface EscrowDeal {
  id: string;
  lotTitle: string;
  totalAmount: number;
  seller: string;
  buyer: string;
  currentStep: number;
  status: 'active' | 'in_inspection' | 'disputed' | 'released';
}

const mockEscrowDeals: EscrowDeal[] = [
  {
    id: 'ESC-2026-0042',
    lotTitle: 'Heavy Industrial Lathe Machine CNC-500',
    totalAmount: 2850000,
    seller: 'Bharat Heavy Engineering Corp',
    buyer: 'Apex Machining Works Pvt Ltd',
    currentStep: 2,
    status: 'in_inspection'
  },
  {
    id: 'ESC-2026-0089',
    lotTitle: 'High Voltage Step-down Transformer 500kVA',
    totalAmount: 1420000,
    seller: 'State Electricity Distribution Co',
    buyer: 'Gujarat Power Systems Ltd',
    currentStep: 3,
    status: 'active'
  }
];

const milestoneSteps = [
  { step: 1, title: 'EMD & Bid Hold', desc: 'Pre-bidding guarantee locked in custodial account' },
  { step: 2, title: 'Physical Inspection', desc: 'Buyer on-site verification & physical quality check' },
  { step: 3, title: 'Gate Pass & Delivery', desc: 'Lot lifting pass issued and signed by plant officer' },
  { step: 4, title: 'Final Settlement', desc: 'Disbursement of funds to seller post completion' },
];

export function EscrowSettlement() {
  const [selectedDeal, setSelectedDeal] = useState<EscrowDeal>(mockEscrowDeals[0]);
  const [inspectionSigned, setInspectionSigned] = useState(false);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Dev Notice */}
      <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 shadow-md shadow-purple-600/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900 text-base sm:text-lg">Smart Escrow & Milestone Settlement</h1>
              <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 text-[10px] font-black uppercase tracking-wider">
                Under Development
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Custodial escrow protection system ensuring secure fund holding until physical asset clearance is verified.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-bold">
            Simulated Sandbox Ledger
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Active Escrow Accounts (1 col) */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Active Custodial Lots ({mockEscrowDeals.length})
          </h2>
          <div className="space-y-3">
            {mockEscrowDeals.map((deal) => (
              <div
                key={deal.id}
                onClick={() => setSelectedDeal(deal)}
                className={clsx(
                  "p-4 rounded-2xl border cursor-pointer transition-all",
                  selectedDeal.id === deal.id 
                    ? "bg-white border-purple-500 shadow-md ring-2 ring-purple-500/20" 
                    : "bg-white border-slate-200 hover:border-slate-300"
                )}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-mono font-bold text-purple-600">{deal.id}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">
                    Stage {deal.currentStep}/4
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{deal.lotTitle}</h3>
                <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-500">Escrow Value</span>
                  <span className="font-mono font-bold text-slate-900">₹{deal.totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Custodial Guarantee</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Funds remain in an RBI-compliant scheduled escrow pool. Neither seller nor buyer can prematurely liquidate funds without verified cryptographic sign-off.
            </p>
          </div>
        </div>

        {/* Right: Milestone Progression View (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-mono font-bold text-purple-600">TRANSACTION: {selectedDeal.id}</span>
                <h3 className="text-lg font-bold text-slate-900">{selectedDeal.lotTitle}</h3>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500">Escrow Amount</span>
                <p className="text-xl font-black text-slate-900 font-mono">
                  ₹{selectedDeal.totalAmount.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Stepper Timeline */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Milestone Clearance Pipeline
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {milestoneSteps.map((m) => {
                  const isCompleted = m.step < selectedDeal.currentStep || (m.step === 2 && inspectionSigned);
                  const isCurrent = m.step === selectedDeal.currentStep && !(m.step === 2 && inspectionSigned);

                  return (
                    <div 
                      key={m.step}
                      className={clsx(
                        "p-4 rounded-xl border flex flex-col justify-between transition-all",
                        isCompleted ? "bg-emerald-50/70 border-emerald-200 text-emerald-950" :
                        isCurrent ? "bg-purple-50 border-purple-300 ring-2 ring-purple-500/20 text-purple-950" :
                        "bg-slate-50 border-slate-200 text-slate-400"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold font-mono">Step 0{m.step}</span>
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : isCurrent ? (
                            <Clock className="w-4 h-4 text-purple-600 animate-spin" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                        <p className="font-bold text-xs leading-snug">{m.title}</p>
                      </div>
                      <p className="text-[11px] mt-2 text-slate-500 line-clamp-2">{m.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current Step Action Sandbox Box */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                    #2
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm">Action Required: Physical Lot Verification</h5>
                    <p className="text-xs text-slate-500">Inspection report ready for digital verification.</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-900 text-xs font-bold">
                  Pending Sign-off
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Inspection Location:</span>
                  <span className="font-medium text-slate-800">Plot 42, GIDC Industrial Estate, Vadodara</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Plant Officer Contact:</span>
                  <span className="font-medium text-slate-800">Rajesh Sharma (+91 98765 43210)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lot Weight Tolerance:</span>
                  <span className="font-medium text-slate-800">Within +/- 2% approved standard</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={() => setInspectionSigned(true)}
                  disabled={inspectionSigned}
                  className={clsx(
                    "w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2",
                    inspectionSigned 
                      ? "bg-emerald-600 text-white cursor-default" 
                      : "bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20"
                  )}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {inspectionSigned ? "Physical Inspection Signed & Verified" : "Simulate Inspection Digital Sign-Off"}
                </button>

                <button 
                  onClick={() => alert("Sandbox: Raised simulated dispute flag to arbitration desk.")}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs transition-colors"
                >
                  Raise Discrepancy Flag
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
