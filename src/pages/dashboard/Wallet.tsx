// @ts-nocheck
import { useEffect, useState } from 'react';
import { Wallet as WalletIcon, IndianRupee, ArrowUpRight, ArrowDownRight, ShieldAlert, History } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { paymentService } from '../../services/paymentService';
import { PaymentModal } from '../../components/payment/PaymentModal';
import { ReceiptModal } from '../../components/payment/ReceiptModal';
import type { WalletTransaction, EmdTransaction } from '../../types/database.types';
import clsx from 'clsx';

export function Wallet() {
  const { user } = useAuthStore();
  const [balance, setBalance] = useState({ available: 0, blocked: 0 });
  const [walletTx, setWalletTx] = useState<WalletTransaction[]>([]);
  const [emdTx, setEmdTx] = useState<EmdTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'wallet' | 'emd'>('wallet');
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<{ transaction: any, type: 'wallet'|'emd' } | null>(null);

  const loadWallet = async () => {
    if (!user) return;
    setIsLoading(true);
      
      const [bal, wTx, eTx] = await Promise.all([
        paymentService.getWalletBalance(user.id),
        paymentService.getWalletTransactions(user.id),
        paymentService.getEmdTransactions(user.id)
      ]);
      
      setBalance(bal);
      setWalletTx(wTx);
      setEmdTx(eTx);
      setIsLoading(false);
  };

  useEffect(() => {
    loadWallet();
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Wallet & EMD Ledger</h1>
          <p className="text-slate-500">Manage your deposits, withdrawals, and active EMD holds.</p>
        </div>
        <button 
          onClick={() => setIsPaymentModalOpen(true)}
          className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm flex items-center"
        >
          <WalletIcon className="w-5 h-5 mr-2" />
          Add Funds
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Available Balance</p>
            <p className="text-3xl font-extrabold text-slate-900 flex items-center">
              <IndianRupee className="w-7 h-7 mr-1 text-slate-400" />
              {balance.available.toLocaleString()}
            </p>
          </div>
          <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center">
            <WalletIcon className="w-7 h-7 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Blocked EMD</p>
            <p className="text-3xl font-extrabold text-slate-900 flex items-center">
              <IndianRupee className="w-7 h-7 mr-1 text-slate-400" />
              {balance.blocked.toLocaleString()}
            </p>
          </div>
          <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-orange-600" />
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 p-6 flex items-center justify-between text-white">
          <div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Total Ledger Value</p>
            <p className="text-3xl font-extrabold flex items-center">
              <IndianRupee className="w-7 h-7 mr-1 text-slate-500" />
              {(balance.available + balance.blocked).toLocaleString()}
            </p>
          </div>
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
            <History className="w-7 h-7 text-white" />
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('wallet')}
            className={clsx(
              "px-6 py-4 text-sm font-semibold capitalize transition-colors border-b-2",
              activeTab === 'wallet'
                ? "border-primary text-primary bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            Deposit & Withdrawal History
          </button>
          <button
            onClick={() => setActiveTab('emd')}
            className={clsx(
              "px-6 py-4 text-sm font-semibold capitalize transition-colors border-b-2",
              activeTab === 'emd'
                ? "border-primary text-primary bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            EMD Blocks & Refunds
          </button>
        </div>

        <div className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-sm uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Transaction ID</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold">Amount</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeTab === 'wallet' && (
                    walletTx.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                          No wallet transactions found.
                        </td>
                      </tr>
                    ) : (
                      walletTx.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {new Date(tx.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600">
                            {tx.id.split('-')[0]}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="flex items-center text-sm font-medium text-slate-900 capitalize">
                              {tx.transaction_type === 'deposit' ? (
                                <ArrowDownRight className="w-4 h-4 mr-1.5 text-green-500" />
                              ) : (
                                <ArrowUpRight className="w-4 h-4 mr-1.5 text-red-500" />
                              )}
                              {tx.transaction_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                            {tx.transaction_type === 'deposit' ? '+' : '-'} ₹{tx.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={clsx(
                              "px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide",
                              tx.status === 'completed' ? "bg-green-100 text-green-700" :
                              tx.status === 'pending' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                            )}>
                              {tx.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            {tx.status === 'completed' && (
                              <button 
                                onClick={() => setReceiptData({ transaction: tx, type: 'wallet' })}
                                className="text-primary hover:text-primary-700 text-sm font-medium"
                              >
                                Receipt
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )
                  )}

                  {activeTab === 'emd' && (
                    emdTx.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                          No EMD transactions found.
                        </td>
                      </tr>
                    ) : (
                      emdTx.map((tx: any) => (
                        <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {new Date(tx.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                            <div className="font-medium text-primary">{tx.auction?.reference_number}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[200px]">{tx.auction?.title}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="flex items-center text-sm font-medium text-slate-900 capitalize">
                              <ShieldAlert className="w-4 h-4 mr-1.5 text-orange-500" />
                              Hold
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                            ₹{tx.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={clsx(
                              "px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide",
                              tx.status === 'held' ? "bg-orange-100 text-orange-700" :
                              tx.status === 'refunded' ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
                            )}>
                              {tx.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button 
                              onClick={() => setReceiptData({ transaction: tx, type: 'emd' })}
                              className="text-primary hover:text-primary-700 text-sm font-medium"
                            >
                              Receipt
                            </button>
                          </td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <PaymentModal 
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => {
          setIsPaymentModalOpen(false);
          loadWallet();
        }}
      />

      {receiptData && (
        <ReceiptModal
          isOpen={!!receiptData}
          onClose={() => setReceiptData(null)}
          transaction={receiptData.transaction}
          type={receiptData.type}
        />
      )}
    </div>
  );
}
