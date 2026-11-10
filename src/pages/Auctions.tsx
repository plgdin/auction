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
    <main className="page-shell auctions-page bg-[#0c0e09] text-white min-h-screen">
      <div className="section-wrap">
        <PageHeader
          eyebrow="THE RANDOM AUCTION"
          title={
            <>
              A few pieces go <em className="italic text-[#E9B949]">live.</em>
            </>
          }
          description="Every day a small, random selection of opted-in listings runs as a short live auction. Anonymous bidding, anti-snipe protection, and sellers always receive at least their asking price."
          action={
            live.length ? (
              <div className="auction-stat-block text-right">
                <span className="inline-flex items-center gap-1.5 text-white font-semibold">
                  <i className="w-2 h-2 rounded-full bg-[#E4472B] animate-pulse" /> {live.length} live
                </span>
                <span className="text-xs text-stone-400 block">{totalBids} bids placed</span>
              </div>
            ) : undefined
          }
        />

        <div className="auction-explain grid grid-cols-1 md:grid-cols-3 gap-3 my-8">
          <div className="bg-[#14160f] border border-white/10 rounded-xl p-5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-lg bg-[#E9B949]/15 border border-[#E9B949]/30 flex items-center justify-center text-[#E9B949] mb-1">
              <Gavel size={20} />
            </div>
            <strong className="text-sm font-bold text-white">Auctions are optional</strong>
            <p className="text-xs text-stone-300 leading-relaxed">
              Sellers opt in. Everything else stays buy-now or make-an-offer.
            </p>
          </div>

          <div className="bg-[#14160f] border border-white/10 rounded-xl p-5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-lg bg-[#9DB29A]/15 border border-[#9DB29A]/30 flex items-center justify-center text-[#9DB29A] mb-1">
              <ShieldCheck size={20} />
            </div>
            <strong className="text-sm font-bold text-white">Bidders stay anonymous</strong>
            <p className="text-xs text-stone-300 leading-relaxed">
              Only aliases appear in the bid feed. Never names or emails.
            </p>
          </div>

          <div className="bg-[#14160f] border border-white/10 rounded-xl p-5 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-lg bg-[#E4472B]/15 border border-[#E4472B]/30 flex items-center justify-center text-[#E4472B] mb-1">
              <Clock3 size={20} />
            </div>
            <strong className="text-sm font-bold text-white">Last-second bids extend</strong>
            <p className="text-xs text-stone-300 leading-relaxed">
              A bid inside the final seconds adds time so nobody wins by luck.
            </p>
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
          <div className="auction-grid auctions-grid my-8">
            {source.map((auction) => {
              const product = db.products.find((item) => item.id === auction.productId);
              return product ? (
                <AuctionCard key={auction.id} auction={auction} product={product} />
              ) : null;
            })}
          </div>
        ) : (
          <div className="my-12">
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
          </div>
        )}

        <section className="auction-finance mt-12 bg-[#14160f] border border-white/15 rounded-2xl p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7">
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-[#E9B949] mb-2">
              HOW THE MONEY WORKS
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif text-white leading-snug">
              The seller never earns less than their asking price.
            </h2>
            <p className="text-stone-300 text-sm sm:text-base mt-3 leading-relaxed">
              If the winning bid is below the asking price, lelam covers the difference as a
              platform subsidy. If the bid is above it, a small platform commission applies only to
              the amount above the asking price. The seller keeps the rest.
            </p>
            <Link
              href="#/seller"
              className="inline-flex items-center gap-1.5 mt-5 font-mono text-sm font-bold text-[#E9B949] hover:underline"
            >
              <span>Sell and opt in</span>
              <ArrowUpRight size={16} />
            </Link>
          </div>

          <div className="lg:col-span-5 bg-[#1a1d15] border border-white/15 rounded-xl p-6 text-white space-y-3 font-mono text-xs sm:text-sm shadow-xl">
            <div className="flex items-center justify-between text-stone-300">
              <span>Asking price</span>
              <strong className="text-white font-bold">{formatMoney(145000)}</strong>
            </div>
            <div className="flex items-center justify-between text-stone-300">
              <span>Winning bid</span>
              <strong className="text-white font-bold">{formatMoney(110000)}</strong>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-white/15 text-sm sm:text-base">
              <span className="font-bold text-[#E9B949]">Seller payout</span>
              <strong className="font-black text-[#E9B949]">{formatMoney(145000)}</strong>
            </div>
            <p className="text-[11px] text-stone-400 pt-2 border-t border-white/10">
              Platform subsidy {formatMoney(35000)} · commission {formatMoney(0)}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default AuctionsPage;
