import { X, AlertTriangle } from 'lucide-react';
import type { Auction } from '../../types/database.types';
import { useAppStore } from '../../store/appStore';
import { formatPrice } from '../../utils/currency';

interface BidConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  auction: Auction;
  bidAmount: number;
  isSubmitting: boolean;
}

export function BidConfirmationModal({ isOpen, onClose, onConfirm, auction, bidAmount, isSubmitting }: BidConfirmationModalProps) {
  const { currency } = useAppStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-white/70 backdrop-blur-sm transition-opacity"
        onClick={!isSubmitting ? onClose : undefined}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Confirm Your Bid</h3>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6">
          <div className="flex items-start gap-3 p-4 bg-blue-50 text-blue-800 rounded-xl mb-6">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
            <p className="text-sm">
              By placing this bid, you enter a legally binding contract to purchase the asset if you are the highest bidder at the close of the auction.
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Auction</p>
              <p className="text-sm font-semibold text-slate-900">{auction.title}</p>
            </div>
            
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Your Bid Amount</p>
              <p className="text-2xl font-extrabold text-primary font-mono">
                {formatPrice(bidAmount, currency)}
              </p>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary-700 disabled:opacity-50 shadow-sm transition-colors flex items-center"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                Placing Bid...
              </>
            ) : (
              'Confirm Bid'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
