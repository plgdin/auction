// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, Activity, Download, Plus, ArrowUpRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { formatPrice, CURRENCIES } from '../../utils/currency';
import { auctionService } from '../../services/auctionService';

export function SellerDashboard() {
  const { user, profile } = useAuthStore();
  const { currency } = useAppStore();
  const [analytics, setAnalytics] = useState({ totalRevenue: 0, activeAuctions: 0, totalBids: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      setIsLoading(true);
      const data = await auctionService.getAuctionAnalytics(user.id);
      setAnalytics(data);
      setIsLoading(false);
    }
    loadData();
  }, [user]);

  const exportReport = () => {
    // Generate simple mock CSV
    const csvContent = "data:text/csv;charset=utf-8,Date,Total Revenue,Active Auctions,Total Bids\n" 
      + `${new Date().toLocaleDateString()},${analytics.totalRevenue},${analytics.activeAuctions},${analytics.totalBids}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "seller_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Welcome Section */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold mb-2">
            Seller Portal
          </h1>
          <p className="text-slate-300 max-w-2xl text-lg">
            Manage your auctions and track your organization's revenue in real-time.
          </p>
        </div>
        <div className="relative z-10 flex gap-4">
          <Link 
            to="/seller/auctions/create"
            className="px-6 py-3 bg-primary hover:bg-primary-600 text-white font-bold rounded-xl flex items-center transition-colors shadow-lg shadow-primary/20"
          >
            <Plus className="w-5 h-5 mr-2" /> Create Auction
          </Link>
          <button 
            onClick={exportReport}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl flex items-center transition-colors"
          >
            <Download className="w-5 h-5 mr-2" /> Export
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center font-bold text-lg font-mono">
              {CURRENCIES[currency]?.symbol || '₹'}
            </div>
          </div>
          <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-1">Total Expected Revenue</h3>
          <p className="text-3xl font-extrabold text-slate-900 flex items-center font-mono">
            {formatPrice(analytics.totalRevenue, currency)}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <Link to="/seller/auctions" className="text-sm font-medium text-primary hover:underline flex items-center">
              Manage <ArrowUpRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-1">Active Auctions</h3>
          <p className="text-3xl font-extrabold text-slate-900">{analytics.activeAuctions}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Gavel className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-1">Total Bids Received</h3>
          <p className="text-3xl font-extrabold text-slate-900">{analytics.totalBids}</p>
        </div>
      </div>
    </div>
  );
}
