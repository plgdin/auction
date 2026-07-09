import { lazy, Suspense, useEffect } from 'react';
import { HeroSection } from '../components/home/HeroSection';
import { ServiceCategoriesSection } from '../components/home/ServiceCategoriesSection';
import { MstcSearchService } from '../services/publicService';

// Below-fold sections: lazy-loaded to reduce Total Blocking Time (TBT)
const FeaturedAuctionsSection = lazy(() => import('../components/home/FeaturedAuctionsSection').then(m => ({ default: m.FeaturedAuctionsSection })));
const HowItWorksSection = lazy(() => import('../components/home/HowItWorksSection').then(m => ({ default: m.HowItWorksSection })));
const StatisticsSection = lazy(() => import('../components/home/StatisticsSection').then(m => ({ default: m.StatisticsSection })));
const FaqSection = lazy(() => import('../components/home/FaqSection').then(m => ({ default: m.FaqSection })));

function SectionSkeleton() {
  return <div className="py-20 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div></div>;
}

export function Home() {
  // Prefetch MSTC auction pages 1 & 2 so navigating to Auctions is instant
  useEffect(() => {
    const schedule = typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 500);
    const id = schedule(() => {
      MstcSearchService.searchMarketplaceCatalog('', { page: 1, limit: 12 }).catch(() => {});
      MstcSearchService.searchMarketplaceCatalog('', { page: 2, limit: 12 }).catch(() => {});
      MstcSearchService.getMstcFilterOptions().catch(() => {});
    });
    return () => {
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(id as number);
    };
  }, []);

  return (
    <div className="flex flex-col w-full">
      <HeroSection />
      <ServiceCategoriesSection />
      <Suspense fallback={<SectionSkeleton />}>
        <FeaturedAuctionsSection />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <HowItWorksSection />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <StatisticsSection />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <FaqSection />
      </Suspense>
    </div>
  );
}
