import { lazy, Suspense } from 'react';
import { HeroSection } from '../components/home/HeroSection';
import { ServiceCategoriesSection } from '../components/home/ServiceCategoriesSection';

// Below-fold sections: lazy-loaded to reduce Total Blocking Time (TBT)
const FeaturedAuctionsSection = lazy(() => import('../components/home/FeaturedAuctionsSection').then(m => ({ default: m.FeaturedAuctionsSection })));
const HowItWorksSection = lazy(() => import('../components/home/HowItWorksSection').then(m => ({ default: m.HowItWorksSection })));
const StatisticsSection = lazy(() => import('../components/home/StatisticsSection').then(m => ({ default: m.StatisticsSection })));
const FaqSection = lazy(() => import('../components/home/FaqSection').then(m => ({ default: m.FaqSection })));

function SectionSkeleton() {
  return <div className="py-20 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div></div>;
}

export function Home() {
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
