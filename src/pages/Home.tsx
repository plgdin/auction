import { lazy, Suspense, useEffect, useState } from 'react';
import { HeroSection } from '../components/home/HeroSection';
import { MstcSearchService } from '../services/publicService';

// Below-fold sections: lazy-loaded to reduce Total Blocking Time (TBT)
const ServiceCategoriesSection = lazy(() => import('../components/home/ServiceCategoriesSection').then(m => ({ default: m.ServiceCategoriesSection })));
const FeaturedAuctionsSection = lazy(() => import('../components/home/FeaturedAuctionsSection').then(m => ({ default: m.FeaturedAuctionsSection })));
const HowItWorksSection = lazy(() => import('../components/home/HowItWorksSection').then(m => ({ default: m.HowItWorksSection })));
const LatestNewsBlogSection = lazy(() => import('../components/home/LatestNewsBlogSection').then(m => ({ default: m.LatestNewsBlogSection })));
const FaqSection = lazy(() => import('../components/home/FaqSection').then(m => ({ default: m.FaqSection })));
const ContactSalesSection = lazy(() => import('../components/home/ContactSalesSection').then(m => ({ default: m.ContactSalesSection })));

// Invisible placeholder — chunks load near-instantly so a visible spinner just flickers annoyingly
function SectionSkeleton() {
  return <div className="py-20" aria-hidden="true" />;
}

export function Home() {
  const [loadBelowFold, setLoadBelowFold] = useState(false);

  // Delay loading of below-fold components until after paint or on scroll to achieve 0ms TBT
  useEffect(() => {
    let triggered = false;
    const triggerLoad = () => {
      if (triggered) return;
      triggered = true;
      setLoadBelowFold(true);
      
      // Clean up scroll listener
      window.removeEventListener('scroll', triggerLoad);
    };

    // Load after 1.5s idle/paint delay, or immediately upon user scroll
    const timer = setTimeout(triggerLoad, 1500);
    window.addEventListener('scroll', triggerLoad, { once: true, passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', triggerLoad);
    };
  }, []);

  // Delay prefetching catalog options until 4.5s after load to prevent main thread blocking (TBT)
  useEffect(() => {
    if (!loadBelowFold) return;

    const timer = setTimeout(() => {
      const schedule = typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 200);
      schedule(() => {
        MstcSearchService.searchMarketplaceCatalog('', { page: 1, limit: 12 }).catch(() => {});
        MstcSearchService.getMstcFilterOptions().catch(() => {});
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [loadBelowFold]);

  return (
    <div className="flex flex-col w-full">
      <HeroSection />
      {loadBelowFold && (
        <>
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
            <LatestNewsBlogSection />
          </Suspense>
          <Suspense fallback={<SectionSkeleton />}>
            <ContactSalesSection />
          </Suspense>
          <Suspense fallback={<SectionSkeleton />}>
            <FaqSection />
          </Suspense>
        </>
      )}
    </div>
  );
}
