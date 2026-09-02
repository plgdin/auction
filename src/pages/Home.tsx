import { lazy, Suspense, useEffect, useState } from 'react';
import { HeroSection } from '../components/home/HeroSection';
import { usePageSeo } from '../utils/seo';

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

  usePageSeo({
    title: 'Lelam | India\'s Multi-Portal eAuction & Bidding Analytics Platform (MSTC, BaankNet, GeM)',
    description: 'Lelam (www.lelam.co) is India\'s leading unified eAuction intelligence platform aggregating MSTC scrap metal auctions, BaankNet SARFAESI bank property & vehicle auctions, and GeM portal government tenders. Automatically calculate total landed costs, ROI margins, and track EMD deposits.',
    canonicalPath: '/',
    keywords: 'MSTC eAuctions, BaankNet bank auctions, SARFAESI property auction, GeM portal bids, scrap metal bidding, landed cost calculator',
  });

  // Keep below-fold work out of the initial-load window. Load it when the
  // visitor starts scrolling, when the content is actually needed.
  useEffect(() => {
    let triggered = false;
    const triggerLoad = () => {
      if (triggered) return;
      triggered = true;
      setLoadBelowFold(true);

      window.removeEventListener('scroll', triggerLoad);
    };

    window.addEventListener('scroll', triggerLoad, { once: true, passive: true });

    return () => {
      window.removeEventListener('scroll', triggerLoad);
    };
  }, []);

  // Delay prefetching catalog options until 4.5s after load to prevent main thread blocking (TBT)
  useEffect(() => {
    if (!loadBelowFold) return;

    const timer = setTimeout(() => {
      const schedule = typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 200);
      schedule(() => {
        import('../services/publicService').then(({ MstcSearchService }) => {
          MstcSearchService.searchMarketplaceCatalog('', { page: 1, limit: 12 }).catch(() => {});
          MstcSearchService.getMstcFilterOptions().catch(() => {});
        }).catch(() => {});
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
