"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  motion,
  animate,
  useAnimation,
  useMotionValue,
  useTransform,
} from "framer-motion";
import {
  Calculator,
  FileText,
  FolderLock,
  Heart,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Layers,
  Users,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Search,
  Shield,
  Bell,
  BarChart3,
  Truck,
  CalendarDays,
  Globe,
  Zap,
  BookOpen,
  Megaphone,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type UseMediaQueryOptions = {
  defaultValue?: boolean;
  initializeWithValue?: boolean;
};

const IS_SERVER = typeof window === "undefined";

export function useMediaQuery(
  query: string,
  {
    defaultValue = false,
    initializeWithValue = true,
  }: UseMediaQueryOptions = {}
): boolean {
  const getMatches = (q: string): boolean => {
    if (IS_SERVER) return defaultValue;
    return window.matchMedia(q).matches;
  };

  const [matches, setMatches] = useState<boolean>(() =>
    initializeWithValue ? getMatches(query) : defaultValue
  );

  useIsomorphicLayoutEffect(() => {
    const matchMedia = window.matchMedia(query);
    const handler = () => setMatches(matchMedia.matches);
    handler();
    matchMedia.addEventListener("change", handler);
    return () => matchMedia.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

export interface FeatureCardData {
  id: string;
  name: string;
  description: string;
  highlights: string[];
  icon: any;
  authPath: string;
}

export const FEATURE_CARDS: FeatureCardData[] = [
  {
    id: "01",
    name: "ROI Calculator",
    description: "Calculate customs duty, GST, logistics, handling, and other landed costs before you bid, then compare the expected net margin across each auction lot.",
    highlights: ["Duty & GST Calculation", "Logistics Estimator", "Net Margin Projection"],
    icon: Calculator,
    authPath: "/auctions",
  },
  {
    id: "02",
    name: "Quote Builder",
    description: "Turn a selected lot into a professional procurement quote with itemized pricing, tax computation, payment terms, and exportable documentation.",
    highlights: ["Instant PDF Export", "Tax & Fee Breakdowns", "Custom Payment Terms"],
    icon: FileText,
    authPath: "/dashboard/quotes",
  },
  {
    id: "03",
    name: "Document Vault",
    description: "Keep bid documents, compliance certificates, KYC records, inspection reports, and tender submissions organized in one secure workspace.",
    highlights: ["Encrypted Vault Storage", "KYC & License Storage", "One-Click Bid Attachment"],
    icon: FolderLock,
    authPath: "/dashboard/documents",
  },
  {
    id: "04",
    name: "Watchlist & Alerts",
    description: "Track auctions that matter to you, set bid reminders, sync important dates, and receive timely alerts when status changes.",
    highlights: ["Real-Time Status Alerts", "Calendar Syncing", "Live Price Triggers"],
    icon: Heart,
    authPath: "/dashboard/interested",
  },
  {
    id: "05",
    name: "AI Market Valuation",
    description: "Predict scrap market valuation and calculate expected ROI using live LME indices, historical auction prices, and ML algorithms.",
    highlights: ["LME Index Blending", "ROI Margin Projection", "Historical Price Trends"],
    icon: TrendingUp,
    authPath: "/auctions",
  },
  {
    id: "06",
    name: "MSTC Catalog Aggregator",
    description: "Unified search across 10,000+ government and scrap catalogs nationwide with PDF OCR parsing and automatic lot details extraction.",
    highlights: ["Real-Time Catalog Sync", "PDF OCR Parsing", "Full-Text Natural Search"],
    icon: Layers,
    authPath: "/auctions",
  },
  {
    id: "07",
    name: "Verified Vendor Network",
    description: "Connect directly with verified scrap buyers, recyclers, and logistics vendors across India for seamless transport and material handling.",
    highlights: ["Verified B2B Directory", "Logistics Partner Connect", "Instant Transport Quotes"],
    icon: Users,
    authPath: "/dashboard/vendors",
  },
  {
    id: "08",
    name: "EMD Refund Tracker",
    description: "Track Earnest Money Deposit status, bank challan reference codes, deposit receipts, and automated refund timelines across MSTC auctions.",
    highlights: ["Challan Verification", "Automated Refund Timelines", "Multi-Bank Receipt Storage"],
    icon: CreditCard,
    authPath: "/dashboard/reminders",
  },
  {
    id: "09",
    name: "Smart NLP Search",
    description: "Search auction lots using natural language queries instead of rigid filters. Find 'copper scrap near Mumbai under 5 lakhs' instantly.",
    highlights: ["Natural Language Queries", "Synonym Matching", "Location-Aware Results"],
    icon: Search,
    authPath: "/auctions",
  },
  {
    id: "10",
    name: "Compliance Shield",
    description: "Auto-verify GST registration, PAN, trade licenses, and environmental clearances before placing bids on regulated scrap materials.",
    highlights: ["GST Auto-Verification", "PAN & License Check", "Environmental Clearance"],
    icon: Shield,
    authPath: "/dashboard/documents",
  },
  {
    id: "11",
    name: "Bid Notification Hub",
    description: "Get instant push, email, and SMS notifications for bid openings, price drops, outbid alerts, and auction closing reminders.",
    highlights: ["Push & Email Alerts", "Outbid Notifications", "Closing Countdown Alerts"],
    icon: Bell,
    authPath: "/dashboard/reminders",
  },
  {
    id: "12",
    name: "Analytics Dashboard",
    description: "Visualize bidding performance, win rates, cost savings, and market trends with interactive charts and exportable reports.",
    highlights: ["Win Rate Analytics", "Cost Savings Tracker", "Exportable PDF Reports"],
    icon: BarChart3,
    authPath: "/dashboard",
  },
  {
    id: "13",
    name: "Logistics Estimator",
    description: "Get instant freight cost estimates with route optimization, vehicle type selection, and multi-modal transport comparisons.",
    highlights: ["Route Optimization", "Multi-Modal Transport", "Real-Time Rate Cards"],
    icon: Truck,
    authPath: "/dashboard/quotes",
  },
  {
    id: "14",
    name: "Visual Calendar",
    description: "View all upcoming auctions, bid deadlines, EMD due dates, and payment schedules in an interactive calendar with reminders.",
    highlights: ["Auction Timeline View", "Deadline Reminders", "Payment Schedule Sync"],
    icon: CalendarDays,
    authPath: "/dashboard/calendar",
  },
  {
    id: "15",
    name: "Multi-Portal Aggregator",
    description: "Aggregate listings from MSTC, SAIL, Indian Railways, Coal India, and other PSU portals into one unified search interface.",
    highlights: ["PSU Portal Integration", "Cross-Portal Search", "Unified Lot View"],
    icon: Globe,
    authPath: "/auctions",
  },
  {
    id: "16",
    name: "Instant Bid Alerts",
    description: "Get lightning-fast alerts the moment a new lot matching your saved preferences is posted on any connected auction portal.",
    highlights: ["Preference Matching", "Instant Push Alerts", "Zero-Delay Notifications"],
    icon: Zap,
    authPath: "/dashboard/reminders",
  },
  {
    id: "17",
    name: "Knowledge Base",
    description: "Access curated guides on scrap bidding strategies, customs regulations, GST compliance, and MSTC auction procedures.",
    highlights: ["Bidding Strategy Guides", "Customs & GST Tutorials", "MSTC Procedure Docs"],
    icon: BookOpen,
    authPath: "/blog",
  },
  {
    id: "18",
    name: "Market Announcements",
    description: "Stay updated with real-time government circulars, policy changes, LME price movements, and scrap industry news.",
    highlights: ["Government Circulars", "LME Price Feed", "Industry News Digest"],
    icon: Megaphone,
    authPath: "/news",
  },
];

const Carousel = memo(
  ({
    handleClick,
    controls,
    cards,
    isCarouselActive,
    rotation,
  }: {
    handleClick: (item: FeatureCardData, index: number) => void;
    controls: any;
    cards: FeatureCardData[];
    isCarouselActive: boolean;
    rotation: any;
  }) => {
    const isScreenSizeSm = useMediaQuery("(max-width: 640px)");
    const cylinderWidth = isScreenSizeSm ? 2000 : 4200;
    const faceCount = cards.length;
    const faceWidth = cylinderWidth / faceCount;
    const radius = cylinderWidth / (2 * Math.PI);
    const transform = useTransform(
      rotation,
      (value: number) => `rotate3d(0, 1, 0, ${value}deg)`
    );

    return (
      <div
        className="flex h-full w-full items-center justify-center bg-transparent"
        style={{
          perspective: "1600px",
          transformStyle: "preserve-3d",
        }}
      >
        <motion.div
          drag={isCarouselActive ? "x" : false}
          className="relative flex h-full origin-center cursor-grab justify-center active:cursor-grabbing"
          style={{
            transform,
            rotateY: rotation,
            width: cylinderWidth,
            transformStyle: "preserve-3d",
          }}
          onDrag={(_, info) =>
            isCarouselActive &&
            rotation.set(rotation.get() + info.offset.x * 0.015)
          }
          onDragEnd={(_, info) => {
            if (!isCarouselActive) return;
            const clampedVelocity = Math.max(-500, Math.min(500, info.velocity.x));
            const target = rotation.get() + clampedVelocity * 0.012;
            animate(rotation, target, {
              type: "tween",
              duration: 0.6,
              ease: [0.25, 0.1, 0.25, 1],
            });
          }}
          animate={controls}
        >
          {cards.map((item, i) => {
            const Icon = item.icon;
            const faceAngle = i * (360 / faceCount);

            // Compute opacity: hide cards facing away from viewer
            const cardOpacity = useTransform(rotation, (rot: number) => {
              // Normalize the angle difference to [-180, 180]
              let diff = ((faceAngle + rot) % 360 + 360) % 360;
              if (diff > 180) diff -= 360;
              const absDiff = Math.abs(diff);
              // Fully visible within ±70°, fade out 70-100°, hidden beyond 100°
              if (absDiff <= 70) return 1;
              if (absDiff >= 100) return 0;
              return 1 - (absDiff - 70) / 30;
            });

            return (
              <motion.div
                key={`key-${item.id}-${i}`}
                className="absolute flex h-full origin-center items-center justify-center p-2"
                style={{
                  width: `${faceWidth}px`,
                  transform: `rotateY(${faceAngle}deg) translateZ(${radius}px)`,
                  opacity: cardOpacity,
                }}
                onClick={() => handleClick(item, i)}
              >
                {/* Feature Card */}
                <div 
                  className="bg-white border border-slate-200/90 rounded-xl p-3 sm:p-4 w-full max-w-[200px] h-[230px] flex flex-col justify-between hover:border-primary/40 hover:ring-2 hover:ring-primary/15 transition-all duration-200 group cursor-pointer text-left select-none"
                  style={{
                    transform: "translateZ(0)",
                    backfaceVisibility: "hidden",
                    willChange: "transform",
                  }}
                >
                  <div>
                    <div className="mb-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <h3 className="text-xs font-bold text-slate-900 mb-1 group-hover:text-primary transition-colors leading-tight">
                      {item.name}
                    </h3>

                    <p className="text-[9px] text-slate-500 leading-relaxed mb-2 line-clamp-2">
                      {item.description}
                    </p>

                    <ul className="space-y-0.5 pt-1.5 border-t border-slate-100">
                      {item.highlights.map((hText, idx) => (
                        <li key={idx} className="flex items-center text-[9px] font-medium text-slate-600">
                          <CheckCircle2 className="w-2.5 h-2.5 text-primary mr-1 shrink-0" />
                          <span>{hText}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center text-[9px] font-bold text-primary group-hover:translate-x-1">
                    <span>Explore Feature</span>
                    <ArrowRight className="w-2.5 h-2.5 ml-1" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    );
  }
);

function ThreeDPhotoCarousel({
  items = FEATURE_CARDS,
}: {
  items?: FeatureCardData[];
}) {
  const navigate = useNavigate();
  const isCarouselActive = true;
  const controls = useAnimation();
  const rotation = useMotionValue(0);

  const { isAuthenticated, profile } = useAuthStore();

  const handleClick = (item: FeatureCardData) => {
    // 1. Check if the path requires dashboard/sign-in
    if (item.authPath.startsWith('/dashboard')) {
      if (!isAuthenticated) {
        alert("Please sign in to access this feature.");
        navigate('/auth/login');
        return;
      }

      // 2. Check if the path is premium
      const premiumPaths = [
        '/dashboard/quotes',
        '/dashboard/documents',
        '/dashboard/reminders',
        '/dashboard/calendar'
      ];
      
      const isPremiumPath = premiumPaths.some(p => item.authPath.startsWith(p));
      const isPaidSubscriberOrAdmin = profile?.subscription_plan === 'pro' || 
                                     profile?.subscription_plan === 'go' || 
                                     profile?.subscription_plan === 'go-subscription' || 
                                     profile?.subscription_plan === 'enterprise' || 
                                     profile?.role === 'admin' || 
                                     profile?.role === 'superadmin';

      if (isPremiumPath && !isPaidSubscriberOrAdmin) {
        alert("Upgrade required. Please upgrade to a Pro plan to unlock this feature.");
        navigate('/pricing');
        return;
      }
    }

    navigate(item.authPath);
  };

  const stepAngle = 360 / items.length;

  const animateToAngle = useCallback((target: number) => {
    animate(rotation, target, {
      type: "tween",
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1],
    });
  }, [rotation]);

  const rotateLeft = useCallback(() => {
    animateToAngle(rotation.get() + stepAngle);
  }, [animateToAngle, rotation, stepAngle]);

  const rotateRight = useCallback(() => {
    animateToAngle(rotation.get() - stepAngle);
  }, [animateToAngle, rotation, stepAngle]);

  return (
    <motion.div layout className="relative w-full">

      <div className="relative h-[340px] sm:h-[360px] w-full overflow-visible py-8">
        <Carousel
          handleClick={handleClick}
          controls={controls}
          cards={items}
          isCarouselActive={isCarouselActive}
          rotation={rotation}
        />

        {/* Navigation Arrows */}
        <button
          onClick={rotateLeft}
          className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-lg flex items-center justify-center text-slate-600 hover:text-primary hover:border-primary/40 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden transition-all duration-200 cursor-pointer"
          aria-label="Previous feature"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={rotateRight}
          className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-lg flex items-center justify-center text-slate-600 hover:text-primary hover:border-primary/40 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden transition-all duration-200 cursor-pointer"
          aria-label="Next feature"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

export { ThreeDPhotoCarousel };
