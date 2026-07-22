import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { logisticsService } from '../../services/logisticsService';
import { useAuthStore } from '../../store/authStore';
import { Link } from 'react-router-dom';

export function LogisticsDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    pending: 0,
    responded: 0,
    rejected: 0,
    completed: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      try {
        const requests = await logisticsService.getIncomingRequests(user.id);
        const counts = {
          pending: requests.filter(r => r.status === 'pending').length,
          responded: requests.filter(r => r.status === 'responded').length,
          rejected: requests.filter(r => r.status === 'rejected').length,
          completed: requests.filter(r => r.status === 'completed').length,
        };
        setStats(counts);
      } catch (error) {
        console.error('Failed to load logistics stats', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const statCards = [
    { label: 'Pending Requests', value: stats.pending, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Quotes Responded', value: stats.responded, icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Completed Jobs', value: stats.completed, icon: Package, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-50' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Logistics Overview</h1>
        <p className="text-slate-500 mt-1">Manage your incoming transport quote requests.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-500">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg}`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
        <h3 className="text-lg font-bold text-slate-900">Ready for more business?</h3>
        <p className="text-slate-500 mt-2 mb-6 max-w-lg mx-auto">Make sure your profile is fully updated with your service areas and vehicle fleet so users can find you.</p>
        <div className="flex justify-center gap-4">
           <Link to="/logistics/profile" className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors">
             Update Profile
           </Link>
           <Link to="/logistics/requests" className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-colors">
             View Requests
           </Link>
        </div>
      </div>
    </div>
  );
}
