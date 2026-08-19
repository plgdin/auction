"use client";

import { Pricing } from "@/components/ui/pricing";
import { PLANS } from "@/utils/pricingConfig";

export function PricingBasic() {
  return (
    <Pricing 
      plans={PLANS}
      title="Simple, Transparent Pricing"
      description={"Choose the plan that fits your auction strategy\nAll plans include full access to our discovery platform with direct MSTC portal integration."}
    />
  );
}
