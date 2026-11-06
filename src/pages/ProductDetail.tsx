import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Flag,
  Heart,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
  UserRound,
} from "lucide-react";
import { Modal } from "../components/Modal";
import { Link, navigate } from "../components/Link";
import { ProductCard } from "../components/ProductCard";
import { StatusPill, Field } from "../components/Ui";
import { formatDate, formatMoney } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";

export function ProductDetailPage() {
  const route = useRoute();
  const { db, user, favorites, toggleFavorite, addToCart, makeOffer, reportProduct } = useStore();
  const productId = route.path.split("/")[2] || "";
  const product = db.products.find((item) => item.id === productId);
  const [imageIndex, setImageIndex] = useState(0);
  const [offerOpen, setOfferOpen] = useState(route.query.get("offer") === "1");
  const [reportOpen, setReportOpen] = useState(false);
  const [offerRupees, setOfferRupees] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");

  useEffect(() => {
    setOfferOpen(route.query.get("offer") === "1");
    setImageIndex(0);
  }, [productId, route.query]);

  if (!product) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <ShoppingBag size={36} />
          <h2>This listing is not here.</h2>
          <p>It may have been removed or sold.</p>
          <Link href="#/products" className="button button-olive">
            Back to the rail
          </Link>
        </div>
      </main>
    );
  }

  const auction = db.auctions.find(
    (entry) => entry.productId === product.id && ["live", "scheduled"].includes(entry.status),
  );
  const ownListing = user?.id === product.sellerId;
  const available = product.status === "active" && !auction && product.quantity > 0;
  const saved = favorites.includes(product.id);
  const seller = db.users.find((candidate) => candidate.id === product.sellerId);
  const reviews = db.reviews.filter((review) => review.sellerId === product.sellerId);
  const rating =
    reviews.length > 0
      ? (reviews.reduce((total, review) => total + review.rating, 0) / reviews.length).toFixed(1)
      : null;
  const similar = db.products
    .filter(
      (item) =>
        item.id !== product.id &&
        item.category === product.category &&
        item.status === "active" &&
        item.sellerId !== product.sellerId,
    )
    .slice(0, 4);

  const offerPaise = Math.round(Number(offerRupees) * 100);
  const suggested = [0.9, 0.8, 0.7].map((factor) =>
    Math.round((product.askingPrice * factor) / 100) * 100,
  );

  const handleOffer = () => {
    const result = makeOffer(product.id, offerPaise, offerMessage);
    if (result.ok) {
      toast("Offer sent privately to the seller.", "success");
      setOfferOpen(false);
      setOfferRupees("");
      setOfferMessage("");
    } else {
      toast(result.error, "error");
    }
  };

  return (
    <main className="page-shell product-detail-page">
      <div className="section-wrap">
        <div className="breadcrumbs">
          <Link href="#/products">
            <ArrowLeft size={14} /> All pieces
          </Link>
          <span>/</span>
          <Link href={`#/products?category=${encodeURIComponent(product.category)}`}>
            {product.category}
          </Link>
          <span>/</span>
          <span>{product.title}</span>
        </div>

        <div className="product-detail-layout">
          <div className="product-gallery">
            <div className="product-gallery-main">
              <img src={product.images[imageIndex]} alt={product.title} />
              <button
                type="button"
                className={`gallery-save ${saved ? "is-saved" : ""}`}
                onClick={() => {
                  toggleFavorite(product.id);
                  toast(saved ? "Removed from saved." : "Saved to your watchlist.", "success");
                }}
                aria-label={saved ? "Unsave" : "Save"}
              >
                <Heart size={18} fill={saved ? "currentColor" : "none"} />
              </button>
              <span className="gallery-condition">{product.condition}</span>
            </div>
            {product.images.length > 1 && (
              <div className="product-gallery-thumbs">
                {product.images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    className={imageIndex === index ? "is-active" : ""}
                    onClick={() => setImageIndex(index)}
                    aria-label={`View image ${index + 1}`}
                  >
                    <img src={image} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="product-detail-info">
            <div className="product-detail-topline">
              <span>{product.category}</span>
              <StatusPill status={product.status} />
            </div>
            <h1>{product.title}</h1>
            <div className="product-detail-price">
              <strong>{formatMoney(product.askingPrice)}</strong>
              <span>Asking price · set by the seller</span>
            </div>

            {auction ? (
              <div className="auction-notice">
                <div>
                  <span className="live-dot" />
                  <strong>
                    {auction.status === "live" ? "This piece is in a live auction." : "This piece is scheduled for auction."}
                  </strong>
                  <p>
                    {auction.status === "live"
                      ? "Buy-now is paused while bidding is open."
                      : "It can still be bought until the auction begins."}
                  </p>
                </div>
                <Link href={`#/auction/${auction.id}`} className="button button-olive">
                  View auction <ArrowUpRight size={15} />
                </Link>
              </div>
            ) : null}

            {!auction && (
              <div className="product-actions">
                {ownListing ? (
                  <Link href={`#/sell?edit=${product.id}`} className="button button-olive">
                    Manage your listing <ArrowUpRight size={16} />
                  </Link>
                ) : available ? (
                  <>
                    <button
                      type="button"
                      className="button button-olive"
                      onClick={() => {
                        if (!user) {
                          toast("Sign in to buy this piece.", "error");
                          navigate("#/login");
                          return;
                        }
                        navigate(`#/checkout?product=${product.id}`);
                      }}
                    >
                      Buy now <ArrowUpRight size={16} />
                    </button>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() => {
                        const result = addToCart(product.id);
                        if (result.ok) {
                          toast("Added to cart.", "success");
                        } else {
                          toast(result.error, "error");
                        }
                      }}
                    >
                      <ShoppingBag size={16} /> Add to cart
                    </button>
                    {product.allowOffers && (
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={() => {
                          if (!user) {
                            toast("Sign in to make an offer.", "error");
                            navigate("#/login");
                            return;
                          }
                          setOfferOpen(true);
                        }}
                      >
                        <Tag size={16} /> Make an offer
                      </button>
                    )}
                  </>
                ) : (
                  <div className="unavailable-note">
                    <StatusPill status={product.status} />
                    <span>
                      {product.status === "reserved"
                        ? "Another buyer is completing checkout right now."
                        : product.status === "sold"
                          ? "This piece has found a new home."
                          : "This listing is not available right now."}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="product-facts">
              <div>
                <span>Condition</span>
                <strong>{product.condition}</strong>
              </div>
              <div>
                <span>Size</span>
                <strong>{product.size || "One size"}</strong>
              </div>
              <div>
                <span>Brand</span>
                <strong>{product.brand || "Unbranded"}</strong>
              </div>
              <div>
                <span>Quantity</span>
                <strong>{product.quantity === 1 ? "One of one" : `${product.quantity} available`}</strong>
              </div>
            </div>

            <div className="product-delivery">
              <Truck size={18} />
              <div>
                <strong>Doorstep delivery in Trivandrum</strong>
                <p>
                  Shipping {product.shippingFee === 0 ? "included" : formatMoney(product.shippingFee)} ·
                  Delivered from {product.location}. Serviceable pincodes start with 695.
                </p>
              </div>
            </div>

            <div className="product-description">
              <h2>The details</h2>
              <p>{product.description}</p>
            </div>

            <div className="product-seller-card">
              <div className="seller-avatar">{product.sellerName.slice(0, 1)}</div>
              <div>
                <span>Sold by</span>
                <strong>{product.sellerName}</strong>
                <p>
                  {seller?.bio || "An independent seller on lelam.co."}
                  {rating && <em> · {rating} ★ from {reviews.length} reviews</em>}
                </p>
                <span className="seller-location">
                  <MapPin size={12} /> {product.location} · Joined{" "}
                  {seller ? formatDate(seller.joinedAt) : "recently"}
                </span>
              </div>
              <button
                type="button"
                className="text-link report-link"
                onClick={() => {
                  if (!user) {
                    toast("Sign in to report a listing.", "error");
                    navigate("#/login");
                    return;
                  }
                  setReportOpen(true);
                }}
              >
                <Flag size={13} /> Report
              </button>
            </div>

            <div className="product-trust">
              <span>
                <ShieldCheck size={16} /> Condition described by the seller
              </span>
              <span>
                <Package size={16} /> Packed for pickup
              </span>
              <span>
                <UserRound size={16} /> Private offers, never public
              </span>
            </div>
          </div>
        </div>

        {similar.length > 0 && (
          <section className="similar-section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">YOU MAY ALSO LIKE</div>
                <h2>More in {product.category.toLowerCase()}.</h2>
              </div>
              <Link href={`#/products?category=${encodeURIComponent(product.category)}`} className="text-link">
                See all <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="product-grid">
              {similar.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}
      </div>

      {offerOpen && (
        <Modal title="Make a private offer" onClose={() => setOfferOpen(false)}>
          <div className="offer-modal">
            <div className="offer-modal-product">
              <img src={product.images[0]} alt={product.title} />
              <div>
                <strong>{product.title}</strong>
                <span>Asking price {formatMoney(product.askingPrice)}</span>
              </div>
            </div>
            <p className="modal-subtitle">
              Your offer is private. Other buyers will never see it. The seller can accept or reject.
              If accepted, you get {db.settings.offerCheckoutHours} hours to pay.
            </p>
            <Field label="Your offer (₹)">
              <input
                type="number"
                min={1}
                inputMode="numeric"
                placeholder={String(Math.round(product.askingPrice / 100 / 10) * 10)}
                value={offerRupees}
                onChange={(event) => setOfferRupees(event.target.value)}
              />
            </Field>
            <div className="offer-presets">
              {suggested.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="chip-button"
                  onClick={() => setOfferRupees(String(amount / 100))}
                >
                  {formatMoney(amount)}
                </button>
              ))}
            </div>
            <Field label="Message to the seller" hint="Optional. Friendly and clear works best.">
              <textarea
                rows={3}
                value={offerMessage}
                onChange={(event) => setOfferMessage(event.target.value)}
                placeholder="Would you consider this? I can pay right away."
              />
            </Field>
            <div className="modal-actions">
              <button type="button" className="button button-olive" onClick={handleOffer}>
                Send private offer
              </button>
              <button type="button" className="button button-ghost" onClick={() => setOfferOpen(false)}>
                Cancel
              </button>
            </div>
            <p className="fineprint">
              Offers are not auctions. There is no competitive bidding, and no one else can see your price.
            </p>
          </div>
        </Modal>
      )}

      {reportOpen && (
        <Modal title="Report this listing" onClose={() => setReportOpen(false)}>
          <div className="report-modal">
            <Field label="Reason">
              <select
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
              >
                <option value="">Choose a reason</option>
                <option value="Counterfeit or replica">Counterfeit or replica</option>
                <option value="Item not as described">Item not as described</option>
                <option value="Prohibited item">Prohibited item</option>
                <option value="Suspicious seller">Suspicious seller</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Details" hint="Optional, but helpful for the admin review.">
              <textarea
                rows={3}
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
              />
            </Field>
            <div className="modal-actions">
              <button
                type="button"
                className="button button-olive"
                onClick={() => {
                  const result = reportProduct(product.id, reportReason, reportDetails);
                  if (result.ok) {
                    toast("Report sent to the admin team.", "success");
                    setReportOpen(false);
                    setReportReason("");
                    setReportDetails("");
                  } else {
                    toast(result.error, "error");
                  }
                }}
              >
                Send report <Check size={15} />
              </button>
              <button type="button" className="button button-ghost" onClick={() => setReportOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
