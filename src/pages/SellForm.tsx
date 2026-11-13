import { useEffect, useState } from "react";
import { ArrowUpRight, Check, ImagePlus, Info, LockKeyhole, Plus, ShieldCheck, Upload, X } from "lucide-react";
import { Link, navigate } from "../components/Link";
import { Field, PageHeader } from "../components/Ui";
import { CATEGORIES } from "../lib/categories";
import { formatMoney } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { PLATFORM_CHARGE_PAISE } from "../lib/sellerMath";
import { toast } from "../lib/toast";
import type { Category, Condition } from "../lib/types";

const conditions: Condition[] = ["New", "Like new", "Good", "Fair"];

const presetImages = [
  "/images/denim.jpg",
  "/images/knit.jpg",
  "/images/leather.jpg",
  "/images/jeans.jpg",
  "/images/bag.jpg",
  "/images/tee.jpg",
  "/images/editorial.jpg",
  "/images/detail.jpg",
];

const emptyForm = {
  title: "",
  description: "",
  brand: "",
  condition: "Good" as Condition,
  category: "Clothing" as Category,
  price: "",
  size: "",
  quantity: "1",
  location: "Trivandrum, Kerala",
  shipping: "49",
  allowOffers: true,
  auctionConsent: false,
};

/**
 * The listing form (#/sell/new) — CTA target of the sell landing. Signed-out
 * visitors get the sign-in card; owners edit via `?edit=<productId>`.
 * A price picked in the landing's payout preview pre-fills the asking price.
 */
export function SellFormPage() {
  const { user, db, createListing, updateListing, removeListing } = useStore();
  const route = useRoute();
  const editId = route.query.get("edit") || "";
  const editing = editId ? db.products.find((product) => product.id === editId) : undefined;

  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [fileBusy, setFileBusy] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title,
        description: editing.description,
        brand: editing.brand || "",
        condition: editing.condition,
        category: editing.category,
        price: String(editing.askingPrice / 100),
        size: editing.size || "",
        quantity: String(editing.quantity),
        location: editing.location,
        shipping: String(editing.shippingFee / 100),
        allowOffers: editing.allowOffers,
        auctionConsent: editing.auctionConsent,
      });
      setImages(editing.images);
    } else {
      setForm(emptyForm);
      setImages([]);
      const prefill = sessionStorage.getItem("lelam-sell-price");
      if (prefill) {
        setForm((previous) => ({ ...previous, price: prefill }));
        sessionStorage.removeItem("lelam-sell-price");
      }
    }
  }, [editId, editing]);

  if (!user) {
    return (
      <main className="page-shell sell-page">
        <div className="section-wrap">
          <div className="sell-gated-card">
            <h2>
              Two steps from <em>here</em> to listed.
            </h2>
            <p>
              Sign in, and the form is already waiting — that's the entire setup process. Your photos
              stay in your browser.
            </p>
            <div className="modal-actions center">
              <Link href="#/login?next=%2Fsell%2Fnew" className="button button-olive">
                Sign in
              </Link>
              <Link href="#/register?next=%2Fsell%2Fnew" className="button button-ghost">
                Create free account
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (editing && editing.sellerId !== user.id) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <LockKeyhole size={38} />
          <h2>That listing is not yours.</h2>
          <Link href="#/seller" className="button button-olive">
            Your dashboard
          </Link>
        </div>
      </main>
    );
  }

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const addImage = (image: string) => {
    setImages((previous) => (previous.includes(image) ? previous : [...previous, image]));
  };

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setFileBusy(true);
    const readers = Array.from(files)
      .slice(0, 4)
      .map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      );
    Promise.all(readers)
      .then((results) => {
        setImages((previous) => [...previous, ...results].slice(0, 6));
        toast("Photos added. They stay in this browser.", "success");
      })
      .catch(() => toast("Could not read that photo.", "error"))
      .finally(() => setFileBusy(false));
  };

  const submit = () => {
    const input = {
      title: form.title,
      description: form.description,
      brand: form.brand,
      condition: form.condition,
      category: form.category,
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
      if (result.ok) {
        toast("Listing updated.", "success");
        navigate(`#/product/${editing.id}`);
      } else {
        toast(result.error, "error");
      }
      return;
    }

    const result = createListing(input);
    if (result.ok) {
      toast("Listing created.", "success");
      navigate(`#/product/${result.productId}`);
    } else {
      toast(result.error, "error");
    }
  };

  const emptySlots = Math.max(0, 6 - images.length);

  return (
    <main className="page-shell sell-page">
      {editing ? (
        <div className="section-wrap sell-edit-strip">
          <PageHeader
            eyebrow="EDIT LISTING"
            title={
              <>
                Tidy up <em>{editing.title}</em>
              </>
            }
            description="Everything below saves straight to the live listing."
            action={
              <button
                type="button"
                className="text-link remove-link"
                onClick={() => {
                  if (!window.confirm("Remove this listing from the rail?")) return;
                  const result = removeListing(editing.id);
                  if (result.ok) {
                    toast("Listing removed.");
                    navigate("#/seller?tab=inventory");
                  } else {
                    toast(result.error, "error");
                  }
                }}
              >
                Remove listing
              </button>
            }
          />
        </div>
      ) : (
        <div className="section-wrap sell-form-head">
          <header className="page-header">
            <div>
              <h1>
                List it. Two minutes, <em>done.</em>
              </h1>
              <p>
                Photos first, then the piece, then the price. After that we work — a rider collects
                from your door.
              </p>
            </div>
          </header>
        </div>
      )}

      <section id="list-your-piece" className="section-wrap sell-form-zone">
        <div className="sell-layout">
          <div className="sell-main">
            <section className="sell-block">
              <div className="sell-block-head">
                <span className="step-number">01</span>
                <div>
                  <h2>Photos first</h2>
                  <p>Up to six. The first photo becomes the cover — natural light wins.</p>
                </div>
              </div>

              {images.length > 0 && (
                <div className="sell-photo-grid">
                  {images.map((image, index) => (
                    <div key={`${image}-${index}`} className="sell-photo">
                      <img src={image} alt={`Listing photo ${index + 1}`} />
                      {index === 0 && <span>COVER</span>}
                      <button
                        type="button"
                        aria-label="Remove photo"
                        onClick={() => setImages((previous) => previous.filter((item) => item !== image))}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  {emptySlots > 0 &&
                    Array.from({ length: emptySlots }).map((_, index) => (
                      <div key={`slot-${index}`} className="sell-photo is-empty" aria-hidden>
                        <Plus size={14} />
                      </div>
                    ))}
                </div>
              )}
              {images.length === 0 && (
                <div className="sell-photo-grid is-empty-only" aria-hidden>
                  <div className="sell-photo is-empty">
                    <ImagePlus size={18} />
                    <span>empty rail</span>
                  </div>
                  <div className="sell-photo is-empty">
                    <Plus size={14} />
                  </div>
                  <div className="sell-photo is-empty">
                    <Plus size={14} />
                  </div>
                  <div className="sell-photo is-empty">
                    <Plus size={14} />
                  </div>
                </div>
              )}

              <label className="sell-upload">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => onFiles(event.target.files)}
                />
                <Upload size={18} />
                <span>
                  <strong>{fileBusy ? "Reading photos…" : "Upload photos"}</strong>
                  <em>From this device. Demo only, they stay in the browser.</em>
                </span>
              </label>

              <div className="sell-url-row">
                <input
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="Or paste an image URL"
                  aria-label="Image URL"
                />
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => {
                    if (!imageUrl.trim()) return;
                    addImage(imageUrl.trim());
                    setImageUrl("");
                  }}
                >
                  <Plus size={14} /> Add
                </button>
              </div>

              <div className="sell-presets">
                <span>Or use a demo photo</span>
                <div>
                  {presetImages.map((image) => (
                    <button
                      key={image}
                      type="button"
                      className={images.includes(image) ? "is-selected" : ""}
                      onClick={() => addImage(image)}
                    >
                      <img src={image} alt="" />
                      {images.includes(image) && <Check size={12} />}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="sell-block">
              <div className="sell-block-head">
                <span className="step-number">02</span>
                <div>
                  <h2>The piece</h2>
                  <p>Be specific. Buyers want to know exactly what arrives.</p>
                </div>
              </div>

              <Field label="Title">
                <input
                  id="listing-title"
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                  placeholder="Worn-in denim jacket"
                  maxLength={80}
                />
              </Field>

              <div className="field-row three">
                <Field label="Brand" hint="Optional">
                  <input
                    value={form.brand}
                    onChange={(event) => update("brand", event.target.value)}
                    placeholder="Levi's"
                  />
                </Field>
                <Field label="Category">
                  <select value={form.category} onChange={(event) => update("category", event.target.value)}>
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Condition">
                  <select
                    value={form.condition}
                    onChange={(event) => update("condition", event.target.value)}
                  >
                    {conditions.map((condition) => (
                      <option key={condition} value={condition}>
                        {condition}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Description" hint="Mention fit, flaws, measurements — anything a buyer should know.">
                <textarea
                  rows={5}
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                  placeholder="A beautifully faded denim jacket with an easy, boxy fit…"
                />
              </Field>

              <div className="field-row three">
                <Field label="Size" hint="Optional">
                  <input value={form.size} onChange={(event) => update("size", event.target.value)} placeholder="M / L" />
                </Field>
                <Field label="Quantity">
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(event) => update("quantity", event.target.value)}
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Location">
                  <input value={form.location} onChange={(event) => update("location", event.target.value)} />
                </Field>
              </div>
            </section>

            <section className="sell-block">
              <div className="sell-block-head">
                <span className="step-number">03</span>
                <div>
                  <h2>Price & payout</h2>
                  <p>Asking price. Buyers pay it with Buy now — like any shop they know.</p>
                </div>
              </div>

              <div className="field-row two">
                <Field label="Asking price (₹)">
                  <input
                    id="listing-price"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={form.price}
                    onChange={(event) => update("price", event.target.value)}
                    placeholder="1450"
                  />
                </Field>
                <Field label="Shipping fee (₹)" hint="Free over ₹1,999 by default.">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.shipping}
                    onChange={(event) => update("shipping", event.target.value)}
                  />
                </Field>
              </div>

              {form.price && (
                <div className="sell-payout-card" role="status">
                  <div>
                    <span>You pocket</span>
                    <strong>{formatMoney(Math.max(0, Math.round(Number(form.price) * 100) - PLATFORM_CHARGE_PAISE))}</strong>
                  </div>
                  <p>
                    Your asking price in full, minus a flat ₹10 platform charge per product. Credited
                    within 5 business days after the buyer confirms arrival.
                  </p>
                </div>
              )}

              <div className="sell-options">
                <label>
                  <input
                    type="checkbox"
                    checked={form.allowOffers}
                    onChange={(event) => update("allowOffers", event.target.checked)}
                  />
                  <span>
                    <strong>Allow private offers</strong>
                    <em>Buyers send a price privately. You choose whether to accept.</em>
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.auctionConsent}
                    onChange={(event) => update("auctionConsent", event.target.checked)}
                  />
                  <span>
                    <strong>Open my listing to the twist</strong>
                    <em>
                      It may be picked at random for a short live auction — faster sale, never under
                      your base, and only 10% of the extra above base if it clears 130%.
                    </em>
                  </span>
                </label>
              </div>
            </section>
          </div>

          <aside className="sell-aside">
            <div className="summary-card">
              <h2>{editing ? "On the rail" : "Before the rail"}</h2>
              <div className="sell-preview">
                <div className="sell-preview-image">
                  {images[0] ? (
                    <img src={images[0]} alt="" />
                  ) : (
                    <div>
                      <ImagePlus size={22} />
                      <span>No photo yet</span>
                    </div>
                  )}
                </div>
                <div className="sell-preview-copy">
                  <span>
                    {form.condition} · {form.category}
                  </span>
                  <strong>{form.title || "Untitled listing"}</strong>
                  <em>{form.price ? formatMoney(Math.round(Number(form.price) * 100)) : "₹—"}</em>
                </div>
              </div>
              <ol className="sell-next-steps">
                <li>
                  {db.settings.sellerAutoApprove ? "Goes live the moment you publish." : "A quick admin review, then it's live."}
                </li>
                <li>Private offers (if you allow them) land in your dashboard.</li>
                <li>Buyer pays → rider collects from your door.</li>
                <li>Payout within 5 business days of buyer approval.</li>
              </ol>
              <button type="button" className="button button-olive summary-cta" onClick={submit}>
                {editing ? "Save changes" : "Hang it on the rail"} <ArrowUpRight size={15} />
              </button>
              <Link href="#/seller" className="button button-ghost summary-cta">
                Your dashboard
              </Link>
            </div>

            <div className="sell-tips">
              <h3>
                <Info size={15} /> Good to know
              </h3>
              <ul>
                <li>Delivery covers Trivandrum pincodes starting 695.</li>
                <li>A flat ₹10 platform charge applies per product sold.</li>
                <li>Offers stay private; there is no public haggling.</li>
              </ul>
              <div className="sell-trust">
                <ShieldCheck size={16} /> Your asking price is a promise, not a hope
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="sell-mobile-bar">
        {images[0] ? (
          <img src={images[0]} alt="" aria-hidden />
        ) : (
          <span className="sell-mobile-bar-empty" aria-hidden>
            <ImagePlus size={16} />
          </span>
        )}
        <span className="sell-mobile-bar-copy">
          <strong>{form.title || "Untitled listing"}</strong>
          <em>{form.price ? formatMoney(Math.round(Number(form.price) * 100)) : "Add a price"}</em>
        </span>
        <button type="button" className="button button-olive" onClick={submit}>
          {editing ? "Save" : "Publish"}
        </button>
      </div>
    </main>
  );
}
