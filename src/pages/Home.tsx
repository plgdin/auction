import { ArrowRight, Check, Leaf, Recycle, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Link } from "../components/Link";

function CoinsIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <ellipse cx="20" cy="10" rx="12" ry="4.6" />
      <path d="M8 10v6c0 2.5 5.4 4.6 12 4.6s12-2.1 12-4.6v-6M8 16v6c0 2.5 5.4 4.6 12 4.6s12-2.1 12-4.6v-6M8 22v6c0 2.5 5.4 4.6 12 4.6s12-2.1 12-4.6v-6" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M30 6C16 6 8 13 8 23c0 4 2 8 5 10C24 32 31 22 30 6Z" />
      <path d="M12 32c4-9 10-15 17-21" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 5c4 3 8 4.4 12 4.8v9.4C32 26 27 32 20 35c-7-3-12-9-12-15.8V9.8C12 9.4 16 8 20 5Z" />
      <path d="m14 19.5 4 4 8-8.5" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="12" r="4.4" />
      <circle cx="10" cy="16" r="3.4" />
      <circle cx="30" cy="16" r="3.4" />
      <path d="M12 30c0-4.6 3.4-7.6 8-7.6s8 3 8 7.6M3.5 29c.4-3.4 2.6-5.4 6-5.4M30.5 23.6c3.4 0 5.6 2 6 5.4" />
    </svg>
  );
}

const benefits = [
  { icon: <Leaf />, text: <>Declutter<br />your space</> },
  { icon: <span className="paper-rupee">₹</span>, text: <>Earn<br />extra cash</> },
  { icon: <Recycle />, text: <>Give items<br />a longer life</> },
  { icon: <Sparkles />, text: <>Support<br />sustainable fashion</> },
];

const reasons = [
  { icon: <CoinsIcon />, title: <>Turn clutter<br />into cash</>, body: "Give unused items a new home and earn while you declutter." },
  { icon: <LeafIcon />, title: <>A more<br />sustainable you</>, body: "Reduce textile waste and be part of a circular fashion cycle." },
  { icon: <ShieldIcon />, title: <>Simple &amp;<br />secure</>, body: "Verified buyers, safe transactions, and reliable support." },
  { icon: <PeopleIcon />, title: <>A community<br />that values pre-loved</>, body: "Connect with mindful shoppers who love quality and unique finds." },
];

function PaperTape({ className = "" }: { className?: string }) {
  return <span className={`paper-tape ${className}`} aria-hidden="true" />;
}

function Tear({ edge, tone = "paper" }: { edge: "top" | "bottom"; tone?: "paper" | "rose" | "kraft" }) {
  return (
    <svg className={`paper-tear is-${edge} tone-${tone}`} viewBox="0 0 1024 34" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="paper-tear-rough" x="-2%" y="-30%" width="104%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency=".006 .16" numOctaves="2" seed="9" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <path filter="url(#paper-tear-rough)" d="M0 18C52 12 96 22 152 16S252 10 312 17 402 24 462 15 552 9 612 18 704 23 764 14 852 10 912 18 984 22 1024 14V34H0Z" />
    </svg>
  );
}

function LaptopIllustration() {
  return (
    <div className="paper-laptop" aria-label="A listing displayed on a laptop">
      <div className="paper-laptop-screen">
        <div className="paper-laptop-top"><i /><i /><i /></div>
        <div className="paper-laptop-grid">
          {["/images/knit.jpg", "/images/jeans.jpg", "/images/leather.jpg", "/images/tee.jpg"].map((src) => <img key={src} src={src} alt="" />)}
        </div>
      </div>
      <span className="paper-laptop-base" />
    </div>
  );
}

function ParcelIllustration() {
  return (
    <div className="paper-parcel" aria-label="A neatly wrapped parcel ready for pickup">
      <span className="paper-parcel-box" />
      <span className="paper-parcel-knot" />
      <span className="paper-parcel-label"><i /><i /><i /></span>
    </div>
  );
}

function PaymentIllustration() {
  return (
    <div className="paper-phone" aria-label="Payment received">
      <div className="paper-phone-camera" />
      <span className="paper-phone-check"><Check size={22} /></span>
      <strong>Payment<br />Received</strong>
    </div>
  );
}

export function HomePage() {
  return (
    <main id="top" className="paper-home">
      <section className="paper-hero" aria-labelledby="paper-hero-title">
        <div className="paper-hero-inner">
          <div className="paper-hero-copy">
            <h1 id="paper-hero-title">Give Your<br />Closet a<br /><span>Second Life.</span></h1>
            <span className="paper-spark-lines" aria-hidden="true"><i /><i /><i /></span>
            <p>Turn your pre-loved clothes, accessories and more into cash — easily, safely, and sustainably with lelam.co.</p>
            <Link href="#/sell" className="paper-primary-cta">Start Selling Now <ArrowRight size={22} /></Link>
            <ul className="paper-proof-list">
              <li><Zap size={18} /> List in 2 minutes</li>
              <li><ShieldCheck size={18} /> Safe &amp; trusted</li>
              <li><Recycle size={18} /> Sustainable</li>
            </ul>
          </div>

          <div className="paper-hero-collage" aria-label="Pre-loved clothes and accessories">
            <figure className="paper-polaroid paper-jacket">
              <PaperTape />
              <img src="/images/leather.jpg" alt="A secondhand leather jacket" />
            </figure>
            <figure className="paper-polaroid paper-knitwear">
              <PaperTape />
              <img src="/images/knit.jpg" alt="A soft pre-loved knit" />
            </figure>
            <figure className="paper-polaroid paper-camera">
              <PaperTape />
              <img src="/images/bag.jpg" alt="A pre-loved designer bag" />
            </figure>
            <div className="paper-stamp" aria-label="Sell, wear, repeat"><span>SELL</span><span>WEAR</span><span>REPEAT</span></div>
            <svg className="paper-postmark" viewBox="0 0 180 80" aria-hidden="true"><path d="M4 12c32 0 29-11 59-11s28 11 59 11 28-11 54-11M4 35c32 0 29-11 59-11s28 11 59 11 28-11 54-11M4 58c32 0 29-11 59-11s28 11 59 11 28-11 54-11" /></svg>
            <svg className="paper-botanical paper-botanical-hero" viewBox="0 0 130 170" aria-hidden="true"><path d="M13 161C45 115 61 73 104 11M40 119c-16-3-24-13-27-29 16 1 27 8 27 29Zm23-42c-17-2-27-12-30-28 17 1 29 9 30 28Zm23-38c-15-4-21-14-21-29 15 3 23 12 21 29Zm-18 64c15-12 29-12 43-5-11 13-26 16-43 5Zm20-39c15-12 28-12 42-5-11 12-25 15-42 5Z" /></svg>
          </div>
        </div>
      </section>

      <section className="paper-benefits-strip" aria-label="Why give your clothes a second life">
        <Tear edge="top" tone="rose" />
        <div className="paper-benefits-inner">
          {benefits.map((benefit, index) => <div className="paper-benefit" key={index}>{benefit.icon}<span>{benefit.text}</span></div>)}
        </div>
        <Tear edge="bottom" tone="rose" />
      </section>

      <section className="paper-how" aria-labelledby="paper-how-title">
        <div className="paper-how-heading">
          <h2 id="paper-how-title">How Selling<br />on <em>lelam.co</em> Works</h2>
          <div className="paper-note"><PaperTape /><span>It’s simple,<br />quick, and hassle-free.</span></div>
          <svg className="paper-heading-scribble" viewBox="0 0 120 15" aria-hidden="true"><path d="M3 10 64 3 39 13 116 7" /></svg>
        </div>
        <div className="paper-steps">
          <article className="paper-step">
            <figure className="paper-step-photo"><PaperTape /><img src="/images/jeans.jpg" alt="Fold your item neatly" /><span className="paper-step-number">1</span></figure>
            <h3>List Your Item</h3>
            <p>Add photos, a short description, and your price in just a few clicks.</p>
          </article>
          <svg className="paper-step-arrow arrow-one" viewBox="0 0 48 20" aria-hidden="true"><path d="M2 10c13-1 24-1 39 0m-8-7 8 7-8 7" /></svg>
          <article className="paper-step">
            <figure className="paper-step-photo"><PaperTape /><LaptopIllustration /><span className="paper-step-number">2</span></figure>
            <h3>Get Discovered</h3>
            <p>Your item goes live on lelam.co for buyers to find and buy.</p>
          </article>
          <svg className="paper-step-arrow arrow-two" viewBox="0 0 48 20" aria-hidden="true"><path d="M2 10c13-1 24-1 39 0m-8-7 8 7-8 7" /></svg>
          <article className="paper-step">
            <figure className="paper-step-photo"><PaperTape /><ParcelIllustration /><span className="paper-step-number">3</span></figure>
            <h3>Sell &amp; Ship</h3>
            <p>Accept an order, pack it neatly, and hand it over to our pickup partner.</p>
          </article>
          <svg className="paper-step-arrow arrow-three" viewBox="0 0 48 20" aria-hidden="true"><path d="M2 10c13-1 24-1 39 0m-8-7 8 7-8 7" /></svg>
          <article className="paper-step">
            <figure className="paper-step-photo"><PaperTape /><PaymentIllustration /><span className="paper-step-number">4</span></figure>
            <h3>Get Paid</h3>
            <p>Receive your earnings safely and directly to your account.</p>
          </article>
          <svg className="paper-step-sparkle" viewBox="0 0 38 50" aria-hidden="true"><path d="m8 2 4 15 15 4-15 5-4 17-4-17-4-5 4-4Zm21 4 2 7 6 2-6 2-2 7-2-7-6-2 6-2Z" /></svg>
        </div>
      </section>

      <section className="paper-quote-band" aria-label="Our promise">
        <Tear edge="top" />
        <div className="paper-hangtag" aria-hidden="true">
          <span className="paper-tag-string" />
          <span className="paper-tag"><span className="paper-tag-hole" /><Recycle size={34} /></span>
        </div>
        <h2>“Good Clothes<br />Deserve <span>Another Chapter.</span></h2>
        <p>From clearing out what you no longer wear to earning from it — selling on lelam.co is a smarter, more sustainable choice.</p>
        <Tear edge="bottom" />
      </section>

      <section className="paper-why" aria-labelledby="paper-why-title">
        <h2 id="paper-why-title">Why Sell on <em>lelam.co?</em></h2>
        <div className="paper-reasons">
          {reasons.map((reason, index) => <article className="paper-reason" key={index}><span className="paper-reason-icon">{reason.icon}</span><h3>{reason.title}</h3><p>{reason.body}</p></article>)}
        </div>
        <figure className="paper-wardrobe"><PaperTape /><img src="/images/story.jpg" alt="A rail of clothes waiting for their next owner" /></figure>
        <svg className="paper-botanical paper-botanical-why" viewBox="0 0 130 170" aria-hidden="true"><path d="M13 161C45 115 61 73 104 11M40 119c-16-3-24-13-27-29 16 1 27 8 27 29Zm23-42c-17-2-27-12-30-28 17 1 29 9 30 28Zm23-38c-15-4-21-14-21-29 15 3 23 12 21 29Zm-18 64c15-12 29-12 43-5-11 13-26 16-43 5Z" /></svg>
      </section>

      <section className="paper-closing">
        <Tear edge="top" tone="kraft" />
        <svg className="paper-closing-marks" viewBox="0 0 330 50" aria-hidden="true"><path d="M5 7 18 25 3 42M39 2l8 19M291 2l-8 19m31-14-13 18 15 17" /></svg>
        <h2>Ready to sell?</h2>
        <Link href="#/sell" className="paper-primary-cta">Start Selling Now <ArrowRight size={20} /></Link>
      </section>
    </main>
  );
}
