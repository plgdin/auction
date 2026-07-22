import { useState, useEffect } from 'react';
import { logisticsService } from '../../services/logisticsService';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { formatPrice } from '../../utils/currency';
import { FileText, Eye, Check, X, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function QuoteRequests() {
  const { user } = useAuthStore();
  const { currency } = useAppStore();
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [responseText, setResponseText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [user]);

  const loadRequests = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await logisticsService.getIncomingRequests(user.id);
      setRequests(data);
    } catch (error) {
      console.error('Failed to load quote requests', error);
      toast.error('Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRespond = async (status: 'responded' | 'rejected') => {
    if (!selectedRequest) return;
    if (status === 'responded' && !responseText.trim()) {
      toast.error('Please enter a response/quote details before sending.');
      return;
    }

    setIsSubmitting(true);
    try {
      await logisticsService.respondToRequest(selectedRequest.id, status, responseText);
      toast.success(`Successfully ${status} to request`);
      setSelectedRequest(null);
      setResponseText('');
      loadRequests();
    } catch (error) {
      console.error('Error responding', error);
      toast.error('Failed to send response');
    } finally {
      setIsSubmitting(false);
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
            <FileText className="w-6 h-6 mr-3 text-primary" />
            Incoming Quote Requests
          </h1>
          <p className="text-slate-500 mt-1">Review items users want to transport and provide your shipping quotes.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {requests.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-lg text-slate-900">No requests yet</p>
            <p className="text-sm mt-1">When users request a quote for transportation, it will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Client Name</th>
                  <th className="px-6 py-4">Items</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
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
                      <p className="text-sm font-bold text-slate-900">{req.sender?.first_name} {req.sender?.last_name}</p>
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
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedRequest(req)}
                        className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4 mr-1.5" />
                        View / Respond
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View/Respond Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Quote Request Details</h2>
              <button 
                onClick={() => setSelectedRequest(null)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              {/* Client Note */}
              {selectedRequest.user_note && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Client Note</p>
                  <p className="text-sm font-medium text-amber-900">{selectedRequest.user_note}</p>
                </div>
              )}

              {/* Items to Transport */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3">Items to Transport</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Qty</th>
                        <th className="px-4 py-3 text-right">Value (Approx)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedRequest.quote_data?.items?.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 font-medium text-slate-900">{item.description}</td>
                          <td className="px-4 py-3 text-slate-600">{item.qty} {item.unit}</td>
                          <td className="px-4 py-3 text-right text-slate-700 font-mono">{formatPrice(item.price, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Response Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Your Response / Freight Quote</h3>
                {selectedRequest.status === 'pending' ? (
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Enter your shipping charges, estimated delivery time, and any terms..."
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-medium text-slate-700 resize-none"
                  />
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">
                      {selectedRequest.logistics_response || 'No text response provided.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Close
              </button>
              {selectedRequest.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleRespond('rejected')}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Decline Request
                  </button>
                  <button
                    onClick={() => handleRespond('responded')}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors shadow-md disabled:opacity-50 flex items-center"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Send Quote
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
