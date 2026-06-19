// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Gavel, Trophy, Heart, ArrowRight, Activity, 
  TrendingUp, Sparkles, MapPin, Shield, CreditCard,
  Sliders, AlertTriangle, HelpCircle, CheckCircle,
  ChevronRight
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { formatPrice } from '../utils/currency';
import { auctionService } from '../services/auctionService';
import { dashboardService } from '../services/dashboardService';
import { recommendationService } from '../services/recommendationService';
import type { UserPreference, RankedAuction } from '../services/recommendationService';
import { PreferenceQuestionnaireModal } from '../components/dashboard/PreferenceQuestionnaireModal';

export function Dashboard() {
  const { user, profile } = useAuthStore();
  const { currency } = useAppStore();
  const [stats, setStats] = useState({
    activeBids: 0,
    wonAuctions: 0,
    interestedAuctions: 0
  });
  const [recentBids, setRecentBids] = useState<any[]>([]);
  const [dynamicChartData, setDynamicChartData] = useState<{name: string, bids: number}[]>([]);
  
  // Recommendation System States
  const [recommendedAuctions, setRecommendedAuctions] = useState<any[]>([]);
  const [rankedAuctions, setRankedAuctions] = useState<RankedAuction[]>([]);
  const [userPrefs, setUserPrefs] = useState<UserPreference | null>(null);
  const [isQuestionnaireOpen, setIsQuestionnaireOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [interestedIds, setInterestedIds] = useState<string[]>([]);

  const loadDashboardAndRecs = async (userId: string) => {
    try {
      const [bids, wonData, dbWatchlist] = await Promise.all([
        auctionService.getUserBids(userId),
        auctionService.getWonAuctions(userId),
        auctionService.getUserWatchlistIds(userId)
      ]);

      const activeBids = bids.filter(b => b.auction.status === 'active').length;
      const mstcInterested = dashboardService.getInterestedAuctions(userId);
      const allInterested = Array.from(new Set([...mstcInterested, ...dbWatchlist]));

      setStats({
        activeBids,
        wonAuctions: wonData.length,
        interestedAuctions: allInterested.length
      });
      
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

      // Load preferences and recommendations
      const prefs = recommendationService.getUserPreferences(userId);
      setUserPrefs(prefs);
      setInterestedIds(allInterested);

      // If preferences are not configured and questionnaire was never completed/dismissed, trigger questionnaire for onboarding
      const hasCompletedQuestionnaire = localStorage.getItem(`usr_questionnaire_completed_${userId}`);
      if (!prefs && !hasCompletedQuestionnaire) {
        setIsQuestionnaireOpen(true);
      }

      // Load recommended and ranked yield auctions
      const recs = await recommendationService.getRecommendedAuctions(userId, 4);
      const ranked = await recommendationService.getRankedAuctions(userId);
      setRecommendedAuctions(recs);
      setRankedAuctions(ranked);

    } catch (err) {
      console.error('Error loading dashboard & recommendation data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    loadDashboardAndRecs(user.id);
  }, [user]);

  const handleSavePreferences = (prefs: UserPreference) => {
    if (!user) return;
    recommendationService.saveUserPreferences(user.id, prefs);
    localStorage.setItem(`usr_questionnaire_completed_${user.id}`, 'true');
    setUserPrefs(prefs);
    setIsQuestionnaireOpen(false);
    setIsLoading(true);
    loadDashboardAndRecs(user.id);
  };

  const handleCloseQuestionnaire = () => {
    if (user) {
      localStorage.setItem(`usr_questionnaire_completed_${user.id}`, 'true');
    }
    setIsQuestionnaireOpen(false);
  };

  const handleToggleWatchlist = async (auctionId: string) => {
    if (!user) return;
    dashboardService.toggleInterestedAuction(user.id, auctionId);
    
    // Refresh stats and updates
    const mstcInterested = dashboardService.getInterestedAuctions(user.id);
    const dbWatchlist = await auctionService.getUserWatchlistIds(user.id);
    const allInterested = Array.from(new Set([...mstcInterested, ...dbWatchlist]));
    setInterestedIds(allInterested);
    
    setStats(prev => ({
      ...prev,
      interestedAuctions: allInterested.length
    }));

    // Toggle in Supabase in background ONLY if not MSTC
    const isMstc = recommendedAuctions.some(a => a.id === auctionId && a.is_mstc) ||
                    rankedAuctions.some(a => a.id === auctionId && a.isMstc);
    if (!isMstc) {
      try {
        await auctionService.toggleWatchlist(user.id, auctionId);
      } catch (e) {
        console.error('Failed to toggle Supabase watchlist', e);
      }
    }

    // Refresh recommendations list and yield ranks
    const recs = await recommendationService.getRecommendedAuctions(user.id, 4);
    const ranked = await recommendationService.getRankedAuctions(user.id);
    setRecommendedAuctions(recs);
    setRankedAuctions(ranked);
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
      <div className="bg-foreground rounded-lg p-8 text-white relative overflow-hidden shadow">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-transparent"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold mb-2">
              Welcome back, {profile?.first_name || 'User'}
            </h1>
            <p className="text-slate-300 max-w-2xl text-lg">
              Here is your bidding overview. You have {stats.activeBids} active bids across the marketplace.
            </p>
          </div>
          <button
            onClick={() => setIsQuestionnaireOpen(true)}
            className="self-start md:self-auto bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 border border-blue-600 transition-colors shadow-sm cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
            Adjust Feed Preferences
          </button>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Link 
          to="/dashboard/bids"
          className="block bg-white p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
              <Gavel className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-green-600 flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" /> +2
            </span>
          </div>
          <h3 className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-1 group-hover:text-primary transition-colors">Ongoing Bids</h3>
          <p className="text-3xl font-extrabold text-foreground">{stats.activeBids}</p>
        </Link>

        <Link 
          to="/dashboard/bids"
          className="block bg-white p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded bg-green-50 text-green-600 flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
              <Trophy className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-1 group-hover:text-green-600 transition-colors">Won Auctions</h3>
          <p className="text-3xl font-extrabold text-foreground">{stats.wonAuctions}</p>
        </Link>

        <Link 
          to="/dashboard/interested"
          className="block bg-white p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded bg-red-50 text-red-600 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors">
              <Heart className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-1 group-hover:text-red-500 transition-colors">Interested Auctions</h3>
          <p className="text-3xl font-extrabold text-foreground">{stats.interestedAuctions}</p>
        </Link>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (spans 2) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Chart Section */}
          <div className="bg-white rounded-lg shadow-sm border border-border p-6">
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
            
            <div className="h-[260px] w-full">
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

          {/* Recommended Auctions Feed */}
          <div className="bg-white rounded-lg shadow-sm border border-border p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  Suggested For You
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Personalized eAuctions matching your questionnaire profile, watchlist overlaps, and active B2B keywords.
                </p>
              </div>
              <Link to="/auctions" className="text-primary text-xs font-semibold hover:underline flex items-center gap-1">
                Browse all
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recommendedAuctions.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-500">
                <Sparkles className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold">No recommendations found</p>
                <p className="text-xs text-slate-400 mt-1">Try updating your preferences or bookmarking more auctions to seed the engine.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendedAuctions.map(auc => {
                  const isWatched = interestedIds.includes(auc.id);
                  // Calculate category badge matching preference
                  const matchesPref = userPrefs?.categories.some(c => 
                    (auc.category?.name || '').toLowerCase().includes(c.toLowerCase())
                  );
                  const matchesLoc = userPrefs?.locations.some(l => 
                    (auc.location || '').toLowerCase().includes(l.toLowerCase())
                  );

                  return (
                    <div 
                      key={auc.id} 
                      className="bg-white border border-slate-150 hover:border-blue-400 rounded-xl p-5 hover:shadow-xs transition-all relative flex flex-col justify-between"
                    >
                      <div>
                        {/* Match Tags */}
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {matchesPref && (
                            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100 flex items-center gap-0.5">
                              <CheckCircle className="w-3 h-3 text-blue-500" /> Category Match
                            </span>
                          )}
                          {matchesLoc && (
                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100 flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-indigo-500" /> Near You
                            </span>
                          )}
                          {!matchesPref && !matchesLoc && (
                            <span className="text-[10px] font-bold bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full border border-slate-100">
                              Trending
                            </span>
                          )}
                        </div>

                        <div className="flex justify-between items-start gap-4">
                          <h4 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug">
                            {auc.title}
                          </h4>
                          <button
                            onClick={() => handleToggleWatchlist(auc.id)}
                            className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
                              isWatched 
                                ? 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100' 
                                : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-red-500 hover:bg-red-50/50'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${isWatched ? 'fill-current' : ''}`} />
                          </button>
                        </div>

                        <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                          <div className="flex justify-between">
                            <span>Starting Price:</span>
                            <span className="font-bold text-slate-800">{formatPrice(auc.starting_price, currency)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>State:</span>
                            <span className="font-medium text-slate-700">{auc.location || 'India'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Ends On:</span>
                            <span className="font-semibold text-slate-700">{new Date(auc.end_time).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-[10px] font-mono text-slate-400">REF: {auc.reference_number || 'N/A'}</span>
                        <Link 
                          to={`/auctions?tab=${auc.is_mstc ? 'mstc' : 'commercial'}${auc.is_mstc ? `&preview=${auc.id}` : ''}`} 
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                        >
                          Analyze
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          
          {/* Yield Ranking Comparison Analyzer */}
          <div className="bg-white rounded-lg shadow-sm border border-border p-6 flex flex-col">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Profitability & Risk Ranker
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Yield analysis comparing suggested and bookmarked auctions. Ranked high to low profitability.
              </p>
            </div>

            {rankedAuctions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                Add items to watchlist or set preferences to view yield comparison.
              </div>
            ) : (
              <div className="space-y-4">
                {rankedAuctions.map((item, index) => (
                  <div 
                    key={`${item.id}-${index}`} 
                    className="border border-slate-150 rounded-xl p-3.5 space-y-3 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-1">
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase ${
                          item.isRecommended 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-red-50 text-red-700 border border-red-100'
                        }`}>
                          {item.isRecommended ? 'Suggested' : 'Watchlist'}
                        </span>
                        <Link to={`/auctions?tab=${item.isMstc ? 'mstc' : 'commercial'}${item.isMstc ? `&preview=${item.id}` : ''}`}>
                          <h4 className="text-xs font-bold text-slate-800 hover:text-blue-600 line-clamp-1 mt-1 leading-tight cursor-pointer">
                            {item.title}
                          </h4>
                        </Link>
                      </div>
                      <span className="text-xs font-extrabold text-emerald-700 shrink-0 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                        {item.profitability}% ROI
                      </span>
                    </div>

                    {/* Progress yield indicator bar */}
                    <div className="space-y-1">
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-600 h-full rounded-full"
                          style={{ width: `${(item.profitability / 30) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-100/60">
                      <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3 text-slate-400" />
                        <span>Risk:</span>
                        <span className={`font-bold ${
                          item.riskLevel === 'Low' 
                            ? 'text-green-600' 
                            : item.riskLevel === 'Medium' 
                              ? 'text-yellow-600' 
                              : 'text-red-500'
                        }`}>
                          {item.riskLevel} ({item.riskScore}/10)
                        </span>
                      </div>
                      <span className="font-medium text-slate-600">{item.location}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Bids Section */}
          <div className="bg-white rounded-lg shadow-sm border border-border p-6 flex flex-col">
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
                        <span className="text-sm font-bold text-primary shrink-0 font-mono">{formatPrice(bid.amount, currency)}</span>
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
              className="mt-4 w-full flex justify-center items-center py-3 border border-dashed border-border rounded text-muted-foreground font-medium hover:border-primary hover:text-primary transition-colors animate-pulse"
            >
              Find more auctions <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </div>

      {/* Onboarding Preference Questionnaire Modal */}
      {user && (
        <PreferenceQuestionnaireModal
          isOpen={isQuestionnaireOpen}
          onClose={handleCloseQuestionnaire}
          onSave={handleSavePreferences}
        />
      )}
    </div>
  );
}
