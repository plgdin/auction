// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, ArrowRight, Clock, IndianRupee, Eye, Users } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { auctionService } from '../../services/auctionService';
import type { Auction } from '../../types/database.types';
import clsx from 'clsx';

export function ManageAuctions() {
  const { user } = useAuthStore();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAuctions() {
      if (!user) return;
      setIsLoading(true);
      const data = await auctionService.getAuctionsBySeller(user.id);
      setAuctions(data);
      setIsLoading(false);
    }
    loadAuctions();
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <FileText className="w-6 h-6 mr-3 text-primary" />
            Manage Auctions
          </h1>
          <p className="text-slate-500 mt-1">Create and manage your organization's auction listings.</p>
        </div>
        <Link 
          to="/seller/auctions/create"
          className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create New
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-20 bg-slate-50">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No auctions created yet</h3>
            <p className="text-slate-500 mt-1">Start by creating your first auction listing.</p>
            <Link to="/seller/auctions/create" className="mt-6 inline-block px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors">
              Create Auction
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4 font-semibold">Title</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Starting Price</th>
                  <th className="px-6 py-4 font-semibold">End Time</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auctions.map((auction) => (
                  <tr key={auction.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900 line-clamp-1 max-w-xs">{auction.title}</p>
                      <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-mono">ID: {auction.id.split('-')[0]}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx(
                        "px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide",
                        auction.status === 'active' ? "bg-green-100 text-green-700" :
                        auction.status === 'published' ? "bg-blue-100 text-blue-700" :
                        auction.status === 'closed' ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {auction.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center font-bold text-slate-900">
                        <IndianRupee className="w-4 h-4 mr-0.5 text-slate-400" />
                        {auction.starting_price.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-slate-600">
                        <Clock className="w-4 h-4 mr-1.5 text-slate-400" />
                        {new Date(auction.end_time).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex justify-end items-center gap-3">
                        <Link 
                          to={`/auctions/${auction.id}`}
                          className="text-slate-500 hover:text-primary transition-colors flex items-center"
                          title="View Live Page"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {auction.status === 'active' && (
                          <Link 
                            to={`/seller/auctions/${auction.id}/bidders`}
                            className="text-slate-500 hover:text-primary transition-colors flex items-center"
                            title="Manage Bidders"
                          >
                            <Users className="w-4 h-4" />
                          </Link>
                        )}
                        <Link 
                          to={`/seller/auctions/${auction.id}/edit`}
                          className="text-primary hover:text-primary-700 font-bold ml-2"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
