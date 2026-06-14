// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Gavel, Trophy, Heart, ArrowRight, Activity, 
  TrendingUp, IndianRupee
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { useAuthStore } from '../store/authStore';
import { auctionService } from '../services/auctionService';

// Removed static chartData

export function Dashboard() {
  const { user, profile } = useAuthStore();
  const [stats, setStats] = useState({
    activeBids: 0,
    wonAuctions: 0,
    interestedAuctions: 0
  });
  const [recentBids, setRecentBids] = useState<any[]>([]);
  const [dynamicChartData, setDynamicChartData] = useState<{name: string, bids: number}[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      if (!user) return;
      setIsLoading(true);

      const [bids, wonData, watchlistIds] = await Promise.all([
        auctionService.getUserBids(user.id),
        auctionService.getWonAuctions(user.id),
        auctionService.getUserWatchlistIds(user.id)
      ]);

      const activeBids = bids.filter(b => b.auction.status === 'active').length;

      setStats({
        activeBids,
        wonAuctions: wonData.length,
        interestedAuctions: watchlistIds.length
      });
      
      // Top 3 most recent bids
      setRecentBids(bids.slice(0, 3));

      // Process bids for chart data (last 6 months)
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date();
      const newChartData = [];
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = months[d.getMonth()];
        const count = bids.filter(b => {
          const bd = new Date(b.created_at);
          return bd.getMonth() === d.getMonth() && bd.getFullYear() === d.getFullYear();
        }).length;
        newChartData.push({ name: monthName, bids: count });
      }
      setDynamicChartData(newChartData);

      setIsLoading(false);
    }
    loadDashboardData();
  }, [user]);

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
      <div className="bg-foreground rounded-lg p-8 text-white relative overflow-hidden shadow">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-transparent"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold mb-2">
            Welcome back, {profile?.first_name || 'User'}
          </h1>
          <p className="text-slate-300 max-w-2xl text-lg">
            Here is your bidding overview. You have {stats.activeBids} active bids across the marketplace.
          </p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded bg-primary/10 text-primary flex items-center justify-center">
              <Gavel className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-green-600 flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" /> +2
            </span>
          </div>
          <h3 className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-1">Ongoing Bids</h3>
          <p className="text-3xl font-extrabold text-foreground">{stats.activeBids}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded bg-green-50 text-green-600 flex items-center justify-center">
              <Trophy className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-1">Won Auctions</h3>
          <p className="text-3xl font-extrabold text-foreground">{stats.wonAuctions}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded bg-red-50 text-red-650 flex items-center justify-center">
              <Heart className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-1">Interested Auctions</h3>
          <p className="text-3xl font-extrabold text-foreground">{stats.interestedAuctions}</p>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground flex items-center">
              <Activity className="w-5 h-5 mr-2 text-primary" />
              Bidding Activity Overview
            </h2>
            <select className="bg-muted border border-border text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary">
              <option>Last 6 Months</option>
              <option>This Year</option>
            </select>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBids" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#004ac6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#004ac6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--muted-foreground)', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--muted-foreground)', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                />
                <Area type="monotone" dataKey="bids" stroke="#004ac6" strokeWidth={3} fillOpacity={1} fill="url(#colorBids)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Recent Bids */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-border p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Recent Bids</h2>
            <Link to="/dashboard/bids" className="text-primary text-sm font-medium hover:underline">View All</Link>
          </div>

          <div className="flex-grow flex flex-col">
            {recentBids.length === 0 ? (
              <div className="flex-grow flex flex-col items-center justify-center text-muted-foreground py-8">
                <Gavel className="w-10 h-10 mb-3 text-muted-foreground/50" />
                <p>No recent bidding activity.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border flex-grow">
                {recentBids.map((bid) => (
                  <li key={bid.id} className="py-4">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-bold text-foreground line-clamp-1 mr-4">{bid.auction.title}</h4>
                      <span className="text-sm font-bold text-primary shrink-0">₹{bid.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">REF: {bid.auction.reference_number}</span>
                      <span className="text-muted-foreground/80">{new Date(bid.created_at).toLocaleDateString()}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <Link 
            to="/auctions"
            className="mt-4 w-full flex justify-center items-center py-3 border border-dashed border-border rounded text-muted-foreground font-medium hover:border-primary hover:text-primary transition-colors"
          >
            Find more auctions <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>
    </div>
  );
}
