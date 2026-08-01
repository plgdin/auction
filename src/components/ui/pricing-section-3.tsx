"use client";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { Briefcase, CheckCheck, Database } from "lucide-react";
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";

const plans = [
  {
    id: "starter",
    name: "Free",
    description: "Start discovering auctions for free — no credit card needed",
    price: 0,
    yearlyPrice: 0,
    buttonText: "Get started free",
    buttonVariant: "outline" as const,
    features: [
      { text: "10 watchlist items", icon: <Database size={20} /> },
    ],
    includes: [
      "Free includes:",
      "Auction search & browse with filters",
      "View auction details & PDF catalogs",
      "Basic commodity market prices",
      "Email closing reminders",
      "Direct link to official MSTC auctions",
      "Blog, news & FAQ access",
    ],
    href: "/checkout?plan=explorer",
  },
  {
    id: "go-subscription",
    name: "Individual",
    description: "Perfect for active bidders who want automated tools and extra limits",
    price: 799,
    yearlyPrice: 8438,
    buttonText: "Get Individual",
    buttonVariant: "outline" as const,
    features: [
      { text: "50 watchlist items", icon: <Database size={20} /> },
    ],
    includes: [
      "Everything in Free, plus:",
      "GST, Tax & Transport Cost Estimator",
      "Basic Max Bid Calculator",
      "Custom reminders & alerts",
      "Document vault for paperwork",
      "Inventory management",
      "Logistics quote requests",
      "Priority email support (24hr)",
    ],
    href: "/checkout?plan=go",
  },
  {
    id: "premium",
    name: "Business",
    description: "Full suite of AI-powered tools to find, value, and win auctions",
    price: 1499,
    yearlyPrice: 15830,
    buttonText: "Start 14-Day Free Trial",
    buttonVariant: "default" as const,
    popular: true,
    features: [
      { text: "Up to 5 seats", icon: <Briefcase size={20} /> },
      { text: "Unlimited watchlist", icon: <Database size={20} /> },
    ],
    includes: [
      "Everything in Individual, plus:",
      "Profit & Loss Valuation Calculator",
      "Scrap vs. Resale Value Breakdown",
      "Valuation Risk & Margin Warnings",
      "Live market rates & price history",
      "Scrap Price Trend Forecasts",
      "Smart Plain-English Search",
      "International price comparison",
    ],
    href: "/checkout?plan=pro",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description:
      "For organisations that need scale, security, and dedicated support",
    price: null,
    yearlyPrice: null,
    buttonText: "Contact Sales",
    buttonVariant: "outline" as const,
    features: [
      { text: "Up to 10 seats", icon: <Briefcase size={20} /> },
      { text: "Unlimited everything", icon: <Database size={20} /> },
    ],
    includes: [
      "Everything in Business, plus:",
      "What-If Bid Scenario Simulator",
      "Smart Top Bid Suggestions",
      "Custom commodity indices",
      "Seller portal access",
      "Single Sign-On (SSO)",
      "Dedicated account manager",
    ],
    href: "/contact",
  },
];

const PricingSwitch = ({
  onSwitch,
  className,
}: {
  onSwitch: (value: string) => void;
  className?: string;
}) => {
  const [selected, setSelected] = useState("0");

  const handleSwitch = (value: string) => {
    setSelected(value);
    onSwitch(value);
  };

  return (
    <div className={cn("flex justify-center", className)}>
      <div className="relative z-10 mx-auto flex w-fit rounded-full bg-slate-50 border border-slate-200 p-1">
        <button
          onClick={() => handleSwitch("0")}
          className={cn(
            "relative z-10 w-fit sm:h-12 cursor-pointer h-10 rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors",
            selected === "0"
              ? "text-blue-950 font-bold"
              : "text-muted-foreground hover:text-blue-900",
          )}
        >
          {selected === "0" && (
            <motion.span
              layoutId="switch"
              className="absolute top-0 left-0 sm:h-12 h-10 w-full rounded-full border-4 shadow-sm shadow-blue-200 border-blue-200 bg-gradient-to-t from-blue-50 via-blue-100 to-blue-200"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative">Monthly</span>
        </button>

        <button
          onClick={() => handleSwitch("1")}
          className={cn(
            "relative z-10 w-fit cursor-pointer sm:h-12 h-10 flex-shrink-0 rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors",
            selected === "1"
              ? "text-blue-950 font-bold"
              : "text-muted-foreground hover:text-blue-900",
          )}
        >
          {selected === "1" && (
            <motion.span
              layoutId="switch"
              className="absolute top-0 left-0 sm:h-12 h-10 w-full rounded-full border-4 shadow-sm shadow-blue-200 border-blue-200 bg-gradient-to-t from-blue-50 via-blue-100 to-blue-200"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            Yearly
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-primary">
              Save 12%
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default function PricingSection3({
  isYearly: externalIsYearly,
  onYearlyChange,
}: {
  isYearly?: boolean;
  onYearlyChange?: (value: boolean) => void;
}) {
  const [internalIsYearly, setInternalIsYearly] = useState(false);
  const isYearly = externalIsYearly !== undefined ? externalIsYearly : internalIsYearly;
  const setIsYearly = onYearlyChange || setInternalIsYearly;

  const pricingRef = useRef<HTMLDivElement>(null);

  const revealVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        delay: i * 0.3,
        duration: 0.5,
      },
    }),
    hidden: {
      filter: "blur(10px)",
      y: -20,
      opacity: 0,
    },
  };

  const togglePricingPeriod = (value: string) =>
    setIsYearly(Number.parseInt(value) === 1);

  return (
    <div
      className="px-4 pt-20 pb-16 min-h-screen max-w-7xl mx-auto relative"
      ref={pricingRef}
    >
      <article className="flex sm:flex-row flex-col sm:pb-8 pb-4 sm:items-center items-start justify-between">
        <div className="text-left mb-6">
          <h2 className="text-4xl font-medium leading-[130%] text-gray-900 mb-4">
            <VerticalCutReveal
              splitBy="words"
              staggerDuration={0.15}
              staggerFrom="first"
              reverse={true}
              containerClassName="justify-start"
              transition={{
                type: "spring",
                stiffness: 250,
                damping: 40,
                delay: 0,
              }}
            >
              Plans & Pricing
            </VerticalCutReveal>
          </h2>

          <TimelineContent
            as="p"
            animationNum={0}
            timelineRef={pricingRef}
            customVariants={revealVariants}
            className="text-gray-600 w-[80%]"
          >
            Trusted by millions, We help teams all around the world. Explore
            which option is right for you.
          </TimelineContent>
        </div>

        <TimelineContent
          as="div"
          animationNum={1}
          timelineRef={pricingRef}
          customVariants={revealVariants}
        >
          <PricingSwitch onSwitch={togglePricingPeriod} className="shrink-0" />
        </TimelineContent>
      </article>

      <TimelineContent
        as="div"
        animationNum={2}
        timelineRef={pricingRef}
        customVariants={revealVariants}
        className="grid xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-6 mx-auto bg-gradient-to-b from-neutral-100 to-neutral-200 sm:p-3 rounded-lg"
      >
        {plans.map((plan, index) => (
          <TimelineContent
            as="div"
            key={plan.name}
            animationNum={index + 3}
            timelineRef={pricingRef}
            customVariants={revealVariants}
            className="flex h-full"
          >
            <Card
              className={cn(
                "relative flex-col flex justify-between w-full h-full min-h-[580px]",
                plan.popular
                  ? "scale-105 xl:scale-105 ring-2 ring-blue-900 bg-gradient-to-t from-slate-950 via-slate-900 to-blue-950 text-white"
                  : "border-none shadow-none bg-transparent pt-4 text-gray-900"
              )}
            >
              <CardContent className="pt-0 flex-1 flex flex-col justify-between">
                <div>
                  <div className="space-y-2 pb-3">
                    {plan.popular && (
                      <div className="pt-4">
                        <span className="bg-blue-800 text-white px-3 py-1 rounded-full text-xs font-medium">
                          Popular
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col pt-4">
                      <div className="flex items-baseline">
                        {plan.price === 0 ? (
                          <span className="text-4xl font-semibold">Free</span>
                        ) : plan.price === null ? (
                          <span className="text-4xl font-semibold">Custom</span>
                        ) : (
                          <>
                            <span className="text-4xl font-semibold">
                              ₹
                              <NumberFlow
                                format={{
                                  style: "decimal",
                                }}
                                value={isYearly ? plan.yearlyPrice : plan.price}
                                className="text-4xl font-semibold"
                              />
                            </span>
                            <span
                              className={cn(
                                "ml-1 text-sm",
                                plan.popular ? "text-blue-200" : "text-gray-600"
                              )}
                            >
                              /{isYearly ? "year" : "month"}
                            </span>
                          </>
                        )}
                      </div>
                      {isYearly && plan.price !== 0 && plan.price !== null && (
                        <span
                          className={cn(
                            "text-xs mt-1 font-medium",
                            plan.popular ? "text-blue-300" : "text-gray-500"
                          )}
                        >
                          Effective: ₹{Math.round(plan.yearlyPrice / 12)}/month
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <h3 className="text-3xl font-semibold mb-2">{plan.name}</h3>
                  </div>
                  <p
                    className={cn(
                      "text-sm mb-4 min-h-[40px]",
                      plan.popular ? "text-blue-200" : "text-gray-600"
                    )}
                  >
                    {plan.description}
                  </p>

                  <div className={cn("space-y-3 pt-4 border-t", plan.popular ? "border-blue-900" : "border-neutral-200")}>
                    <h4 className="font-medium text-base mb-3">
                      {plan.includes[0]}
                    </h4>
                    <ul className="space-y-2 font-semibold">
                      {plan.includes.slice(1).map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start">
                          <span
                            className={cn(
                              "h-6 w-6 rounded-full grid place-content-center mt-0.5 mr-3 shrink-0 border",
                              plan.popular
                                ? "text-white bg-blue-700 border-blue-600"
                                : "text-blue-600 bg-white border-blue-200"
                            )}
                          >
                            <CheckCheck className="h-4 w-4" />
                          </span>
                          <span
                            className={cn(
                              "text-sm",
                              plan.popular ? "text-blue-100" : "text-gray-600"
                            )}
                          >
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-4 pb-6">
                <Link
                  to={`${plan.href}${plan.id !== "enterprise" ? `&billing=${isYearly ? "annual" : "monthly"}` : ""}`}
                  className="w-full"
                >
                  <button
                    className={cn(
                      "w-full mb-6 p-4 text-xl rounded-xl cursor-pointer font-semibold transition-all duration-200 hover:opacity-95",
                      plan.popular
                        ? "bg-gradient-to-t from-blue-50 via-blue-100 to-blue-200 shadow-lg shadow-blue-900/20 border border-blue-300 text-blue-950"
                        : plan.buttonVariant === "outline"
                          ? "bg-gradient-to-t from-blue-900 to-blue-700 shadow-lg shadow-blue-950/40 border border-blue-800 text-white"
                          : "bg-gradient-to-t from-blue-50 via-blue-100 to-blue-200 border border-blue-300 text-blue-950"
                    )}
                  >
                    {plan.buttonText}
                  </button>
                </Link>
              </CardFooter>
            </Card>
          </TimelineContent>
        ))}
      </TimelineContent>
    </div>
  );
}
