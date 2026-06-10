import { HeroSection } from '../components/home/HeroSection';
import { ServiceCategoriesSection } from '../components/home/ServiceCategoriesSection';
import { FeaturedAuctionsSection } from '../components/home/FeaturedAuctionsSection';
import { FeaturedTendersSection } from '../components/home/FeaturedTendersSection';
import { HowItWorksSection } from '../components/home/HowItWorksSection';
import { StatisticsSection } from '../components/home/StatisticsSection';
import { AnnouncementsSection } from '../components/home/AnnouncementsSection';
import { FaqSection } from '../components/home/FaqSection';

export function Home() {
  return (
    <div className="flex flex-col w-full">
      <HeroSection />
      <ServiceCategoriesSection />
      <FeaturedAuctionsSection />
      <FeaturedTendersSection />
      <HowItWorksSection />
      <StatisticsSection />
      <AnnouncementsSection />
      <FaqSection />
    </div>
  );
}
