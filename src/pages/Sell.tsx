import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ImagePlus,
  Info,
  LockKeyhole,
  PackageCheck,
  Plus,
  ShieldCheck,
  Store,
  Truck,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { Link, navigate } from "../components/Link";
import { Field, PageHeader } from "../components/Ui";
import { APPAREL_SIZES, CLOTHING_BRANDS, ELECTRONICS_BRANDS, SHOE_SIZES, VINTED_CATALOG, groupsFor, subsFor } from "../lib/categories";
import { promptAuth, withNext } from "../lib/authGate";
import { formatMoney } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import type { Condition } from "../lib/types";

const conditions: Condition[] = ["New", "Like new", "Good", "Fair"];

const presetImages = [
  "/images/denim.jpg", "/images/knit.jpg", "/images/leather.jpg", "/images/jeans.jpg",
  "/images/bag.jpg", "/images/tee.jpg", "/images/editorial.jpg", "/images/detail.jpg",
];

const emptyForm = {
  title: "",
  description: "",
  brand: "",
  customBrand: "",
  condition: "Good" as Condition,
  top: "Women",
  group: "All",
  sub: "All",
  price: "",
  size: "",
  quantity: "1",
  location: "Trivandrum, Kerala",
  shipping: "49",
  allowOffers: true,
  auctionConsent: false,
  hasFlaws: false,
  flawsText: "",
  vintageWearNote: "",
  chest: "",
  length: "",
  shoulder: "",
  sleeve: "",
  waist: "",
  inseam: "",
  rise: "",
  insoleLength: "",
  weightGrams: "500",
  lengthCm: "25",
  widthCm: "20",
  heightCm: "5",
};

export function SellPage() {
  const { user, db, createListing, updateListing, removeListing, becomeSeller } = useStore();
  const route = useRoute();
  const editId = route.query.get("edit") || "";
  const editing = editId ? db.products.find((product) => product.id === editId) : undefined;
  const startNow = route.query.get("start") === "1";

  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const [showForm, setShowForm] = useState(Boolean(editing) || startNow);

  useEffect(() => {
    if (editing) {
      const top = VINTED_CATALOG.some((c) => c.top === editing.category) ? editing.category : "Women";
      setForm({
        ...emptyForm,
        title: editing.title,
        description: editing.description,
        brand: editing.brand && CLOTHING_BRANDS.includes(editing.brand) ? editing.brand : (editing.brand ? "Other" : ""),
        customBrand: editing.brand && !CLOTHING_BRANDS.includes(editing.brand) ? editing.brand : "",
        condition: editing.condition,
        top,
        group: "All",
        sub: editing.subcategory || "All",
        price: String(editing.askingPrice / 100),
        size: editing.size || "",
        quantity: String(editing.quantity),
        location: editing.location,
        shipping: String(editing.shippingFee / 100),
        allowOffers: editing.allowOffers,
        auctionConsent: editing.auctionConsent,
        hasFlaws: Boolean(editing.hasFlaws),
        flawsText: Array.isArray(editing.flaws) ? editing.flaws.filter((f) => !f.startsWith("Wear: ")).join(", ") : "",
        vintageWearNote: editing.flaws?.find((f) => f.startsWith("Wear: "))?.replace("Wear: ", "") || "",
        chest: editing.measurements?.chest ? String(editing.measurements.chest) : "",
        length: editing.measurements?.length ? String(editing.measurements.length) : "",
        shoulder: editing.measurements?.shoulder ? String(editing.measurements.shoulder) : "",
        sleeve: editing.measurements?.sleeve ? String(editing.measurements.sleeve) : "",
        waist: editing.measurements?.waist ? String(editing.measurements.waist) : "",
        inseam: editing.measurements?.inseam ? String(editing.measurements.inseam) : "",
        rise: editing.measurements?.rise ? String(editing.measurements.rise) : "",
        insoleLength: editing.measurements?.insole ? String(editing.measurements.insole) : "",
        weightGrams: editing.weightGrams ? String(editing.weightGrams) : "500",
        lengthCm: "25",
        widthCm: "20",
        heightCm: "5",
      });
      setImages(editing.images);
      setShowForm(true);
    } else if (startNow) {
      setShowForm(true);
    }
  }, [editId, editing, startNow]);

  const groups = useMemo(() => groupsFor(form.top).map((g) => g.name), [form.top]);
  const subs = useMemo(() => (form.group === "All" ? ["All", "Other"] : subsFor(form.top, form.group)), [form.top, form.group]);

  const needsApparelSize = ["Women", "Men", "Designer", "Kids"].includes(form.top);
  const isShoes = form.group.toLowerCase().includes("shoe");
  const isBottom = ["pants", "jeans", "shorts", "skirts", "trousers", "denim", "bottoms"].some(
    (k) => form.group.toLowerCase().includes(k) || form.sub.toLowerCase().includes(k),
  );
  const isTop = (needsApparelSize || form.top === "Women" || form.top === "Men") && !isShoes && !isBottom;
  const isElectronics = form.top === "Electronics";
  const brandOptions = isElectronics ? ELECTRONICS_BRANDS : CLOTHING_BRANDS;
  const sizeOptions = isShoes ? SHOE_SIZES : APPAREL_SIZES;

  const update = (key: keyof typeof form, value: string | boolean) => {
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      if (key === "top") { next.group = "All"; next.sub = "All"; }
      if (key === "group") { next.sub = "All"; }
      return next;
    });
  };

  const startSelling = () => {
    if (!user) {
      promptAuth("#/sell?start=1", "Create an account to start selling. It takes a moment, and your listing goes live after.");
      return;
    }
    setShowForm(true);
    navigate("#/sell?start=1");
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  if (user && !user.isSeller && user.role !== "admin") {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <Store size={38} />
          <h2>Open your seller account.</h2>
          <p>
            Listings are tied to a seller profile so buyers know who they are buying from. It
            takes one click to open yours.
          </p>
          <div className="modal-actions center">
            <button
              type="button"
              className="button button-olive"
              onClick={async () => {
                const result = await becomeSeller(user.name);
                if (result.ok) toast("Seller account ready. Add your first listing.", "success");
                else toast(result.error, "error");
              }}
            >
              Start selling
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (editing && user && editing.sellerId !== user.id) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <LockKeyhole size={38} />
          <h2>That listing is not yours.</h2>
          <Link href="#/seller" className="button button-olive">My listings</Link>
        </div>
      </main>
    );
  }

  const addImage = (image: string) => setImages((previous) => (previous.includes(image) ? previous : [...previous, image]));
  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setFileBusy(true);
    const readers = Array.from(files).slice(0, 4).map(
      (file) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      }),
    );
    Promise.all(readers)
      .then((results) => {
        setImages((previous) => [...previous, ...results].slice(0, 6));
        toast("Photos added. They upload when you publish.", "success");
      })
      .catch(() => toast("Could not read that photo.", "error"))
      .finally(() => setFileBusy(false));
  };

  const submit = async () => {
    const brand = form.brand === "Other" ? form.customBrand.trim() : form.brand.trim();
    const category = form.top;
    const subcategory = form.group === "All" ? (form.sub !== "All" && form.sub !== "Other" ? form.sub : undefined) : (form.sub !== "All" ? form.sub : form.group);
    const measurements: Record<string, number> = {};
    if (form.chest && !Number.isNaN(Number(form.chest))) measurements.chest = Number(form.chest);
    if (form.length && !Number.isNaN(Number(form.length))) measurements.length = Number(form.length);
    if (form.shoulder && !Number.isNaN(Number(form.shoulder))) measurements.shoulder = Number(form.shoulder);
    if (form.sleeve && !Number.isNaN(Number(form.sleeve))) measurements.sleeve = Number(form.sleeve);
    if (form.waist && !Number.isNaN(Number(form.waist))) measurements.waist = Number(form.waist);
    if (form.inseam && !Number.isNaN(Number(form.inseam))) measurements.inseam = Number(form.inseam);
    if (form.rise && !Number.isNaN(Number(form.rise))) measurements.rise = Number(form.rise);
    if (form.insoleLength && !Number.isNaN(Number(form.insoleLength))) measurements.insole = Number(form.insoleLength);

    const flawsList: string[] = [];
    if (form.flawsText.trim()) {
      flawsList.push(...form.flawsText.split(",").map((s) => s.trim()).filter(Boolean));
    }
    if (form.vintageWearNote.trim()) {
      flawsList.push(`Wear: ${form.vintageWearNote.trim()}`);
    }

    const input = {
      title: form.title,
      description: form.description,
      brand,
      condition: form.condition,
      category,
      subcategory,
      askingPrice: Math.round(Number(form.price) * 100),
      images,
      size: form.size,
      quantity: Math.max(1, Number(form.quantity) || 1),
      location: form.location,
      shippingFee: Math.round(Number(form.shipping) * 100),
      allowOffers: form.allowOffers,
      auctionConsent: form.auctionConsent,
      measurements: Object.keys(measurements).length ? measurements : undefined,
      flaws: flawsList.length ? flawsList : undefined,
      hasFlaws: form.hasFlaws,
      weightGrams: form.weightGrams ? Number(form.weightGrams) : 500,
      lengthCm: form.lengthCm ? Number(form.lengthCm) : 25,
      widthCm: form.widthCm ? Number(form.widthCm) : 20,
      heightCm: form.heightCm ? Number(form.heightCm) : 5,
    };
    if (editing) {
      const result = await updateListing(editing.id, input);
      if (result.ok) {
        toast("Listing updated.", "success");
        navigate(`#/product/${editing.id}`);
      } else {
        toast(result.error, "error");
      }
      return;
    }

    const result = await createListing(input);
    if (result.ok) {
      toast("Listing created.", "success");
      navigate(`#/product/${result.productId}`);
    } else {
      toast(result.error, "error");
    }
  };

  // Promo / landing section first (not the form). CTA right at top.
  const promo = !editing && !showForm ? (
    <section className="sell-hero">
      <div className="sell-hero-copy">
        <div className="eyebrow">SELL ANYTHING · WE HANDLE SHIPPING</div>
        <h1>Sell anything you want. We handle shipping & delivery.</h1>
        <p>Clothes, shoes, electronics, furniture, collectibles, toys, books, sports gear — list what you have. We pack, ship, deliver and help you get paid. No courier runs for you.</p>
        <div className="sell-hero-actions">
          <button type="button" className="button button-olive" onClick={startSelling}>
            Start selling now <ArrowRight size={16} />
          </button>
          {!user && (
            <Link href={withNext("#/register", "#/sell?start=1")} className="button button-ghost">Create account — it&apos;s free</Link>
          )}
          {user && <Link href="#/seller" className="button button-ghost">Seller dashboard <ArrowUpRight size={15} /></Link>}
        </div>
        {!user && <p className="sell-auth-note">Need an account to list. Buyers can browse and add to cart without signing up — you&apos;ll be prompted to sign in at checkout. Selling needs an account so you can get paid.</p>}
        {user && <p className="sell-auth-note">You&apos;re signed in as {user.name}. Listing takes about a minute.</p>}
      </div>
      <div className="sell-how">
        <h2>How it works</h2>
        <ol>
          <li><span><PackageCheck size={20} /></span><div><strong>1. List it</strong><p>Pick a category, add photos and your price. Takes about a minute.</p></div></li>
          <li><span><Truck size={20} /></span><div><strong>2. We ship for you</strong><p>We handle pickup, packing, courier and delivery. You don&apos;t ship anything yourself.</p></div></li>
          <li><span><Wallet size={20} /></span><div><strong>3. Get paid</strong><p>When it&apos;s delivered, your payout is ready in your seller dashboard.</p></div></li>
        </ol>
        <p className="sell-how-note">You set the price. Buyers can buy instantly or send a private offer. Optional live auctions only if you opt in.</p>
      </div>
    </section>
  ) : null;

  const formSection = (editing || showForm) ? (
    <div ref={formRef} className="sell-layout" id="sell-form">
      <div className="sell-main">
        <section className="sell-block">
          <div className="sell-block-head"><span className="step-number">01</span><div><h2>What are you selling?</h2><p>Pick the category — the form adapts to it.</p></div></div>
          <div className="field-row three">
            <Field label="Category *"><select value={form.top} onChange={(e) => update("top", e.target.value)}>{VINTED_CATALOG.map((c) => <option key={c.top} value={c.top}>{c.top}</option>)}</select></Field>
            <Field label="Type *"><select value={form.group} onChange={(e) => update("group", e.target.value)}><option value="All">All</option>{groups.map((g) => <option key={g} value={g}>{g}</option>)}</select></Field>
            {form.group !== "All" && <Field label="Subcategory"><select value={form.sub} onChange={(e) => update("sub", e.target.value)}>{subs.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>}
          </div>

          <Field label="Title *"><input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Levi's 501 jeans" maxLength={80} /></Field>

          {(needsApparelSize || isElectronics || form.top === "Sports") && (
            <div className="field-row two">
              <Field label="Brand" hint={form.brand === "Other" ? "Type your own below" : "Optional"}>{brandOptions.length ? (
                <select value={form.brand} onChange={(e) => update("brand", e.target.value)}>
                  <option value="">No brand / unbranded</option>
                  {brandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              ) : <input value={form.brand} onChange={(e) => update("brand", e.target.value)} placeholder="Brand" />}</Field>
              {form.brand === "Other" && <Field label="Your brand"><input value={form.customBrand} onChange={(e) => update("customBrand", e.target.value)} placeholder="Type your brand" /></Field>}
            </div>
          )}
          {needsApparelSize && <Field label="Size *"><select value={form.size} onChange={(e) => update("size", e.target.value)}><option value="">Select size</option>{sizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>}
          {form.top === "Home" && <Field label="Size / dimensions" hint="Optional"><input value={form.size} onChange={(e) => update("size", e.target.value)} placeholder="e.g. 40 × 40 cm" /></Field>}
          {form.top === "Books & Media" && <Field label="Format / size" hint="Optional"><input value={form.size} onChange={(e) => update("size", e.target.value)} placeholder="e.g. Paperback" /></Field>}

          <Field label="Condition *"><select value={form.condition} onChange={(e) => update("condition", e.target.value)}>{conditions.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>

          {/* Thrift condition & flaw disclosure */}
          <div className="sell-option-card">
            <label className="sell-checkbox-row">
              <input type="checkbox" checked={form.hasFlaws} onChange={(e) => update("hasFlaws", e.target.checked)} />
              <span>
                <strong>Disclose flaws or vintage wear</strong>
                <em>Honest disclosure eliminates disputes and protects your seller payout.</em>
              </span>
            </label>
            {form.hasFlaws && (
              <div className="field-row two" style={{ marginTop: "12px" }}>
                <Field label="Flaw details" hint="e.g. Small pinhole on hem, faint cuff stain">
                  <input value={form.flawsText} onChange={(e) => update("flawsText", e.target.value)} placeholder="Describe flaws clearly…" />
                </Field>
                <Field label="Vintage wear note" hint="e.g. Natural wash patina from 1996">
                  <input value={form.vintageWearNote} onChange={(e) => update("vintageWearNote", e.target.value)} placeholder="e.g. Authentic vintage fade" />
                </Field>
              </div>
            )}
          </div>

          {/* Category-aware garment measurements */}
          {isTop && (
            <div className="sell-option-card">
              <div className="sell-card-head">
                <strong>Garment measurements (cm / inches)</strong>
                <span>Measured flat. Crucial for vintage sizing.</span>
              </div>
              <div className="field-row four">
                <Field label="Pit-to-pit / Chest"><input value={form.chest} onChange={(e) => update("chest", e.target.value)} placeholder="e.g. 54" /></Field>
                <Field label="Back length"><input value={form.length} onChange={(e) => update("length", e.target.value)} placeholder="e.g. 70" /></Field>
                <Field label="Shoulder width"><input value={form.shoulder} onChange={(e) => update("shoulder", e.target.value)} placeholder="e.g. 48" /></Field>
                <Field label="Sleeve length"><input value={form.sleeve} onChange={(e) => update("sleeve", e.target.value)} placeholder="e.g. 62" /></Field>
              </div>
            </div>
          )}

          {isBottom && (
            <div className="sell-option-card">
              <div className="sell-card-head">
                <strong>Garment measurements (inches / cm)</strong>
                <span>Measured flat across waistband and inseam.</span>
              </div>
              <div className="field-row three">
                <Field label="Waist (in/cm)"><input value={form.waist} onChange={(e) => update("waist", e.target.value)} placeholder="e.g. 32" /></Field>
                <Field label="Inseam length"><input value={form.inseam} onChange={(e) => update("inseam", e.target.value)} placeholder="e.g. 30" /></Field>
                <Field label="Front rise"><input value={form.rise} onChange={(e) => update("rise", e.target.value)} placeholder="e.g. 11" /></Field>
              </div>
            </div>
          )}

          {isShoes && (
            <div className="sell-option-card">
              <Field label="Insole length (cm)" hint="Length of footbed from heel to toe.">
                <input value={form.insoleLength} onChange={(e) => update("insoleLength", e.target.value)} placeholder="e.g. 27.5" />
              </Field>
            </div>
          )}

          <Field label="Description *" hint="Mention fit, flaws, measurements, anything a buyer should know."><textarea rows={5} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Describe it honestly…" /></Field>

          {/* Package details for courier rate and pickup */}
          <div className="sell-option-card">
            <div className="sell-card-head">
              <strong>Package weight & size (for courier pickup)</strong>
              <span>Used by the courier partner for vehicle assignment and rate verification.</span>
            </div>
            <div className="field-row four">
              <Field label="Est. weight (g)"><input type="number" min={50} value={form.weightGrams} onChange={(e) => update("weightGrams", e.target.value)} placeholder="500" /></Field>
              <Field label="Length (cm)"><input type="number" min={1} value={form.lengthCm} onChange={(e) => update("lengthCm", e.target.value)} placeholder="25" /></Field>
              <Field label="Width (cm)"><input type="number" min={1} value={form.widthCm} onChange={(e) => update("widthCm", e.target.value)} placeholder="20" /></Field>
              <Field label="Height (cm)"><input type="number" min={1} value={form.heightCm} onChange={(e) => update("heightCm", e.target.value)} placeholder="5" /></Field>
            </div>
          </div>

          <div className="field-row three">
            <Field label="Quantity"><input type="number" min={1} value={form.quantity} onChange={(e) => update("quantity", e.target.value)} inputMode="numeric" /></Field>
            <Field label="Location"><input value={form.location} onChange={(e) => update("location", e.target.value)} /></Field>
            <Field label="Asking price (₹) *"><input type="number" min={1} inputMode="numeric" value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="1450" /></Field>
          </div>
          <p className="sell-inline-note"><Truck size={14} /> Shipping & delivery handled by us after you list. You don&apos;t arrange the courier.</p>
        </section>

        <section className="sell-block">
          <div className="sell-block-head"><span className="step-number">02</span><div><h2>Photos</h2><p>Add up to six. The first photo is the cover.</p></div></div>
          {images.length > 0 && <div className="sell-photo-grid">{images.map((image, index) => (<div key={`${image}-${index}`} className="sell-photo"><img src={image} alt={`Listing photo ${index + 1}`} />{index === 0 && <span>COVER</span>}<button type="button" aria-label="Remove photo" onClick={() => setImages((p) => p.filter((item) => item !== image))}><X size={13} /></button></div>))}</div>}
          <label className="sell-upload"><input type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} /><Upload size={18} /><span><strong>{fileBusy ? "Reading photos…" : "Upload photos"}</strong><em>Photos upload securely to the marketplace.</em></span></label>
          <div className="sell-url-row"><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Or paste an image URL" aria-label="Image URL" /><button type="button" className="button button-ghost" onClick={() => { if (!imageUrl.trim()) return; addImage(imageUrl.trim()); setImageUrl(""); }}><Plus size={14} /> Add</button></div>
          <div className="sell-presets"><span>Or choose a sample photo</span><div>{presetImages.map((image) => (<button key={image} type="button" className={images.includes(image) ? "is-selected" : ""} onClick={() => addImage(image)}><img src={image} alt="" />{images.includes(image) && <Check size={12} />}</button>))}</div></div>
        </section>

        <section className="sell-block">
          <div className="sell-block-head"><span className="step-number">03</span><div><h2>Price & options</h2><p>Set the asking price. Buyers can buy instantly or send a private offer.</p></div></div>
          <div className="field-row two">
            <Field label="Shipping fee (₹)" hint="We handle delivery; you can cover it or leave it free."><input type="number" min={0} inputMode="numeric" value={form.shipping} onChange={(e) => update("shipping", e.target.value)} /></Field>
            <Field label="You receive" hint="The full asking price comes to you. Shipping is collected separately at checkout."><div className="sell-payout">{formatMoney(Math.round((Number(form.price) || 0) * 100))}</div></Field>
          </div>
          <div className="sell-options">
            <label><input type="checkbox" checked={form.allowOffers} onChange={(e) => update("allowOffers", e.target.checked)} /><span><strong>Allow private offers</strong><em>Buyers can send a price privately. You choose whether to accept — an offer you ignore expires on its own.</em></span></label>
            <label><input type="checkbox" checked={form.auctionConsent} onChange={(e) => update("auctionConsent", e.target.checked)} /><span><strong>Opt in to random live auctions</strong><em>Your listing may be picked for a short live auction that starts at {db.settings.auctionStartPct}% of your asking price, so buyers have room to win. You are always paid at least your asking price — the platform tops up any shortfall. If bids go higher, you keep the winning bid.</em></span></label>
          </div>
        </section>
      </div>

      <aside className="sell-aside">
        <div className="summary-card">
          <h2>Listing preview</h2>
          <div className="sell-preview"><div className="sell-preview-image">{images[0] ? <img src={images[0]} alt="" /> : <div><ImagePlus size={22} /><span>No photo yet</span></div>}</div><div className="sell-preview-copy"><span>{form.condition} · {form.top}{form.sub !== "All" ? ` · ${form.sub}` : ""}{form.hasFlaws ? " · Disclosed flaws" : ""}</span><strong>{form.title || "Untitled listing"}</strong><em>{form.price ? formatMoney(Math.round(Number(form.price) * 100)) : "₹—"}</em></div></div>
          <p className="sell-aside-note">{db.settings.sellerAutoApprove ? "Your listing is published to the live marketplace. Admins can still review reports." : "New listings wait for an admin review before going live."}</p>
          <div className="publish-steps">
            <span className="publish-steps-title">After you publish</span>
            <ol>
              <li><strong>{db.settings.sellerAutoApprove ? "Your listing goes live" : "We review your listing"}</strong><span>{db.settings.sellerAutoApprove ? "Buyers see it on the shop right away." : "You'll be told the moment it is live."}</span></li>
              <li><strong>A buyer buys or offers</strong><span>Buy now at your price, or send a private offer you accept or decline.</span></li>
              <li><strong>We pick up and deliver</strong><span>You update the delivery status; nothing to ship yourself.</span></li>
              <li><strong>You get paid</strong><span>Your payout appears in the seller dashboard.</span></li>
            </ol>
          </div>
          <button type="button" className="button button-olive summary-cta" onClick={submit}>{editing ? "Save changes" : "Publish listing"} <ArrowUpRight size={15} /></button>
          <Link href="#/seller" className="button button-ghost summary-cta">Seller dashboard</Link>
        </div>
        <div className="sell-tips"><h3><Info size={14} /> Good to know</h3><ul><li>Every piece is one seller&apos;s own item.</li><li>We handle shipping & delivery for you.</li><li>Auctions are optional and only run if you opt in.</li><li>Offers are private. No public bidding on normal listings.</li></ul><div className="sell-trust"><ShieldCheck size={15} /> Asking price protected in auctions</div></div>
      </aside>
    </div>
  ) : null;

  const emptyState = !editing && !showForm && !user ? (
    <div className="sell-empty-cta">
      <Store size={30} />
      <h2>Sign in to sell</h2>
      <p>Shopping works without an account — you can browse and add to cart. Selling, payouts and delivery tracking need an account.</p>
      <div className="sell-hero-actions">
        <Link href="#/register" className="button button-olive">Create account</Link>
        <Link href="#/login" className="button button-ghost">Sign in</Link>
      </div>
    </div>
  ) : null;

  return (
    <main className="page-shell sell-page">
      <div className="section-wrap">
        <PageHeader
          eyebrow={editing ? "EDIT LISTING" : "SELL ON LELAM"}
          title={
            editing ? (
              <>
                Tidy up the <em>details.</em>
              </>
            ) : (
              <>
                Put it back <em>in circulation.</em>
              </>
            )
          }
          description={
            editing
              ? "Update the details below."
              : "Sell any item — clothes, electronics, furniture, collectibles, toys and more. We handle shipping and delivery."
          }
          action={
            editing ? (
              <button
                type="button"
                className="text-link remove-link"
                onClick={async () => {
                  if (!window.confirm("Remove this listing from the rail?")) return;
                  const result = await removeListing(editing.id);
                  if (result.ok) {
                    toast("Listing removed.");
                    navigate("#/seller?tab=listings");
                  } else {
                    toast(result.error, "error");
                  }
                }}
              >
                Remove listing
              </button>
            ) : undefined
          }
        />
        {promo}
        {formSection}
        {emptyState}
      </div>
    </main>
  );
}
