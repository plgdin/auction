import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ImagePlus,
  Info,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Store,
  Upload,
  X,
} from "lucide-react";
import { Link, navigate } from "../components/Link";
import { Field, PageHeader } from "../components/Ui";
import { formatMoney } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";
import type { Category, Condition } from "../lib/types";

const categories: Category[] = [
  "Outerwear",
  "Tops & knits",
  "Denim",
  "Accessories",
  "Footwear",
  "Home & living",
  "Electronics",
  "Books & media",
];

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
  category: "Outerwear" as Category,
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
    }
  }, [editId, editing]);

  if (!user) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <Store size={38} />
          <h2>Sign in to sell.</h2>
          <p>You need an account before a listing can go on the rail.</p>
          <div className="modal-actions center">
            <Link href="#/login" className="button button-olive">
              Sign in
            </Link>
            <Link href="#/register" className="button button-ghost">
              Create account
            </Link>
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
            My listings
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
    const readers = Array.from(files).slice(0, 4).map(
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
          description="Set your own asking price. Buyers can buy instantly or send a private offer. Opt into auctions only if you want the piece to run live."
          action={
            editing ? (
              <button
                type="button"
                className="text-link remove-link"
                onClick={() => {
                  if (!window.confirm("Remove this listing from the rail?")) return;
                  const result = removeListing(editing.id);
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

        <div className="sell-layout">
          <div className="sell-main">
            <section className="sell-block">
              <div className="sell-block-head">
                <span className="step-number">01</span>
                <div>
                  <h2>The piece</h2>
                  <p>Be specific. Buyers want to know exactly what arrives.</p>
                </div>
              </div>

              <Field label="Title">
                <input
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
                  <select
                    value={form.category}
                    onChange={(event) => update("category", event.target.value)}
                  >
                    {categories.map((category) => (
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

              <Field
                label="Description"
                hint="Mention fit, flaws, measurements, and anything a buyer should know."
              >
                <textarea
                  rows={5}
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                  placeholder="A beautifully faded denim jacket with an easy, boxy fit…"
                />
              </Field>

              <div className="field-row three">
                <Field label="Size" hint="Optional">
                  <input
                    value={form.size}
                    onChange={(event) => update("size", event.target.value)}
                    placeholder="M / L"
                  />
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
                  <input
                    value={form.location}
                    onChange={(event) => update("location", event.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section className="sell-block">
              <div className="sell-block-head">
                <span className="step-number">02</span>
                <div>
                  <h2>Photos</h2>
                  <p>Add up to six. The first photo is the cover.</p>
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
                <span className="step-number">03</span>
                <div>
                  <h2>Price & options</h2>
                  <p>Set the asking price. This is what buyers pay with Buy now.</p>
                </div>
              </div>

              <div className="field-row three">
                <Field label="Asking price (₹)">
                  <input
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
                <Field label="You receive" hint="Before any auction adjustment.">
                  <div className="sell-payout">
                    {formatMoney(Math.round((Number(form.price) || 0) * 100))}
                  </div>
                </Field>
              </div>

              <div className="sell-options">
                <label>
                  <input
                    type="checkbox"
                    checked={form.allowOffers}
                    onChange={(event) => update("allowOffers", event.target.checked)}
                  />
                  <span>
                    <strong>Allow private offers</strong>
                    <em>Buyers can send a price privately. You choose whether to accept.</em>
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.auctionConsent}
                    onChange={(event) => update("auctionConsent", event.target.checked)}
                  />
                  <span>
                    <strong>Opt in to random live auctions</strong>
                    <em>
                      Your listing may be picked for a short live auction. Sellers are guaranteed the
                      asking price; the platform covers any shortfall.
                    </em>
                  </span>
                </label>
              </div>
            </section>
          </div>

          <aside className="sell-aside">
            <div className="summary-card">
              <h2>Listing preview</h2>
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
                  <span>{form.condition} · {form.category}</span>
                  <strong>{form.title || "Untitled listing"}</strong>
                  <em>{form.price ? formatMoney(Math.round(Number(form.price) * 100)) : "₹—"}</em>
                </div>
              </div>
              <p className="sell-aside-note">
                {db.settings.sellerAutoApprove
                  ? "Listings go live immediately in this demo. Admins can still review reports."
                  : "New listings wait for an admin review before going live."}
              </p>
              <button type="button" className="button button-olive summary-cta" onClick={submit}>
                {editing ? "Save changes" : "Publish listing"} <ArrowUpRight size={15} />
              </button>
              <Link href="#/seller" className="button button-ghost summary-cta">
                Seller dashboard
              </Link>
            </div>

            <div className="sell-tips">
              <h3>
                <Info size={14} /> Good to know
              </h3>
              <ul>
                <li>Every piece is one seller&apos;s own item.</li>
                <li>Delivery is limited to Trivandrum pincodes starting with 695.</li>
                <li>Auctions are optional and only run if you opt in.</li>
                <li>Offers are private. No public bidding on normal listings.</li>
              </ul>
              <div className="sell-trust">
                <ShieldCheck size={15} /> Asking price protected in auctions
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
