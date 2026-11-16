import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ImagePlus,
  Info,
  LockKeyhole,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Truck,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
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

const categoryDetails: Record<string, { note: string }> = {
  Women: { note: "Clothes, bags & more" },
  Men: { note: "Everyday essentials" },
  Designer: { note: "Labels & special finds" },
  Kids: { note: "Little ones & play" },
  Home: { note: "Pieces for your place" },
  Electronics: { note: "Tech, audio & devices" },
  "Books & Media": { note: "Books, records & films" },
  "Hobbies & collectibles": { note: "Games, art & oddities" },
  Sports: { note: "Active & outdoor gear" },
};

function CategoryArtwork({ category }: { category: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg viewBox="0 0 80 72" aria-hidden="true" {...common}>
      {category === "Women" && (
        <>
          <path d="m28 13 12 5 12-5 10 11-8 7-4-4 8 31H22l8-31-4 4-8-7z" fill="#d7aaa0" />
          <path d="m28 13 12 11 12-11M40 24v34M22 58q18 4 36 0M33 14q7-7 14 0" />
          <path d="M40 34v2m0 7v2" stroke="#9f7759" />
        </>
      )}
      {category === "Men" && (
        <>
          <path d="m28 16 9-5h7l9 5 12 10-7 9-7-6v28H28V29l-7 6-7-9z" fill="#8ca19a" />
          <path d="m37 11 4 8 3-8M40 19v38M30 30h20M30 37h20M30 44h20M32 51h16" />
        </>
      )}
      {category === "Designer" && (
        <>
          <path d="M18 29h44l-4 32H22z" fill="#b38b68" />
          <path d="M27 30q0-18 13-18t13 18M22 37h36M29 44h22M25 55h30" />
          <path d="M36 40h9v11h-9z" fill="#dfc995" />
          <circle cx="40.5" cy="45.5" r="1.5" fill="#625238" stroke="none" />
        </>
      )}
      {category === "Kids" && (
        <>
          <path d="m30 16 10 5 10-5 8 10-6 6-5-4 7 26H26l7-26-5 4-6-6z" fill="#d7aaa0" />
          <path d="m30 16 10 9 10-9M40 25v28M26 54q14 4 28 0M35 16q5-6 10 0" />
          <path d="M33 35h3m8 0h3M33 42h3m8 0h3" stroke="#9f7759" />
          <path d="m26 53 3 5m22-5-3 5" stroke="#c58a70" />
        </>
      )}
      {category === "Home" && (
        <>
          <path d="M20 59h40M25 57V36h30v21M30 36V21q0-10 10-10t10 10v15" fill="#d9c69d" />
          <path d="M26 43h28M31 58V45h18v13M40 11V7" />
          <path d="M33 25h14" />
        </>
      )}
      {category === "Electronics" && (
        <>
          <rect x="25" y="7" width="30" height="58" rx="6" fill="#81948b" />
          <rect x="29" y="14" width="22" height="42" rx="2" fill="#f0e5d1" />
          <path d="M34 21h12m-12 6h8m-8 8h12m-12 6h7" />
          <circle cx="40" cy="60" r="1.5" fill="#d6c18c" />
        </>
      )}
      {category === "Books & Media" && (
        <>
          <path d="M13 17q14-5 27 4v40q-13-9-27-4z" fill="#d6c392" />
          <path d="M67 17q-14-5-27 4v40q13-9 27-4z" fill="#91a198" />
          <path d="M40 21v40" />
          <path d="M19 27q7-2 14 1M19 35q7-2 14 1M19 43q7-2 14 1M19 51q7-2 14 1M47 28q6-3 12-2M47 36q6-3 12-2M47 44q6-3 12-2M47 52q6-3 12-2" stroke="#76684e" strokeWidth="1.2" />
        </>
      )}
      {category === "Hobbies & collectibles" && (
        <>
          <path d="M17 10h46v43H17z" fill="#b58d62" />
          <path d="M21 14h38v35H21z" fill="#252721" stroke="#554632" strokeWidth="1.4" />
          <path d="M28 28q7-10 13 0t13 0" stroke="#6d5942" strokeWidth="2" />
          <path d="M26 40q7-9 14-1t15-3" stroke="#dfaa91" strokeWidth="3" />
          <path d="M26 33q5-5 10 0m11 10 7 4" stroke="#d3c18d" strokeWidth="2.2" />
        </>
      )}
      {category === "Sports" && (
        <>
          <g transform="rotate(-35 22 18)">
            <ellipse cx="22" cy="18" rx="8" ry="11" fill="#e8ddc8" />
            <path d="m16 10 12 16m0-16L16 26m-2-8h16m-15 5h14m-13-11v13m5-15v15" strokeWidth="0.8" />
          </g>
          <path d="M28 28 51 52" stroke="#a47959" strokeWidth="2.6" />
          <path d="m51 52 7 9" stroke="#554637" strokeWidth="3.5" />
          <g transform="rotate(35 58 18)">
            <ellipse cx="58" cy="18" rx="8" ry="11" fill="#e8ddc8" />
            <path d="m52 10 12 16m0-16L52 26m-2-8h16m-15 5h14m-13-11v13m5-15v15" strokeWidth="0.8" />
          </g>
          <path d="M52 28 29 52" stroke="#9c7254" strokeWidth="2.6" />
          <path d="m29 52-7 9" stroke="#554637" strokeWidth="3.5" />
          <path d="m50 54 5 4m-31-4-5 4" stroke="#d5c09a" strokeWidth="1" />
        </>
      )}
    </svg>
  );
}

function SearchableSelect({
  label,
  value,
  options,
  onChange,
  hint,
  placeholder = "Choose an option",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const filteredOptions = useMemo(
    () => options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  );

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const choose = (option: string) => {
    onChange(option);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className={`sell-select-field ${open ? "is-open" : ""}`} ref={rootRef}>
      <span className="field-label">{label}</span>
      <button
        type="button"
        className={`sell-select-trigger ${open ? "is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        <span className={value ? "" : "is-placeholder"}>{value || placeholder}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="sell-select-menu">
          <div className="sell-select-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              aria-label={`Search ${label.toLowerCase()}`}
            />
          </div>
          <div role="listbox" aria-label={label} className="sell-select-options">
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={value === option}
                  key={option}
                  className={`sell-select-option ${value === option ? "is-selected" : ""}`}
                  onClick={() => choose(option)}
                >
                  {option}
                  {value === option && <Check size={15} aria-hidden="true" />}
                </button>
              ))
            ) : (
              <p className="sell-select-empty">No matching options.</p>
            )}
          </div>
        </div>
      )}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

const emptyForm = {
  title: "",
  description: "",
  brand: "",
  customBrand: "",
  condition: "Good" as Condition,
  top: "Women",
  group: "Clothing",
  sub: "All",
  price: "",
  size: "",
  quantity: "1",
  location: "Trivandrum, Kerala",
  shipping: "49",
  allowOffers: true,
  auctionConsent: false,
};

export function SellPage() {
  const { user, db, createListing, updateListing, removeListing } = useStore();
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
      const categoryGroups = groupsFor(top);
      const matchingGroup = categoryGroups.find(
        (group) => group.name === editing.subcategory || group.subs.includes(editing.subcategory ?? ""),
      );
      const group = matchingGroup?.name ?? categoryGroups[0]?.name ?? "All";
      const sub = matchingGroup && matchingGroup.name !== editing.subcategory ? editing.subcategory || "All" : "All";
      setForm({
        ...emptyForm,
        title: editing.title,
        description: editing.description,
        brand: editing.brand && CLOTHING_BRANDS.includes(editing.brand) ? editing.brand : (editing.brand ? "Other" : ""),
        customBrand: editing.brand && !CLOTHING_BRANDS.includes(editing.brand) ? editing.brand : "",
        condition: editing.condition,
        top,
        group,
        sub,
        price: String(editing.askingPrice / 100),
        size: editing.size || "",
        quantity: String(editing.quantity),
        location: editing.location,
        shipping: String(editing.shippingFee / 100),
        allowOffers: editing.allowOffers,
        auctionConsent: editing.auctionConsent,
      });
      setImages(editing.images);
      setShowForm(true);
    } else if (startNow) {
      setShowForm(true);
    }
  }, [editId, editing, startNow]);

  const groups = useMemo(() => groupsFor(form.top).map((g) => g.name), [form.top]);
  const subs = useMemo(() => (form.group === "All" ? ["All", "Other"] : subsFor(form.top, form.group)), [form.top, form.group]);

  const needsApparelSize =
    ["Women", "Men", "Designer", "Kids"].includes(form.top) &&
    /clothing|apparel|designer/i.test(form.group);
  const isShoes = `${form.group} ${form.sub}`.toLowerCase().includes("shoe");
  const isElectronics = form.top === "Electronics";
  const brandOptions = isElectronics ? ELECTRONICS_BRANDS : CLOTHING_BRANDS;
  const sizeOptions = isShoes ? SHOE_SIZES : APPAREL_SIZES;

  const update = (key: keyof typeof form, value: string | boolean) => {
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      if (key === "top") {
        next.group = groupsFor(String(value))[0]?.name ?? "All";
        next.sub = "All";
        next.brand = "";
        next.size = "";
      }
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
      .then((results) => { setImages((previous) => [...previous, ...results].slice(0, 6)); toast("Photos added. They stay in this browser.", "success"); })
      .catch(() => toast("Could not read that photo.", "error"))
      .finally(() => setFileBusy(false));
  };

  const submit = () => {
    const brand = form.brand === "Other" ? form.customBrand.trim() : form.brand.trim();
    const category = form.top;
    const subcategory = form.group === "All" ? (form.sub !== "All" && form.sub !== "Other" ? form.sub : undefined) : (form.sub !== "All" ? form.sub : form.group);
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
    };
    if (editing) {
      const result = updateListing(editing.id, input);
      if (result.ok) { toast("Listing updated.", "success"); navigate(`#/product/${editing.id}`); } else toast(result.error, "error");
      return;
    }
    const result = createListing(input);
    if (result.ok) { toast("Listing created.", "success"); navigate(`#/product/${result.productId}`); } else toast(result.error, "error");
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
          <div className="sell-category-picker">
            <span className="field-label" id="sell-category-label">Choose a category <span aria-hidden="true">*</span></span>
            <div className="sell-category-grid" role="group" aria-labelledby="sell-category-label">
              {VINTED_CATALOG.map((category) => (
                <motion.button
                  type="button"
                  key={category.top}
                  className={`sell-category-tile ${form.top === category.top ? "is-selected" : ""}`}
                  aria-pressed={form.top === category.top}
                  onClick={() => update("top", category.top)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 420, damping: 26, mass: 0.7 }}
                >
                  {form.top === category.top && (
                    <motion.span
                      className="sell-category-highlight"
                      layoutId="sell-category-highlight"
                      transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.75 }}
                    />
                  )}
                  <span className="sell-category-art"><CategoryArtwork category={category.top} /></span>
                  <span className="sell-category-copy">
                    <strong>{category.top}</strong>
                    <small>{categoryDetails[category.top]?.note}</small>
                  </span>
                  <span className="sell-category-check" aria-hidden="true"><Check size={13} /></span>
                </motion.button>
              ))}
            </div>
            <p className="sell-category-hint">Choose one. We’ll show the matching item types next.</p>
          </div>

          <div className="field-row two">
            <SearchableSelect
              label="Type *"
              value={form.group}
              options={groups}
              onChange={(value) => update("group", value)}
              placeholder="Choose a type"
            />
            <SearchableSelect
              label="Subcategory"
              value={form.sub}
              options={subs}
              onChange={(value) => update("sub", value)}
              placeholder="Choose a subcategory"
            />
          </div>

          <Field label="Listing title *"><input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Levi's 501 jeans" maxLength={80} /></Field>

          {(needsApparelSize || isElectronics || form.top === "Sports") && (
            <div className="field-row two">
              <SearchableSelect
                label="Brand"
                value={form.brand || ""}
                options={["No brand / unbranded", ...brandOptions]}
                onChange={(value) => update("brand", value === "No brand / unbranded" ? "" : value)}
                placeholder="Search or choose a brand"
                hint={form.brand === "Other" ? "Type your own below" : "Optional"}
              />
              {form.brand === "Other" && <Field label="Your brand"><input value={form.customBrand} onChange={(e) => update("customBrand", e.target.value)} placeholder="Type your brand" /></Field>}
            </div>
          )}
          {needsApparelSize || isShoes ? (
            <SearchableSelect
              label={needsApparelSize ? "Size *" : "Shoe size *"}
              value={form.size}
              options={sizeOptions}
              onChange={(value) => update("size", value)}
              placeholder="Search sizes"
            />
          ) : null}
          {form.top === "Home" && <Field label="Size / dimensions" hint="Optional"><input value={form.size} onChange={(e) => update("size", e.target.value)} placeholder="e.g. 40 × 40 cm" /></Field>}
          {form.top === "Books & Media" && <Field label="Format / size" hint="Optional"><input value={form.size} onChange={(e) => update("size", e.target.value)} placeholder="e.g. Paperback" /></Field>}

          <SearchableSelect
            label="Condition *"
            value={form.condition}
            options={conditions}
            onChange={(value) => update("condition", value as Condition)}
          />
          <Field label="Description *" hint="Mention fit, flaws, measurements, anything a buyer should know."><textarea rows={5} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Describe it honestly…" /></Field>
          <div className="field-row two">
            <Field label="Quantity"><input type="number" min={1} value={form.quantity} onChange={(e) => update("quantity", e.target.value)} inputMode="numeric" /></Field>
            <Field label="Location"><input value={form.location} onChange={(e) => update("location", e.target.value)} /></Field>
          </div>
          <p className="sell-inline-note"><Truck size={14} /> Shipping & delivery handled by us after you list. You don&apos;t arrange the courier.</p>
        </section>

        <section className="sell-block">
          <div className="sell-block-head"><span className="step-number">02</span><div><h2>Photos</h2><p>Add up to six. The first photo is the cover.</p></div></div>
          {images.length > 0 && <div className="sell-photo-grid">{images.map((image, index) => (<div key={`${image}-${index}`} className="sell-photo"><img src={image} alt={`Listing photo ${index + 1}`} />{index === 0 && <span>COVER</span>}<button type="button" aria-label="Remove photo" onClick={() => setImages((p) => p.filter((item) => item !== image))}><X size={13} /></button></div>))}</div>}
          <label className="sell-upload"><input type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} /><Upload size={18} /><span><strong>{fileBusy ? "Reading photos…" : "Upload photos"}</strong><em>From this device. Demo only, they stay in the browser.</em></span></label>
          <div className="sell-url-row"><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Or paste an image URL" aria-label="Image URL" /><button type="button" className="button button-ghost" onClick={() => { if (!imageUrl.trim()) return; addImage(imageUrl.trim()); setImageUrl(""); }}><Plus size={14} /> Add</button></div>
          <div className="sell-presets"><span>Or use a demo photo</span><div>{presetImages.map((image) => (<button key={image} type="button" className={images.includes(image) ? "is-selected" : ""} onClick={() => addImage(image)}><img src={image} alt="" />{images.includes(image) && <Check size={12} />}</button>))}</div></div>
        </section>

        <section className="sell-block">
          <div className="sell-block-head"><span className="step-number">03</span><div><h2>Price & options</h2><p>Set the asking price. Buyers can buy instantly or send a private offer.</p></div></div>
          <div className="field-row two">
            <Field label="Asking price (₹) *" hint="Buyers pay this for Buy now, or bid in auctions."><input type="number" min={1} inputMode="numeric" value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="1450" /></Field>
            <Field label="You receive" hint="The full asking price comes to you. Shipping is collected separately at checkout."><div className="sell-payout">{formatMoney(Math.round((Number(form.price) || 0) * 100))}</div></Field>
          </div>
          <div className="field-row two">
            <Field label="Shipping fee (₹)" hint="We handle delivery; you can cover it or leave it free."><input type="number" min={0} inputMode="numeric" value={form.shipping} onChange={(e) => update("shipping", e.target.value)} /></Field>
          </div>
          <div className="sell-options">
            <label><input type="checkbox" checked={form.allowOffers} onChange={(e) => update("allowOffers", e.target.checked)} /><span><strong>Allow private offers</strong><em>Buyers can send a price privately. You choose whether to accept — an offer you ignore expires on its own.</em></span></label>
            <label><input type="checkbox" checked={form.auctionConsent} onChange={(e) => update("auctionConsent", e.target.checked)} /><span><strong>Opt in to random live auctions</strong><em>Your listing may be picked for a short live auction that starts at {db.settings.auctionStartPct}% of your asking price, so buyers have room to win. If bids go higher, you keep the winning bid.</em></span></label>
          </div>
        </section>
      </div>

      <aside className="sell-aside">
        <div className="summary-card">
          <h2>Listing preview</h2>
          <div className="sell-preview"><div className="sell-preview-image">{images[0] ? <img src={images[0]} alt="" /> : <div><ImagePlus size={22} /><span>No photo yet</span></div>}</div><div className="sell-preview-copy"><span>{form.condition} · {form.top}{form.sub !== "All" ? ` · ${form.sub}` : ""}</span><strong>{form.title || "Untitled listing"}</strong><em>{form.price ? formatMoney(Math.round(Number(form.price) * 100)) : "₹—"}</em></div></div>
          <p className="sell-aside-note">{db.settings.sellerAutoApprove ? "Listings go live immediately in this demo. Admins can still review reports." : "New listings wait for an admin review before going live."}</p>
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
        <div className="sell-tips"><h3><Info size={14} /> Good to know</h3><ul><li>Every piece is one seller&apos;s own item.</li><li>We handle shipping & delivery for you.</li><li>Auctions are optional and only run if you opt in.</li><li>Offers are private. No public bidding on normal listings.</li></ul><div className="sell-trust"><ShieldCheck size={15} /> You keep any bid above your asking price</div></div>
      </aside>
    </div>
  ) : null;

  const emptyState = !editing && !showForm && !user ? (
    <div className="sell-empty-cta">
      <Store size={30} />
      <h2>Create a free account to sell</h2>
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
        <PageHeader eyebrow={editing ? "EDIT LISTING" : "SELL ON LELAM"} title={editing ? <>Tidy up the <em>details.</em></> : <>Put it back <em>in circulation.</em></>} description={editing ? "Update the details below." : "Sell any item — clothes, electronics, furniture, collectibles, toys and more. We handle shipping and delivery."} action={editing ? (<button type="button" className="text-link remove-link" onClick={() => { if (!window.confirm("Remove this listing from the rail?")) return; const result = removeListing(editing.id); if (result.ok) { toast("Listing removed."); navigate("#/seller?tab=listings"); } else toast(result.error, "error"); }}>Remove listing</button>) : undefined} />
        {promo}
        {formSection}
        {emptyState}
      </div>
    </main>
  );
}
