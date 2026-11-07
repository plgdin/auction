import {
  BellIcon,
  CalendarIcon,
  FileTextIcon,
  GlobeIcon,
  InputIcon,
} from "@radix-ui/react-icons";

import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";

const features = [
  {
    Icon: FileTextIcon,
    name: "Archival Inspection",
    description: "Every seam, lining, and original care tag inspected by hand.",
    href: "#/products",
    cta: "Explore archives",
    background: <img className="absolute -right-20 -top-20 opacity-30 object-cover" src="/images/leather.jpg" alt="" />,
    className: "lg:row-start-1 lg:row-end-4 lg:col-start-2 lg:col-end-3",
  },
  {
    Icon: InputIcon,
    name: "Private Offers",
    description: "Propose direct offers without public bidding pressure.",
    href: "#/products",
    cta: "Make an offer",
    background: <img className="absolute -right-20 -top-20 opacity-30 object-cover" src="/images/jeans.jpg" alt="" />,
    className: "lg:col-start-1 lg:col-end-2 lg:row-start-1 lg:row-end-3",
  },
  {
    Icon: GlobeIcon,
    name: "Local Kerala Courier",
    description: "Direct doorstep delivery across 695xxx pin codes in 24 to 48 hours.",
    href: "#/products",
    cta: "Learn more",
    background: <img className="absolute -right-20 -top-20 opacity-30 object-cover" src="/images/bag.jpg" alt="" />,
    className: "lg:col-start-1 lg:col-end-2 lg:row-start-3 lg:row-end-4",
  },
  {
    Icon: CalendarIcon,
    name: "Timed Weekend Drops",
    description: "Rare lots go live on transparent countdown clocks.",
    href: "#/auctions",
    cta: "View auctions",
    background: <img className="absolute -right-20 -top-20 opacity-30 object-cover" src="/images/knit.jpg" alt="" />,
    className: "lg:col-start-3 lg:col-end-3 lg:row-start-1 lg:row-end-2",
  },
  {
    Icon: BellIcon,
    name: "Live Outbid Signals",
    description: "Instant notification when another collector places a higher bid.",
    href: "#/auctions",
    cta: "Register alerts",
    background: <img className="absolute -right-20 -top-20 opacity-30 object-cover" src="/images/leather.jpg" alt="" />,
    className: "lg:col-start-3 lg:col-end-3 lg:row-start-2 lg:row-end-4",
  },
];

export function BentoDemo() {
  return (
    <BentoGrid className="lg:grid-rows-3 max-w-6xl mx-auto p-4">
      {features.map((feature) => (
        <BentoCard key={feature.name} {...feature} />
      ))}
    </BentoGrid>
  );
}

export default BentoDemo;

