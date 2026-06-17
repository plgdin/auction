// @ts-nocheck
import { useState } from 'react';
import { X, CreditCard, Landmark, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { paymentService } from '../../services/paymentService';
import clsx from 'clsx';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({ isOpen, onClose, onSuccess }: PaymentModalProps) {
  const { user } = useAuthStore();
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<'card' | 'netbanking'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePay = async () => {
    if (!user) return;
    setErrorMsg(null);
    
    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.');
      return;
    }

    setIsProcessing(true);
    
    try {
      const response = await paymentService.processWalletDeposit(user.id, numAmount, method === 'card' ? 'Credit Card' : 'Net Banking');
      if (response.success) {
        onSuccess();
        onClose();
        setAmount('');
      } else {
        setErrorMsg('Payment failed. Please try again.');
      }
    } catch {
      setErrorMsg('An unexpected error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-white/70 backdrop-blur-sm" onClick={!isProcessing ? onClose : undefined} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Add Funds to Wallet</h3>
          <button onClick={onClose} disabled={isProcessing} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {errorMsg && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Deposit Amount (₹)</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 font-bold">₹</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                className="block w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary font-bold text-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">Payment Method</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setMethod('card')}
                className={clsx(
                  "p-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition-all",
                  method === 'card' ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                )}
              >
                <CreditCard className="w-6 h-6" />
                <span className="text-sm font-semibold">Credit Card</span>
              </button>
              <button
                onClick={() => setMethod('netbanking')}
                className={clsx(
                  "p-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition-all",
                  method === 'netbanking' ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                )}
              >
                <Landmark className="w-6 h-6" />
                <span className="text-sm font-semibold">Net Banking</span>
              </button>
            </div>
          </div>

          {/* Dummy Card Info for Visual Polish */}
          {method === 'card' && (
            <div className="space-y-4 pt-2">
              <input type="text" placeholder="Card Number (Mock)" disabled className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500" />
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="MM/YY" disabled className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500" />
                <input type="text" placeholder="CVV" disabled className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500" />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100">
          <button
            onClick={handlePay}
            disabled={isProcessing}
            className="w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-bold rounded-xl text-white bg-primary hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                Pay Securely <CheckCircle2 className="w-5 h-5 ml-2" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
