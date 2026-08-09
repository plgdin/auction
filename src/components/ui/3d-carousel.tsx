"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useState, useRef } from "react";
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

function FeatureCarouselCard({
  item,
  index,
  faceAngle,
  faceWidth,
  radius,
  rotation,
  handleClick,
}: {
  item: FeatureCardData;
  index: number;
  faceAngle: number;
  faceWidth: number;
  radius: number;
  rotation: any;
  handleClick: (item: FeatureCardData, index: number) => void;
}) {
  const Icon = item.icon;
  const cardOpacity = useTransform(rotation, (rot: number) => {
    let diff = ((faceAngle + rot) % 360 + 360) % 360;
    if (diff > 180) diff -= 360;
    const absDiff = Math.abs(diff);
    if (absDiff <= 70) return 1;
    if (absDiff >= 100) return 0;
    return 1 - (absDiff - 70) / 30;
  });
  const cardFocus = useTransform(rotation, (rot: number) => {
    let diff = ((faceAngle + rot) % 360 + 360) % 360;
    if (diff > 180) diff -= 360;
    // Keep emphasis tight around the front-facing card. Nearby cards shrink.
    return Math.max(0, 1 - Math.abs(diff) / 32);
  });
  // Keep emphasis on the motion-value pipeline. React state here caused a
  // second render after every rotation, which made the active card feel late.
  const cardBackground = useTransform(cardFocus, (focus) => focus > 0.8 ? "#2563eb" : "#ffffff");
  const cardForeground = useTransform(cardFocus, (focus) => focus > 0.8 ? "#ffffff" : "#0f172a");
  const iconBackground = useTransform(cardFocus, (focus) => focus > 0.8 ? "rgba(255,255,255,.2)" : "#eff6ff");
  const iconBorder = useTransform(cardFocus, (focus) => focus > 0.8 ? "rgba(255,255,255,.38)" : "#bfdbfe");
  const iconColor = useTransform(cardFocus, (focus) => focus > 0.8 ? "#ffffff" : "#2563eb");
  const secondaryForeground = useTransform(cardFocus, (focus) => focus > 0.8 ? "rgba(255,255,255,.78)" : "#64748b");
  const divider = useTransform(cardFocus, (focus) => focus > 0.8 ? "rgba(255,255,255,.2)" : "#e2e8f0");
  const listForeground = useTransform(cardFocus, (focus) => focus > 0.8 ? "rgba(255,255,255,.9)" : "#475569");
  const accentForeground = useTransform(cardFocus, (focus) => focus > 0.8 ? "#ffffff" : "#2563eb");
  const cardBorder = useTransform(
    cardFocus,
    (focus) => focus > 0.8 ? "#2563eb" : "#dbeafe"
  );


  return (
    <motion.div
      className="absolute flex h-full origin-center items-center justify-center p-2"
      style={{
        width: `${faceWidth}px`,
        transform: `rotateY(${faceAngle}deg) translateZ(${radius}px)`,
        opacity: cardOpacity,
        zIndex: cardFocus,
      }}
      onClick={() => handleClick(item, index)}
    >
      <motion.div
        className="border border-slate-200/90 rounded-2xl p-4 sm:p-5 w-full max-w-[210px] h-[238px] flex flex-col justify-between group cursor-pointer text-left select-none"
        style={{
          backgroundColor: cardBackground,
          color: cardForeground,
          borderColor: cardBorder,

        }}
      >
        <div>
          <div className="mb-2">
            <motion.div
              className="w-9 h-9 rounded-xl border flex items-center justify-center"
              style={{
                backgroundColor: iconBackground,
                borderColor: iconBorder,
                color: iconColor,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
            </motion.div>
          </div>
          <motion.h3 className="text-sm font-bold mb-1 leading-tight" style={{ color: cardForeground }}>
            {item.name}
          </motion.h3>
          <motion.p
            className="text-[10px] leading-relaxed mb-2 line-clamp-2"
            style={{ color: secondaryForeground }}
          >
            {item.description}
          </motion.p>
          <motion.ul
            className="space-y-0.5 pt-1.5 border-t"
            style={{ borderColor: divider }}
          >
            {item.highlights.map((hText, idx) => (
              <motion.li key={idx} className="flex items-center text-[9px] font-medium" style={{ color: listForeground }}>
                <CheckCircle2 className="w-2.5 h-2.5 mr-1 shrink-0" />
                <span>{hText}</span>
              </motion.li>
            ))}
          </motion.ul>
        </div>
        <motion.div
          className="pt-2 border-t flex items-center text-[10px] font-bold"
          style={{
            borderColor: divider,
            color: accentForeground,
          }}
        >
          <span>Explore Feature</span>
          <ArrowRight className="w-2.5 h-2.5 ml-1" />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

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
              duration: 0.28,
              ease: [0.25, 0.1, 0.25, 1],
            });
          }}
          animate={controls}
        >
          {cards.map((item, i) => (
            <FeatureCarouselCard
              key={`key-${item.id}-${i}`}
              item={item}
              index={i}
              faceAngle={i * (360 / faceCount)}
              faceWidth={faceWidth}
              radius={radius}
              rotation={rotation}
              handleClick={handleClick}
            />
          ))}
        </motion.div>
      </div>
    );
  }
);

function MobileSlideCards({
  items,
  handleClick,
}: {
  items: FeatureCardData[];
  handleClick: (item: FeatureCardData, index: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -270 : 270;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative w-full max-w-full overflow-hidden py-2">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory space-x-4 px-4 pb-4 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              onClick={() => handleClick(item, index)}
              className="snap-center shrink-0 w-[260px] bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between text-left select-none"
            >
              <div>
                <div className="mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1 leading-tight">
                  {item.name}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-3 line-clamp-3">
                  {item.description}
                </p>
                <ul className="space-y-1 pt-2 border-t border-slate-100">
                  {item.highlights.map((hText, idx) => (
                    <li key={idx} className="flex items-center text-xs text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-blue-600 shrink-0" />
                      <span>{hText}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pt-3 mt-4 border-t border-slate-100 flex items-center text-xs font-bold text-blue-600">
                <span>Explore Feature</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-3 mt-1">
        <button
          onClick={() => scroll('left')}
          className="w-9 h-9 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-700 active:scale-95 transition-all cursor-pointer"
          aria-label="Previous card"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-slate-500">Swipe or tap arrows</span>
        <button
          onClick={() => scroll('right')}
          className="w-9 h-9 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-700 active:scale-95 transition-all cursor-pointer"
          aria-label="Next card"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ThreeDPhotoCarousel({
  items = FEATURE_CARDS,
}: {
  items?: FeatureCardData[];
}) {
  const navigate = useNavigate();
  const isCarouselActive = true;
  const controls = useAnimation();
  const rotation = useMotionValue(0);
  const isMobile = useMediaQuery("(max-width: 640px)");

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
      duration: 0.28,
      ease: [0.25, 0.1, 0.25, 1],
    });
  }, [rotation]);

  const rotateLeft = useCallback(() => {
    animateToAngle(rotation.get() + stepAngle);
  }, [animateToAngle, rotation, stepAngle]);

  const rotateRight = useCallback(() => {
    animateToAngle(rotation.get() - stepAngle);
  }, [animateToAngle, rotation, stepAngle]);

  if (isMobile) {
    return <MobileSlideCards items={items} handleClick={handleClick} />;
  }

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
