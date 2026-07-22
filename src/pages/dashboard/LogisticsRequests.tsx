import { useState, useEffect } from 'react';
import { logisticsService } from '../../services/logisticsService';
import { useAuthStore } from '../../store/authStore';
import { Truck, Check, X, Search, Clock, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function LogisticsRequests() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, [user]);

  const loadRequests = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await logisticsService.getUserSentRequests(user.id);
      setRequests(data);
    } catch (error) {
      console.error('Failed to load sent requests', error);
      toast.error('Failed to load your logistics requests');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Truck className="w-6 h-6 mr-3 text-primary" />
            My Shipping Requests
          </h1>
          <p className="text-slate-500 mt-1">Track the shipping quotes you've requested from logistics providers.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {requests.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-lg text-slate-900">No requests sent yet</p>
            <p className="text-sm mt-1">Go to the Quote Builder to generate a quote and request shipping.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Provider</th>
                  <th className="px-6 py-4">Items Count</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Provider Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{new Date(req.created_at).toLocaleDateString()}</p>
                      <p className="text-xs text-slate-500">{new Date(req.created_at).toLocaleTimeString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{req.logistics_company}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700 font-semibold">{req.quote_data?.items?.length || 0} items</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide
                        ${req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          req.status === 'responded' ? 'bg-blue-100 text-blue-700' :
                          req.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      {req.logistics_response ? (
                        <p className="text-sm text-slate-700 line-clamp-2" title={req.logistics_response}>
                          {req.logistics_response}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Waiting for response...</p>
                      )}
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
