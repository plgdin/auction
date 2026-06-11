// @ts-nocheck
import { X, Printer } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any; // Can be WalletTransaction or EmdTransaction
  type: 'wallet' | 'emd';
}

export function ReceiptModal({ isOpen, onClose, transaction, type }: ReceiptModalProps) {
  const { profile } = useAuthStore();

  if (!isOpen || !transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm print:hidden" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden print:shadow-none print:max-w-none print:rounded-none">
        {/* Modal Header - Hidden on Print */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between print:hidden bg-slate-50">
          <h3 className="text-lg font-bold text-slate-900">Transaction Receipt</h3>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="p-2 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
              <Printer className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Receipt Content */}
        <div className="p-8 print:p-0 bg-white">
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="w-10 h-10 bg-slate-900 text-white rounded flex items-center justify-center font-bold text-xl mb-2">M</div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Auction e-Procurement</h2>
              <p className="text-sm text-slate-500">Official System Generated Receipt</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900 mb-1">RECEIPT</p>
              <p className="text-sm text-slate-500 font-mono">
                {type === 'wallet' ? transaction.reference_id : transaction.transaction_reference || transaction.id.split('-')[0]}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Billed To</p>
              <p className="text-sm font-bold text-slate-900">{profile?.first_name} {profile?.last_name}</p>
              <p className="text-sm text-slate-500">{profile?.organization?.name || 'Independent Buyer'}</p>
              <p className="text-sm text-slate-500">{profile?.email}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date Issued</p>
              <p className="text-sm font-bold text-slate-900 mb-4">{new Date(transaction.created_at).toLocaleString()}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
              <p className="text-sm font-bold text-green-600 uppercase">{transaction.status}</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden mb-8">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-4 text-sm text-slate-900">
                    {type === 'wallet' ? transaction.description || `Wallet ${transaction.transaction_type}` : `EMD Block for Auction REF: ${transaction.auction?.reference_number}`}
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-slate-900 text-right">
                    ₹{transaction.amount.toLocaleString()}
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">Total Amount</td>
                  <td className="px-4 py-3 text-lg font-extrabold text-primary text-right">
                    ₹{transaction.amount.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="text-center text-xs text-slate-400 mt-12 pt-6 border-t border-slate-100">
            <p>This is a computer-generated receipt and does not require a physical signature.</p>
            <p>For support, contact billing@auction-platform.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
