// @ts-nocheck
import { useEffect, useState } from 'react';
import { Wallet as WalletIcon, Lock, Coins, Plus, Receipt, FileText, Calendar, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { formatPrice } from '../../utils/currency';
import { paymentService } from '../../services/paymentService';
import { PaymentModal } from '../../components/payment/PaymentModal';
import { ReceiptModal } from '../../components/payment/ReceiptModal';
import clsx from 'clsx';

export function Wallet() {
  const { user } = useAuthStore();
  const { currency } = useAppStore();
  const [balance, setBalance] = useState({ available: 0, blocked: 0 });
  const [walletTx, setWalletTx] = useState([]);
  const [emdTx, setEmdTx] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'wallet' | 'emd'>('wallet');
  
  // Modals state
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [receiptType, setReceiptType] = useState<'wallet' | 'emd'>('wallet');

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [bal, wTransactions, eTransactions] = await Promise.all([
        paymentService.getWalletBalance(user.id),
        paymentService.getWalletTransactions(user.id),
        paymentService.getEmdTransactions(user.id)
      ]);
      setBalance(bal);
      setWalletTx(wTransactions);
      setEmdTx(eTransactions);
    } catch (error) {
      console.error('Error loading wallet data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handlePaymentSuccess = () => {
    loadData();
  };

  const openReceipt = (tx: any, type: 'wallet' | 'emd') => {
    setSelectedTx(tx);
    setReceiptType(type);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <WalletIcon className="w-6 h-6 mr-3 text-primary" />
            Wallet & EMD Management
          </h1>
          <p className="text-slate-500 mt-1">Manage virtual funds, earnest money deposits, and view transaction receipts.</p>
        </div>
        <button
          onClick={() => setIsPaymentOpen(true)}
          className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" /> Add Funds
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Available Balance */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Coins className="w-16 h-16 text-primary" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Coins className="w-5 h-5" />
            </div>
            <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Available Balance</h3>
          </div>
          <p className="text-3xl font-extrabold text-slate-950 font-mono">{formatPrice(balance.available, currency)}</p>
          <p className="text-xs text-emerald-600 font-medium mt-2">Ready for bidding & payments</p>
        </div>

        {/* Blocked EMD holds */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Lock className="w-16 h-16 text-primary" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Blocked EMD Holds</h3>
          </div>
          <p className="text-3xl font-extrabold text-slate-950 font-mono">{formatPrice(balance.blocked, currency)}</p>
          <p className="text-xs text-amber-600 font-medium mt-2">Held as guarantee for active bids</p>
        </div>

        {/* Total Wallet Assets */}
        <div className="bg-slate-900 text-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <WalletIcon className="w-16 h-16" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/10 rounded-lg">
              <WalletIcon className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-slate-300 text-sm font-semibold uppercase tracking-wider">Total Ledger Assets</h3>
          </div>
          <p className="text-3xl font-extrabold font-mono">{formatPrice(balance.available + balance.blocked, currency)}</p>
          <p className="text-xs text-slate-400 font-medium mt-2">Overall platform value</p>
        </div>
      </div>

      {/* Transactions & Ledgers Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('wallet')}
            className={clsx(
              "px-6 py-4 text-sm font-semibold transition-colors border-b-2",
              activeTab === 'wallet'
                ? "border-primary text-primary bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            Wallet Transactions Ledger
          </button>
          <button
            onClick={() => setActiveTab('emd')}
            className={clsx(
              "px-6 py-4 text-sm font-semibold transition-colors border-b-2",
              activeTab === 'emd'
                ? "border-primary text-primary bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            EMD Deposits & Holds
          </button>
        </div>

        {/* Content table */}
        <div className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : activeTab === 'wallet' ? (
            walletTx.length === 0 ? (
              <div className="text-center py-16 px-4">
                <WalletIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900">No transaction logs</h3>
                <p className="text-slate-500 mt-1 mb-6">You haven't deposited or withdrawn any wallet funds.</p>
                <button
                  onClick={() => setIsPaymentOpen(true)}
                  className="inline-flex items-center text-primary font-medium hover:underline"
                >
                  Deposit funds <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-6 py-4 font-semibold">Transaction Reference</th>
                      <th className="px-6 py-4 font-semibold">Date</th>
                      <th className="px-6 py-4 font-semibold">Type</th>
                      <th className="px-6 py-4 font-semibold">Amount</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {walletTx.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-mono text-slate-600 font-bold">{tx.reference_id}</span>
                          <span className="block text-xs text-slate-400 mt-0.5">{tx.description}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-slate-650">
                            <Calendar className="w-4 h-4 mr-1.5 text-slate-400" />
                            {new Date(tx.created_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap capitalize">
                          <span className={clsx(
                            "px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide",
                            tx.transaction_type === 'deposit' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                          )}>
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-extrabold text-slate-900 font-mono">{formatPrice(tx.amount, currency)}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={clsx(
                            "px-2.5 py-1 text-xs font-semibold rounded-full capitalize",
                            tx.status === 'completed' ? "bg-green-100 text-green-800" :
                            tx.status === 'pending' ? "bg-amber-150 text-amber-800" : "bg-red-100 text-red-800"
                          )}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => openReceipt(tx, 'wallet')}
                            className="inline-flex items-center text-primary hover:text-primary-700 text-sm font-bold gap-1.5"
                          >
                            <Receipt className="w-4 h-4" /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            emdTx.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Lock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900">No EMD holds</h3>
                <p className="text-slate-500 mt-1">Earnest Money Deposits blocked for auctions will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-6 py-4 font-semibold">EMD Reference</th>
                      <th className="px-6 py-4 font-semibold">Auction Title</th>
                      <th className="px-6 py-4 font-semibold">Date Blocked</th>
                      <th className="px-6 py-4 font-semibold">Blocked Amount</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {emdTx.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-slate-600 font-bold">
                          {tx.transaction_reference}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-900 line-clamp-1 max-w-xs">{tx.auction?.title || 'Unknown Auction'}</p>
                          <span className="text-xs text-slate-400 font-medium font-mono uppercase">REF: {tx.auction?.reference_number || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-slate-650">
                            <Calendar className="w-4 h-4 mr-1.5 text-slate-400" />
                            {new Date(tx.created_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-extrabold text-slate-900 font-mono">{formatPrice(tx.amount, currency)}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={clsx(
                            "px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide",
                            tx.status === 'held' ? "bg-amber-100 text-amber-800" :
                            tx.status === 'released' ? "bg-green-150 text-green-800" : "bg-slate-200 text-slate-650"
                          )}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => openReceipt(tx, 'emd')}
                            className="inline-flex items-center text-primary hover:text-primary-700 text-sm font-bold gap-1.5"
                          >
                            <Receipt className="w-4 h-4" /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      {/* Payment Deposit Modal */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSuccess={handlePaymentSuccess}
      />

      {/* Receipt Preview Modal */}
      <ReceiptModal
        isOpen={selectedTx !== null}
        onClose={() => setSelectedTx(null)}
        transaction={selectedTx}
        type={receiptType}
      />
    </div>
  );
}
