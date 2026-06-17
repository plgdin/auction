// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Calendar, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { formatPrice } from '../../utils/currency';
import { tenderService } from '../../services/tenderService';
import clsx from 'clsx';

function TenderRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4 space-y-2">
        <div className="h-3 bg-slate-200 rounded w-20" />
        <div className="h-4 bg-slate-250 rounded w-40" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-slate-200 rounded w-24" />
      </td>
      <td className="px-6 py-4 space-y-1">
        <div className="h-4 bg-slate-200 rounded w-20" />
        <div className="h-3 bg-slate-150 rounded w-12" />
      </td>
      <td className="px-6 py-4">
        <div className="h-6 bg-slate-200 rounded w-24" />
      </td>
      <td className="px-6 py-4 text-right">
        <div className="h-4 bg-slate-200 rounded w-10 ml-auto" />
      </td>
    </tr>
  );
}

export function MyTenders() {
  const { user } = useAuthStore();
  const { currency } = useAppStore();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSubmissions() {
      if (!user) return;
      setIsLoading(true);
      const data = await tenderService.getUserTenderSubmissions(user.id);
      setSubmissions(data);
      setIsLoading(false);
    }
    loadSubmissions();
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <FileText className="w-6 h-6 mr-3 text-primary" />
            My Tender Submissions
          </h1>
          <p className="text-slate-500 mt-1">Track the status of your technical and financial bids.</p>
        </div>
        <Link 
          to="/tenders"
          className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm flex items-center"
        >
          Browse Tenders
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4 font-semibold">Tender Details</th>
                  <th className="px-6 py-4 font-semibold">Submission Date</th>
                  <th className="px-6 py-4 font-semibold">Your Bid</th>
                  <th className="px-6 py-4 font-semibold">Tender Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...Array(3)].map((_, i) => (
                  <TenderRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-20 bg-slate-50">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No submissions yet</h3>
            <p className="text-slate-500 mt-1">You haven't participated in any e-Tenders.</p>
            <Link to="/tenders" className="mt-6 inline-block px-6 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50">
              Find Tenders
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4 font-semibold">Tender Details</th>
                  <th className="px-6 py-4 font-semibold">Submission Date</th>
                  <th className="px-6 py-4 font-semibold">Your Bid</th>
                  <th className="px-6 py-4 font-semibold">Tender Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-500 font-mono">REF: {sub.tender.reference_number}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 line-clamp-1 max-w-xs">{sub.tender.title}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-slate-600">
                        <Calendar className="w-4 h-4 mr-1.5 text-slate-400" />
                        {new Date(sub.submitted_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center font-bold text-slate-900 font-mono">
                        {sub.financial_bid ? formatPrice(sub.financial_bid, currency) : 'N/A'}
                      </div>
                      <span className="text-xs text-slate-500 uppercase">Financial</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx(
                        "px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide",
                        sub.tender.status === 'open' ? "bg-green-100 text-green-700" :
                        sub.tender.status === 'under_evaluation' ? "bg-amber-100 text-amber-700" :
                        sub.tender.status === 'awarded' ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
                      )}>
                        {sub.tender.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link 
                        to={`/tenders/${sub.tender_id}`}
                        className="inline-flex items-center text-primary hover:text-primary-700 text-sm font-bold"
                      >
                        View <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
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
