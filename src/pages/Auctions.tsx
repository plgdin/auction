import { useEffect, useState } from "react";
import { ArrowUpRight, Clock3, Gavel, ShieldCheck, Sparkles } from "lucide-react";
import { AuctionCard } from "../components/AuctionCard";
import { navigate } from "../components/Link";
import { PageHeader, Tabs, EmptyState } from "../components/Ui";
import { OriginButton } from "@/components/ui/origin-button";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";

export function AuctionsPage() {
  const { db } = useStore();
  const route = useRoute();
  const [tab, setTab] = useState(route.query.get("tab") || "live");

  useEffect(() => {
    setTab(route.query.get("tab") || "live");
  }, [route.query]);

  const live = db.auctions.filter((auction) => auction.status === "live");
  const upcoming = db.auctions
    .filter((auction) => auction.status === "scheduled")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const completed = db.auctions
    .filter((auction) => auction.status === "completed" || auction.status === "cancelled")
    .sort((a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime());

  const source = tab === "live" ? live : tab === "upcoming" ? upcoming : completed;
  const totalBids = live.reduce((total, auction) => total + auction.bidCount, 0);

  return (
    <main className="page-shell auctions-page">
      <div className="section-wrap">
        <PageHeader
          title={
            <>
              A few pieces go <em>live.</em>
            </>
          }
          description="Every day a small, random selection of opted-in listings runs as a short live auction. Anonymous bidding, binding bids, and anti-snipe protection."
          action={
            live.length ? (
              <div className="auction-stat-block">
                <span>
                  <i className="live-dot" /> {live.length} live
                </span>
                <span>{totalBids} bids placed</span>
              </div>
            ) : undefined
          }
        />

        <div className="auction-explain">
          <div>
            <Gavel size={18} />
            <strong>Auctions are optional</strong>
            <p>Sellers opt in. Everything else stays buy-now or make-an-offer.</p>
          </div>
          <div>
            <ShieldCheck size={18} />
            <strong>Bidders stay anonymous</strong>
            <p>Only aliases appear in the bid feed. Never names or emails.</p>
          </div>
          <div>
            <Clock3 size={18} />
            <strong>Last-second bids extend</strong>
            <p>A bid inside the final seconds adds time so nobody wins by luck.</p>
          </div>
        </div>

        <Tabs
          tabs={[
            { id: "live", label: "Live now", count: live.length },
            { id: "upcoming", label: "Upcoming", count: upcoming.length },
            { id: "completed", label: "Results", count: completed.length },
          ]}
          active={tab}
          onChange={(next) => {
            setTab(next);
            navigate(`/auctions?tab=${next}`);
          }}
        />

        {source.length ? (
          <div className="auction-grid auctions-grid">
            {source.map((auction) => {
              const product = db.products.find((item) => item.id === auction.productId);
              return product ? (
                <AuctionCard key={auction.id} auction={auction} product={product} />
              ) : null;
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Sparkles size={34} />}
            title={tab === "live" ? "No auction running right now." : "Nothing here yet."}
            body={
              tab === "live"
                ? "The marketplace is still open. Shop normally, or check what is coming up next."
                : "Check back soon. Auctions are scheduled daily from opted-in listings."
            }
            action="Shop the rail"
            actionHref="/products"
          />
        )}

        <section className="auction-finance section-wrap-inner">
          <div className="auction-finance-copy">
            <div className="eyebrow">HOW AUCTIONS WORK</div>
            <h2>A fair shot at a better price.</h2>
            <p>
              Every day a small set of opted-in pieces goes live. Bidding is anonymous — aliases
              only. Every bid is binding and must meet the minimum increment shown on the listing.
              A bid in the final 30 seconds adds 30 more seconds, so nobody wins by luck. The
              highest valid bid when the clock runs out wins and pays within 5 minutes.
            </p>
            <p>
              One flat 10% standard seller commission (5% for verified sellers) applies to every sale, GST included — sell for
              ₹1,000 and you keep ₹900 (or ₹950 if verified).
            </p>
            <div className="mt-5">
              <OriginButton
                onClick={() => {
                  navigate("/auctions?tab=live");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="bg-[#FAF7F2] text-[#493022] border-[#493022]/20 hover:border-[#493022]"
              >
                <span>See live auctions</span>
                <ArrowUpRight size={16} />
              </OriginButton>
            </div>
          </div>
          <div className="auction-finance-example">
            <div>
              <span>Bidding</span>
              <strong>Anonymous aliases only</strong>
            </div>
            <div>
              <span>Closing</span>
              <strong>Final 30s adds 30s</strong>
            </div>
            <div>
              <span>Winner</span>
              <strong>Highest valid bid</strong>
            </div>
            <div className="is-highlight">
              <span>Payment</span>
              <strong>Within 5 minutes</strong>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
