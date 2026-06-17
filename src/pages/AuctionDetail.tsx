// @ts-nocheck
import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Heart, Share2, Tag, MapPin, FileText, CheckCircle2, ChevronRight, Copy, FilePlus
} from 'lucide-react';
import { auctionService } from '../services/auctionService';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { formatPrice } from '../utils/currency';
import { ImageGallery } from '../components/auction/ImageGallery';
import { BiddingPanel } from '../components/auction/BiddingPanel';
import { MarketValuationPanel } from '../components/auction/MarketValuationPanel';
import { useAuctionRealtime } from '../hooks/useAuctionRealtime';
import type { Auction, AuctionImage, AuctionDocument } from '../types/database.types';
import clsx from 'clsx';
import { useQuoteStore } from '../store/quoteStore';
import { toast } from 'react-hot-toast';

export function AuctionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currency } = useAppStore();
  const { user, isAuthenticated } = useAuthStore();
  
  const [initialAuction, setInitialAuction] = useState<Auction | null>(null);
  const [images, setImages] = useState<AuctionImage[]>([]);
  const [documents, setDocuments] = useState<AuctionDocument[]>([]);
  const [related, setRelated] = useState<Auction[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const loadAuctionData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const auctionData = await auctionService.getAuctionById(id);
      if (!auctionData) {
        navigate('/not-found');
        return;
      }
      setInitialAuction(auctionData);

      // Parallel fetch supporting data
      const [imgData, docData, relData] = await Promise.all([
        auctionService.getAuctionImages(id),
        auctionService.getAuctionDocuments(id),
        auctionService.getRelatedAuctions(auctionData.category_id, id)
      ]);
      
      setImages(imgData);
      setDocuments(docData);
      setRelated(relData);

      // Check watchlist
      if (isAuthenticated && user) {
        const wIds = await auctionService.getUserWatchlistIds(user.id);
        setIsWatchlisted(wIds.includes(id));
      }
    } catch (error) {
      console.error('Failed to load auction data', error);
    } finally {
      setIsLoading(false);
    }
  }, [id, isAuthenticated, user, navigate]);

  useEffect(() => {
    loadAuctionData();
    window.scrollTo(0, 0);
  }, [loadAuctionData]);

  const handleWatchlistToggle = async () => {
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: `/auctions/${id}` } });
      return;
    }
    if (!id || !user) return;

    setIsToggling(true);
    try {
      const added = await auctionService.toggleWatchlist(user.id, id);
      setIsWatchlisted(added);
    } catch (error) {
      console.error('Failed to toggle watchlist', error);
    } finally {
      setIsToggling(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // Move realtime hook below the initial load check, but we need it before returns usually.
  // Wait, hooks can't be conditional. We'll use a wrapper or just rely on the component returning early if null.
  // Actually, we can just extract the wrapper or safely render. Let's create an inner component or just call the hook if initialAuction is present.
  // Since we can't conditionally call hooks, we should split it.
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] bg-slate-50">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!initialAuction) return null;

  return <AuctionDetailInner 
    initialAuction={initialAuction} 
    images={images} 
    documents={documents} 
    related={related} 
    isWatchlisted={isWatchlisted} 
    isToggling={isToggling} 
    handleWatchlistToggle={handleWatchlistToggle} 
    handleShare={handleShare} 
    shareCopied={shareCopied} 
  />;
}

// Inner component to safely use the hook
function AuctionDetailInner({ 
  initialAuction, images, documents, related, 
  isWatchlisted, isToggling, handleWatchlistToggle, 
  handleShare, shareCopied 
}: any) {
  const { auction, bids, currentMaxBid } = useAuctionRealtime(initialAuction);
  const [activeTab, setActiveTab] = useState<'details' | 'terms' | 'documents'>('details');
  const [copiedRefNum, setCopiedRefNum] = useState(false);

  const addItemToActiveQuote = useQuoteStore(state => state.addItemToActiveQuote);

  const handleAddToQuote = () => {
    addItemToActiveQuote({
      description: auction.title,
      qty: 1,
      unit: 'Lot',
      price: auction.starting_bid || 0,
      taxRate: 18,
    });
    toast.success(`Added "${auction.title}" to quote`);
  };

  const isActive = auction.status === 'active';

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      {/* Breadcrumbs */}
      <div className="bg-white border-b border-slate-200 py-4">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex text-sm text-slate-500 font-medium">
            <Link to="/" className="hover:text-primary">Home</Link>
            <ChevronRight className="w-4 h-4 mx-2 text-slate-400" />
            <Link to="/auctions" className="hover:text-primary">Auctions</Link>
            <ChevronRight className="w-4 h-4 mx-2 text-slate-400" />
            <span className="text-slate-900 truncate max-w-xs">{auction.reference_number}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className={clsx(
                "px-3 py-1 text-xs font-bold rounded-full shadow-sm uppercase tracking-wider text-white",
                isActive ? "bg-green-500" : auction.status === 'upcoming' ? "bg-blue-500" : "bg-slate-500"
              )}>
                {auction.status}
              </span>
              <span className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center bg-primary/10 px-3 py-1 rounded-full gap-1.5">
                <Tag className="w-3.5 h-3.5" /> REF: {auction.reference_number}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(auction.reference_number);
                    setCopiedRefNum(true);
                    setTimeout(() => setCopiedRefNum(false), 2000);
                  }}
                  className="p-0.5 rounded hover:bg-primary/20 text-primary-600 hover:text-primary transition-colors cursor-pointer flex items-center justify-center"
                  title="Copy Reference ID"
                >
                  {copiedRefNum ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 animate-scale-up" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
              {auction.title}
            </h1>
            <div className="flex items-center text-slate-500 mt-4">
              <MapPin className="w-5 h-5 mr-2 text-slate-400" />
              {auction.location || 'Multiple Locations'}
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleAddToQuote}
              className="flex items-center justify-center w-12 h-12 bg-white border border-slate-200 rounded-full shadow-sm text-slate-600 hover:text-primary hover:border-primary/50 transition-colors"
              title="Add to Quote"
            >
              <FilePlus className="w-5 h-5" />
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center w-12 h-12 bg-white border border-slate-200 rounded-full shadow-sm text-slate-600 hover:text-primary hover:border-primary/50 transition-colors"
              title="Share"
            >
              {shareCopied ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Share2 className="w-5 h-5" />}
            </button>
            <button
              onClick={handleWatchlistToggle}
              disabled={isToggling}
              className="flex items-center justify-center w-12 h-12 bg-white border border-slate-200 rounded-full shadow-sm hover:border-primary/50 transition-colors"
              title="Add to Watchlist"
            >
              <Heart className={clsx("w-5 h-5", isWatchlisted ? "fill-red-500 text-red-500" : "text-slate-600 hover:text-red-500")} />
            </button>
          </div>
        </div>

        {/* Main Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          
          {/* Left: Gallery & Details */}
          <div className="lg:col-span-6 xl:col-span-7">
            <ImageGallery images={images} />
            
            {/* Tabs Section */}
            <div className="mt-12 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex border-b border-slate-200 overflow-x-auto hide-scrollbar">
                {(['details', 'terms', 'documents'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      "px-8 py-4 font-semibold text-sm uppercase tracking-wider transition-colors whitespace-nowrap",
                      activeTab === tab
                        ? "text-primary border-b-2 border-primary bg-primary/5"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {tab === 'details' ? 'Description' : tab === 'terms' ? 'Terms & Conditions' : 'Documents'}
                  </button>
                ))}
              </div>
              
              <div className="p-6 sm:p-8">
                {activeTab === 'details' && (
                  <div className="prose prose-slate max-w-none text-slate-700">
                    <p className="whitespace-pre-line leading-relaxed">
                      {auction.description || 'No detailed description provided by the seller.'}
                    </p>
                  </div>
                )}
                
                {activeTab === 'terms' && (
                  <div className="prose prose-slate max-w-none text-slate-700">
                    <p className="whitespace-pre-line leading-relaxed">
                      {auction.terms_conditions || 'Standard Auction-Platform terms and conditions apply.'}
                    </p>
                  </div>
                )}
                
                {activeTab === 'documents' && (
                  <div>
                    {documents.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">No documents attached to this auction.</p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {documents.map((doc) => (
                          <li key={doc.id} className="py-4 flex items-center justify-between group">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">{doc.name}</p>
                                <p className="text-sm text-slate-500">System verified document</p>
                              </div>
                            </div>
                            <a 
                              href={doc.file_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary hover:text-white transition-colors"
                            >
                              Download
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Middle: Market Intelligence Panel */}
          <div className="lg:col-span-3 xl:col-span-3">
            <MarketValuationPanel auction={auction} currentBid={currentMaxBid || auction.starting_price} />
          </div>

          {/* Right: Bidding Panel */}
          <div className="lg:col-span-3 xl:col-span-2">
            <BiddingPanel auction={auction} bids={bids} currentMaxBid={currentMaxBid} />
          </div>

        </div>

        {/* Related Auctions */}
        {related.length > 0 && (
          <div className="pt-12 border-t border-slate-200">
            <div className="flex justify-between items-end mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Similar Auctions</h2>
              <Link to={`/auctions?category=${auction.category_id}`} className="text-primary font-medium hover:underline">
                View category
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {related.map(rel => (
                <Link 
                  key={rel.id} 
                  to={`/auctions/${rel.id}`}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group flex flex-col h-full"
                >
                  <div className="h-32 bg-slate-100 relative">
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm font-medium">Image</div>
                  </div>
                  <div className="p-4 flex-grow flex flex-col">
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-2 mb-2">
                      {rel.title}
                    </h3>
                    <div className="mt-auto pt-3 border-t border-slate-50 flex justify-between items-center">
                      <p className="text-sm font-bold text-slate-900 flex items-center font-mono">
                        {formatPrice(rel.starting_price, currency)}
                      </p>
                      <span className="text-xs font-bold text-slate-500">View</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
