import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Clock3, Plus, ShieldCheck, Tag, Truck } from "lucide-react";
import { navigate, smoothScrollTo } from "../components/Link";
import { formatMoney } from "../lib/format";
import { useStore } from "../lib/store";
import { auctionStartingPrice } from "../lib/sellerMath";

/** Chosen in the payout preview, handed to the listing form page. */
export const SESSION_PRICE_KEY = "lelam-sell-price";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Count a figure up once the section scrolls in. Skipped under reduced motion. */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, inView };
}

function useCountUp(target: number, run: boolean, duration = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run, target, duration]);
  return value;
}

/* ------------------------------------------------------------------ hero -- */

function SellHero({ onStart, onPeek }: { onStart: () => void; onPeek: () => void }) {
  const { db } = useStore();
  const deck = db.products
    .filter((product) => ["active", "sold"].includes(product.status) && product.images.length)
    .slice(0, 3);
  // Ticker mixes freshly sold with live pieces so the line always has variety.
  const seen = new Set<string>();
  const tickerLine: { label: string; price: number; verb: string }[] = [];
  for (const product of [
    ...db.products.filter((item) => item.status === "sold").slice(-3),
    ...db.products.filter((item) => item.status === "active").slice(0, 5),
  ]) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    tickerLine.push({
      label: product.title,
      price: product.askingPrice,
      verb: product.status === "sold" ? "re-homed" : "on the rail",
    });
    if (tickerLine.length === 7) break;
  }
  const tickerSource = tickerLine.length
    ? tickerLine
    : [{ label: "Your piece fits here", price: 0, verb: "list yours" }];

  return (
    <header className="sell-hero">
      <div className="sell-hero-inner">
        <div className="sell-hero-copy">
          <h1>
            Your closet is a <em>shop.</em> You just haven't opened it.
          </h1>
          <p>
            Photograph it, price it, done. A rider collects from your door and goes. Your asking price
            is guaranteed — and any piece can be picked at random for a live feature. It only adds upside.
          </p>
          <div className="sell-hero-actions">
            <button type="button" className="button button-olive sell-hero-cta" onClick={onStart}>
              Start selling <ArrowUpRight size={18} />
            </button>
            <button type="button" className="text-link sell-hero-peek" onClick={onPeek}>
              See how it works <ArrowDown size={15} />
            </button>
          </div>
          <ul className="sell-hero-proof">
            <li>
              <Truck size={15} /> Rider doorstep, both ways
            </li>
            <li>
              <ShieldCheck size={15} /> Your price locked
            </li>
            <li>
              <Plus size={15} /> Free to list
            </li>
          </ul>
        </div>

        <div className="sell-hero-deck">
          {deck.map((product, index) => (
            <div key={product.id} className={`sell-deck-card deck-${index + 1}`}>
              <img src={product.images[0]} alt="" />
              <span className="sell-deck-tag">{formatMoney(product.askingPrice)}</span>
            </div>
          ))}
          {deck[0] && <em className="sell-deck-note sell-note-1" aria-hidden>on the rail now</em>}
          {deck[2] && <em className="sell-deck-note is-low sell-note-3" aria-hidden>might be picked at random</em>}
          {deck.length === 0 && <div className="sell-deck-empty">The rail is waiting for its first piece.</div>}
        </div>
      </div>

      <div className="sell-ticker" aria-hidden>
        <div className="sell-ticker-track">
          {[...tickerSource, ...tickerSource, ...tickerSource, ...tickerSource].map((item, index) => (
            <span key={index}>
              <strong>{item.label}</strong>
              {item.price ? ` · ${formatMoney(item.price)} — ${item.verb}` : ` — ${item.verb}`}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------- proof band -- */

function ProofBand() {
  const { db } = useStore();
  const moneyMoved = db.settlements
    .filter((settlement) => settlement.status === "paid")
    .reduce((total, settlement) => total + settlement.sellerPayout, 0);
  const rehomed = db.products.filter((product) => product.status === "sold").length;
  const sellers = new Set(db.products.map((product) => product.sellerId)).size;

  const band = useInView<HTMLDivElement>();
  const money = useCountUp(moneyMoved, band.inView);
  const pieces = useCountUp(rehomed, band.inView);
  const people = useCountUp(sellers, band.inView);

  return (
    <section className="sell-proof" ref={band.ref}>
      <div className="sell-proof-fig">
        <strong>{formatMoney(money)}</strong>
        <span>changed hands outside of closets</span>
      </div>
      <div className="sell-proof-fig">
        <strong>{pieces}</strong>
        <span>piece{pieces === 1 ? "" : "s"} given a second life</span>
      </div>
      <div className="sell-proof-fig">
        <strong>{people}</strong>
        <span>neighbor{people === 1 ? "" : "s"} selling here</span>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- benefits -- */

const BENEFITS = [
  {
    icon: <Truck size={20} />,
    title: "We handle delivery",
    body: "A rider comes to your door, takes the parcel, and goes. Hand it over — that is genuinely the last you do.",
    note: "you never meet anybody. ever.",
  },
  {
    icon: <ShieldCheck size={20} />,
    title: "Your price, protected",
    body: "Name your price. If bidding stops short, lelam covers the gap. The flat ₹10 sale charge still applies.",
    note: "your floor is a promise",
  },
  {
    icon: <Clock3 size={20} />,
    title: "Two minutes to list",
    body: "Photos, a title, a price. Listing is free — a flat ₹10 platform charge applies only when a product sells.",
    note: "that's the whole job",
  },
  {
    icon: <Tag size={20} />,
    title: "Offers come to you",
    body: "Buyers send private offers to your dashboard, on a 48-hour clock. You accept or pass.",
    note: "no haggling out loud",
  },
];

function Benefits() {
  return (
    <section className="sell-benefits">
      <h2 className="sell-section-title">
        Selling here means <em>less</em>, not more.
      </h2>
      <div className="sell-benefit-panel">
        {BENEFITS.map((benefit) => (
          <div key={benefit.title} className="sell-benefit">
            <span className="sell-benefit-icon">{benefit.icon}</span>
            <h3>{benefit.title}</h3>
            <p>{benefit.body}</p>
            <em>{benefit.note}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- twist -- */

function TwistBand() {
  return (
    <section id="sell-twist" className="sell-twist">
      <div className="sell-twist-head">
        <h2 className="sell-section-title">
          The <em>twist.</em> Sometimes we pull your piece for a live auction.
        </h2>
        <p>
          Any listing can be picked at random and run live for half an hour. Nothing changes for the
          impatient — buyers can still tap Buy now at your price, like any shop they know. But if
          yours is picked, three things turn in your favour:
        </p>
      </div>
      <div className="sell-twist-grid">
        <div className="sell-twist-card">
          <span>01</span>
          <h3>It sells faster</h3>
          <p>Bidding wraps in under half an hour. Your piece moves off the rail in days, not weeks.</p>
        </div>
        <div className="sell-twist-card">
          <span>02</span>
          <h3>Never under your price</h3>
          <p>If bidding ends below base, lelam covers the gap. The flat ₹10 charge still applies to the sale.</p>
        </div>
        <div className="sell-twist-card">
          <span>03</span>
          <h3>You keep the upside</h3>
          <p>If bidding clears 130% of your base price, lelam takes 10% of the amount above base. You keep the rest.</p>
        </div>
      </div>
      <em className="sell-twist-note">the feature only adds upside · flat ₹10 platform charge per product sold</em>
    </section>
  );
}

/* ------------------------------------------------------------- how it works -- */

function PayoutWidget({ onLockIn }: { onLockIn: (rupees: number) => void }) {
  const [price, setPrice] = useState(1450);
  const startPct = 50;
  const startingBid = auctionStartingPrice(price * 100, startPct);

  return (
    <div className="payout-widget">
      <div className="payout-widget-controls">
        <label>
          <span>How much is it worth?</span>
          <input
            type="range"
            min={200}
            max={8000}
            step={50}
            value={price}
            onChange={(event) => setPrice(Number(event.target.value))}
            aria-label="Asking price to preview"
          />
        </label>
        <output className="payout-widget-price">{formatMoney(price * 100)}</output>
      </div>
      <dl className="payout-receipt">
        <div>
          <dt>Asking price</dt>
          <dd>{formatMoney(price * 100)}</dd>
        </div>
        <div>
          <dt>Delivery, arranged for you</dt>
          <dd>rider pickup + drop</dd>
        </div>
        <div>
          <dt>Platform charge</dt>
          <dd>flat ₹10 · per product</dd>
        </div>
        <div className="is-total">
          <dt>You pocket</dt>
          <dd>{formatMoney(Math.max(0, price * 100 - 1_000))}</dd>
        </div>
        <div>
          <dt>If it runs live instead</dt>
          <dd>
          starts at 50% of base ({formatMoney(startingBid)}) · your {formatMoney(price * 100)} is still guaranteed
          </dd>
        </div>
      </dl>
      <button type="button" className="button button-olive payout-widget-cta" onClick={() => onLockIn(price)}>
        Lock that in — it pre-fills the price
      </button>
    </div>
  );
}

function HowItWorks({ onStart }: { onStart: (rupees?: number) => void }) {
  return (
    <section id="sell-how" className="sell-how">
      <h2 className="sell-section-title">
        Three steps. Then <em>we</em> work.
      </h2>
      <ol className="sell-steps">
        <li>
          <span className="sell-step-no">01</span>
          <h3>Photograph it</h3>
          <p>Natural light, three snaps, up to six. Steady shots help buyers trust what arrives.</p>
          <em>flaws are features — say them</em>
        </li>
        <li>
          <span className="sell-step-no">02</span>
          <h3>Price it</h3>
          <p>Your number goes on the rail. Offers arrive privately; you never answer anyone in person.</p>
          <em>drag the number, watch it print</em>
        </li>
        <li>
          <span className="sell-step-no">03</span>
          <h3>We take it from here</h3>
          <p>
            Buyer pays. A rider swings by, takes the parcel, and is gone. Payout lands within 5
            business days of the buyer confirming arrival.
          </p>
          <em>you stay home</em>
        </li>
      </ol>

      <div className="sell-how-widget">
        <PayoutWidget onLockIn={onStart} />
      </div>

      <div className="sell-how-end">
        <button type="button" className="text-link" onClick={() => onStart()}>
          That's honestly it — open the listing form <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ voices -- */

function Voices() {
  const { db } = useStore();
  const quotes = useMemo(
    () =>
      db.reviews.slice(0, 2).map((review) => ({
        comment: review.comment ?? "",
        rating: review.rating,
        product: db.products.find((item) => item.id === review.productId),
      })),
    [db.reviews, db.products],
  );
  const usable = quotes.filter((quote) => quote.comment);
  if (!usable.length) return null;

  return (
    <section className="sell-voices">
      <h2 className="sell-section-title">Things buyers wrote back.</h2>
      <div className="sell-voice-row">
        {usable.map((quote, index) => (
          <figure key={index} className="sell-voice">
            “{quote.comment}”
            <figcaption>
              {quote.product && <img src={quote.product.images[0]} alt="" aria-hidden />}
              <span>
                bought · {quote.product?.title ?? "piece"}
                <em>{"★".repeat(Math.max(1, Math.min(5, quote.rating)))}</em>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- closing -- */

function SellClosing({ onStart }: { onStart: () => void }) {
  return (
    <section className="sell-final">
      <div>
        <h2>
          Still waving it <em>away?</em>
        </h2>
        <p>List it. Somehow it always works out — and you never had to meet anyone.</p>
      </div>
      <button type="button" className="button button-olive" onClick={onStart}>
        Open the shop today <ArrowUpRight size={16} />
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------- sell -- */

export function SellPage() {
  const { user } = useStore();

  const startSelling = () => {
    if (user) navigate("#/sell/new");
    else navigate("#/register?next=%2Fsell%2Fnew");
  };

  const scrollToHow = () => {
    smoothScrollTo(document.getElementById("sell-how"));
  };

  const lockInPrice = (rupees?: number) => {
    if (rupees) sessionStorage.setItem(SESSION_PRICE_KEY, String(rupees));
    startSelling();
  };

  return (
    <main className="page-shell sell-page">
      <SellHero onStart={startSelling} onPeek={scrollToHow} />
      <ProofBand />
      <Benefits />
      <TwistBand />
      <HowItWorks onStart={lockInPrice} />
      <Voices />
      <SellClosing onStart={startSelling} />
    </main>
  );
}
