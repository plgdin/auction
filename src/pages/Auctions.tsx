import { useEffect, useState } from "react";
import { ArrowUpRight, Clock3, Gavel, ShieldCheck, Sparkles } from "lucide-react";
import { AuctionCard } from "../components/AuctionCard";
import { Link } from "../components/Link";
import { PageHeader, Tabs, EmptyState } from "../components/Ui";
import { formatMoney } from "../lib/format";
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
          eyebrow="THE RANDOM AUCTION"
          title={
            <>
              A few pieces go <em>live.</em>
            </>
          }
          description="Every day a small, random selection of opted-in listings runs as a short live auction. Anonymous bidding, anti-snipe protection, and sellers always receive at least their asking price."
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
            window.location.hash = `#/auctions?tab=${next}`;
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
            actionHref="#/products"
          />
        )}

        <section className="auction-finance section-wrap-inner">
          <div className="auction-finance-copy">
            <div className="eyebrow">HOW THE MONEY WORKS</div>
            <h2>A small commission, only on what sells above asking.</h2>
            <p>
              If the winning bid is above the asking price, a small platform commission applies only to
              the amount above the asking price. The seller keeps the rest.
            </p>
            <Link href="#/seller" className="text-link">
              Sell and opt in <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="auction-finance-example">
            <div>
              <span>Asking price</span>
              <strong>{formatMoney(145000)}</strong>
            </div>
            <div>
              <span>Winning bid</span>
              <strong>{formatMoney(160000)}</strong>
            </div>
            <div className="is-highlight">
              <span>Seller payout</span>
              <strong>{formatMoney(145000)}</strong>
            </div>
            <p>Platform subsidy {formatMoney(0)} · commission {formatMoney(15000)}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
