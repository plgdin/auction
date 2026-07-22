import { lazy, Suspense, useEffect } from 'react';
import { HeroSection } from '../components/home/HeroSection';
import { MstcSearchService } from '../services/publicService';

// Below-fold sections: lazy-loaded to reduce Total Blocking Time (TBT)
const ServiceCategoriesSection = lazy(() => import('../components/home/ServiceCategoriesSection').then(m => ({ default: m.ServiceCategoriesSection })));
const FeaturedAuctionsSection = lazy(() => import('../components/home/FeaturedAuctionsSection').then(m => ({ default: m.FeaturedAuctionsSection })));
const HowItWorksSection = lazy(() => import('../components/home/HowItWorksSection').then(m => ({ default: m.HowItWorksSection })));
const StatisticsSection = lazy(() => import('../components/home/StatisticsSection').then(m => ({ default: m.StatisticsSection })));
const FaqSection = lazy(() => import('../components/home/FaqSection').then(m => ({ default: m.FaqSection })));

// Invisible placeholder — chunks load near-instantly so a visible spinner just flickers annoyingly
function SectionSkeleton() {
  return <div className="py-20" aria-hidden="true" />;
}

export function Home() {
  // Delay prefetching catalog options until 3.5s after load to prevent main thread blocking (TBT)
  useEffect(() => {
    const timer = setTimeout(() => {
      const schedule = typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 200);
      schedule(() => {
        MstcSearchService.searchMarketplaceCatalog('', { page: 1, limit: 12 }).catch(() => {});
        MstcSearchService.getMstcFilterOptions().catch(() => {});
      });
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col w-full">
      <HeroSection />
      <Suspense fallback={<SectionSkeleton />}>
        <ServiceCategoriesSection />
      </Suspense>
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
