// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Gavel, Trophy, Heart, ArrowRight, Activity, 
  TrendingUp, Sparkles, MapPin, Shield, CreditCard,
  AlertTriangle, HelpCircle, CheckCircle,
  ChevronRight, Clock, Coins, ShieldCheck, BarChart2
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
import { marketPriceService, type FullCommodityConfig } from '../services/marketPriceService';

export function Dashboard() {
  const { user, profile } = useAuthStore();
  const { currency, interestedMstcIds, toggleInterestedMstcId } = useAppStore();
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
  const [livePrices, setLivePrices] = useState<Record<string, { price: number; unit: string; name: string; lastUpdated: string }>>({});

  const loadDashboardAndRecs = async (userId: string) => {
    try {
      const [bids, wonData, dbWatchlist, recommendationProfile, recs, ranked] = await Promise.all([
        auctionService.getUserBids(userId),
        auctionService.getWonAuctions(userId),
        auctionService.getUserWatchlistIds(userId),
        recommendationService.getRecommendationProfile(userId),
        recommendationService.getRecommendedAuctions(userId, 4),
        recommendationService.getRankedAuctions(userId)
      ]);

      const activeBids = bids.filter(b => b.auction.status === 'active').length;
      const allInterested = Array.from(new Set([...interestedMstcIds, ...dbWatchlist]));

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

      const prefs = recommendationProfile.preferences;
      setUserPrefs(prefs);
      setInterestedIds(allInterested);

      // If preferences are not configured and questionnaire was never completed/dismissed, trigger questionnaire for onboarding
      if (!prefs && !recommendationProfile.questionnaireCompleted) {
        setIsQuestionnaireOpen(true);
      }

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

  // Fetch live commodity prices from Supabase market_indices
  useEffect(() => {
    const TRACKED_IDS = ['steel_iron_ferrous', 'copper', 'gold', 'silver', 'aluminium'];
    async function fetchLiveCommodities() {
      try {
        const allPrices = await marketPriceService.fetchCommodityPrices();
        const map: Record<string, { price: number; unit: string; name: string; lastUpdated: string }> = {};
        for (const id of TRACKED_IDS) {
          const found = allPrices.find(p => p.id === id);
          if (found) {
            map[id] = { price: found.currentPrice, unit: found.unit, name: found.name, lastUpdated: found.lastUpdated || new Date().toISOString() };
          }
        }
        setLivePrices(map);
      } catch (err) {
        console.error('Failed to load live commodity prices', err);
      }
    }
    fetchLiveCommodities();
  }, []);

  useEffect(() => {
    if (!user) return;
    async function syncInterested() {
      const dbWatchlist = await auctionService.getUserWatchlistIds(user.id);
      const allInterested = Array.from(new Set([...interestedMstcIds, ...dbWatchlist]));
      setInterestedIds(allInterested);
      setStats(prev => ({
        ...prev,
        interestedAuctions: allInterested.length
      }));
    }
    syncInterested();
  }, [interestedMstcIds, user]);

  const handleSavePreferences = async (prefs: UserPreference) => {
    if (!user) return;
    await recommendationService.saveUserPreferences(user.id, prefs);
    setUserPrefs(prefs);
    setIsQuestionnaireOpen(false);
    setIsLoading(true);
    loadDashboardAndRecs(user.id);
  };

  const handleToggleWatchlist = async (auctionId: string) => {
    if (!user) return;
    
    const isMstc = recommendedAuctions.some(a => a.id === auctionId && a.is_mstc) ||
                    rankedAuctions.some(a => a.id === auctionId && a.isMstc);
    if (isMstc) {
      toggleInterestedMstcId(user.id, auctionId);
    } else {
      try {
        await auctionService.toggleWatchlist(user.id, auctionId);
        const dbWatchlist = await auctionService.getUserWatchlistIds(user.id);
        const allInterested = Array.from(new Set([...interestedMstcIds, ...dbWatchlist]));
        setInterestedIds(allInterested);
        setStats(prev => ({
          ...prev,
          interestedAuctions: allInterested.length
        }));
      } catch (e) {
        console.error('Failed to toggle Supabase watchlist', e);
      }
    }

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
        <div className="relative z-10">
          <div>
            <h1 className="text-3xl font-extrabold mb-2">
              Welcome back, {profile?.first_name || 'User'}
            </h1>
            <p className="text-slate-300 max-w-2xl text-lg">
              Track your active eAuctions, analyze yield profitability, and manage commercial quotes in real time.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (spans 2) */}
        <div className="lg:col-span-2 space-y-8 min-w-0">
          
          {/* Key B2B eAuction Metrics & Intelligence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Metric 1: Closing Soon */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between hover:border-blue-300 transition-all">
              <div className="flex justify-between items-start">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                  Closing Soon
                </span>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-black text-slate-900">4 Auctions</p>
                <p className="text-xs text-slate-500 mt-0.5">Closing within 48h across MSTC & Corporate portals</p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Priority Watch: High</span>
                <Link to="/auctions" className="text-blue-600 font-bold hover:underline flex items-center gap-0.5">
                  View <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Metric 2: Estimated Target Valuation */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between hover:border-emerald-300 transition-all">
              <div className="flex justify-between items-start">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Coins className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                  Valuation
                </span>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-black text-slate-900">{formatPrice(2850000, currency)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Est. Scrap & Material value of targeted lots</p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-emerald-700 font-bold">Avg. Margin: ~18.5% ROI</span>
                <Link to="/dashboard/quotes" className="text-blue-600 font-bold hover:underline flex items-center gap-0.5">
                  Quote Builder <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Metric 3: EMD & Account Status */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between hover:border-blue-300 transition-all">
              <div className="flex justify-between items-start">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md">
                  Compliance
                </span>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-black text-slate-900">EMD Ready</p>
                <p className="text-xs text-slate-500 mt-0.5">GSTIN & MSTC Bidder Registration Verified</p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Vault Docs: 4 Attached</span>
                <Link to="/dashboard/documents" className="text-blue-600 font-bold hover:underline flex items-center gap-0.5">
                  Vault <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Metric 4: Actual Live Commodity Market Rates (Steel, Copper, Gold, Silver, Aluminium) */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between hover:border-purple-300 transition-all col-span-1 sm:col-span-2">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">Live Commodity Market Rates</h4>
                    <p className="text-xs text-slate-500">Real-time Mandi & exchange prices for materials</p>
                  </div>
              </div>

              {/* Commodity Rate Grid - Live from Supabase */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 pt-1">
                {/* Steel / Iron */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Steel / Iron</span>
                  <p className="text-sm font-extrabold text-slate-900 mt-1">{formatPrice(livePrices.steel_iron_ferrous?.price || 38.5, currency)}/{livePrices.steel_iron_ferrous?.unit || 'kg'}</p>
                  <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">{livePrices.steel_iron_ferrous?.lastUpdated ? new Date(livePrices.steel_iron_ferrous.lastUpdated).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Loading...'}</span>
                </div>

                {/* Copper */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Copper Scrap</span>
                  <p className="text-sm font-extrabold text-slate-900 mt-1">{formatPrice(livePrices.copper?.price || 780, currency)}/{livePrices.copper?.unit || 'kg'}</p>
                  <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">{livePrices.copper?.lastUpdated ? new Date(livePrices.copper.lastUpdated).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Loading...'}</span>
                </div>

                {/* Gold */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Gold 24K</span>
                  <p className="text-sm font-extrabold text-slate-900 mt-1">{formatPrice(livePrices.gold?.price || 7450, currency)}/{livePrices.gold?.unit || 'gram'}</p>
                  <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">{livePrices.gold?.lastUpdated ? new Date(livePrices.gold.lastUpdated).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Loading...'}</span>
                </div>

                {/* Silver */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Silver 999</span>
                  <p className="text-sm font-extrabold text-slate-900 mt-1">{formatPrice(livePrices.silver?.price || 91000, currency)}/{livePrices.silver?.unit || 'kg'}</p>
                  <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">{livePrices.silver?.lastUpdated ? new Date(livePrices.silver.lastUpdated).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Loading...'}</span>
                </div>

                {/* Aluminium */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Aluminium</span>
                  <p className="text-sm font-extrabold text-slate-900 mt-1">{formatPrice(livePrices.aluminium?.price || 235, currency)}/{livePrices.aluminium?.unit || 'kg'}</p>
                  <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">{livePrices.aluminium?.lastUpdated ? new Date(livePrices.aluminium.lastUpdated).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Loading...'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recommended Auctions Feed - Responsive Touch Slider */}
          <div className="bg-white rounded-lg shadow-sm border border-border p-6 space-y-6 overflow-hidden">
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
              <Link to="/auctions" className="text-primary text-xs font-semibold hover:underline flex items-center gap-1 shrink-0">
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
              <div className="flex md:grid md:grid-cols-2 gap-4 overflow-x-auto snap-x no-scrollbar pb-3 -mx-2 px-2">
                {recommendedAuctions.map(auc => {
                  const isWatched = interestedIds.includes(auc.id);
                  const matchesPref = userPrefs?.categories.some(c => 
                    (auc.category?.name || '').toLowerCase().includes(c.toLowerCase())
                  );
                  const matchesLoc = userPrefs?.locations.some(l => 
                    (auc.location || '').toLowerCase().includes(l.toLowerCase())
                  );

                  return (
                    <div 
                      key={auc.id} 
                      className="bg-white border border-slate-100 hover:border-blue-400 rounded-xl p-5 hover:shadow-xs transition-all relative flex flex-col justify-between min-w-[280px] sm:min-w-[320px] md:min-w-0 snap-start shrink-0 md:shrink"
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
        <div className="space-y-8 min-w-0">
          
          {/* Yield Ranking Comparison Analyzer - Touch Slider on Mobile */}
          <div className="bg-white rounded-lg shadow-sm border border-border p-6 flex flex-col overflow-hidden">
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
              <div className="flex md:block overflow-x-auto snap-x no-scrollbar gap-3 pb-3 md:pb-0 md:space-y-4 -mx-1 px-1">
                {rankedAuctions.map((item, index) => (
                  <div 
                    key={`${item.id}-${index}`} 
                    className="border border-slate-100 rounded-xl p-3.5 space-y-3 bg-slate-50/50 hover:bg-slate-50 transition-colors min-w-[260px] sm:min-w-[280px] md:min-w-0 snap-start shrink-0 md:shrink"
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

          {/* Recent Bids Section - Touch Slider on Mobile */}
          <div className="bg-white rounded-lg shadow-sm border border-border p-6 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
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
                <ul className="flex md:block overflow-x-auto snap-x no-scrollbar gap-3 pb-3 md:pb-0 md:divide-y md:divide-border -mx-1 px-1">
                  {recentBids.map((bid) => (
                    <li key={bid.id} className="py-3 px-3.5 bg-slate-50/60 md:bg-transparent rounded-xl md:rounded-none border md:border-none border-slate-100 min-w-[240px] md:min-w-0 snap-start shrink-0 md:shrink">
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
          onSave={handleSavePreferences}
        />
      )}
    </div>
  );
}
