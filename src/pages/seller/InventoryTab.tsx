import { useMemo, useState } from "react";
import { Gavel, Pencil } from "lucide-react";
import { Link } from "../../components/Link";
import { Modal } from "../../components/Modal";
import { StatusPill, EmptyState } from "../../components/Ui";
import { formatMoney } from "../../lib/format";
import { auctionStartingPrice } from "../../lib/sellerMath";
import { useStore } from "../../lib/store";
import { toast } from "../../lib/toast";

const FILTERS = ["all", "active", "pending", "paused", "sold", "removed"] as const;
const FILTER_LABELS: Record<string, string> = {
  all: "All",
  active: "Active",
  pending: "In review",
  paused: "Paused",
  sold: "Sold",
  removed: "Removed",
};

export function InventoryTab() {
  const { db, user, toggleListingAvailability, removeListing, scheduleAuction, startAuctionNow } = useStore();
  const [filter, setFilter] = useState<string>("all");
  const [auctionTarget, setAuctionTarget] = useState<string>("");
  const [auctionStart, setAuctionStart] = useState<string>("");

  const myProducts = useMemo(
    () => db.products.filter((product) => product.sellerId === user?.id),
    [db.products, user],
  );
  const myAuctionFor = (productId: string) =>
    db.auctions.find(
      (auction) =>
        auction.productId === productId &&
        auction.sellerId === user?.id &&
        ["scheduled", "live"].includes(auction.status),
    );

  const shown = myProducts.filter((product) => {
    if (filter === "all") return true;
    if (filter === "active") return product.status === "active";
    if (filter === "pending") return product.status === "pending";
    if (filter === "paused") return product.status === "draft";
    if (filter === "sold") return product.status === "sold";
    return product.status === "removed";
  });

  const target = myProducts.find((product) => product.id === auctionTarget);
  const startPct = 50;

  return (
    <div className="dashboard-section">
      <div className="inventory-toolbar">
        <div className="inventory-chips" role="tablist" aria-label="Filter listings">
          {FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={`content-chip ${filter === id ? "is-active" : ""}`}
              onClick={() => setFilter(id)}
            >
              {FILTER_LABELS[id]}
              <span>
                {id === "all"
                  ? myProducts.length
                  : myProducts.filter((product) =>
                      id === "paused"
                        ? product.status === "draft"
                        : id === "removed"
                          ? product.status === "removed"
                          : product.status === id,
                    ).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {shown.length ? (
        <div className="inventory-list">
          {shown.map((product) => {
            const auction = myAuctionFor(product.id);
            return (
              <article key={product.id} className="inventory-row">
                <Link href={`#/product/${product.id}`} className="inventory-thumb">
                  <img src={product.images[0]} alt={product.title} />
                </Link>
                <div className="inventory-id">
                  <Link href={`#/product/${product.id}`} className="inventory-title">
                    {product.title}
                  </Link>
                  <span>
                    {product.category} · {product.condition} · {product.quantity} in stock · {product.views} views
                  </span>
                </div>
                <div className="inventory-price">
                  <strong>{formatMoney(product.askingPrice)}</strong>
                  <em>yours in full when it sells</em>
                </div>
                <div className="inventory-state">
                  {auction ? (
                    <span className="status-pill status-live">
                      <i />
                      {auction.status === "live" ? "In live auction" : "Auction scheduled"}
                    </span>
                  ) : (
                    <StatusPill status={product.status} />
                  )}
                </div>
                <div className="inventory-actions">
                  <Link href={`#/sell/new?edit=${product.id}`} className="text-link">
                    <Pencil size={12} /> Edit
                  </Link>
                  {product.status === "active" && !auction && (
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        setAuctionTarget(product.id);
                        setAuctionStart("");
                      }}
                    >
                      <Gavel size={12} /> Auction
                    </button>
                  )}
                  {auction?.status === "scheduled" && (
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        startAuctionNow(auction.id);
                        toast("Auction started.", "success");
                      }}
                    >
                      Start now
                    </button>
                  )}
                  {["active", "draft"].includes(product.status) && (
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        const result = toggleListingAvailability(product.id);
                        if (!result.ok) toast(result.error, "error");
                        else toast(product.status === "active" ? "Listing paused." : "Listing back on the rail.");
                      }}
                    >
                      {product.status === "active" ? "Pause" : "Resume"}
                    </button>
                  )}
                  {product.status !== "removed" && (
                    <button
                      type="button"
                      className="text-link danger"
                      onClick={() => {
                        if (!window.confirm("Remove this listing from the rail?")) return;
                        const result = removeListing(product.id);
                        if (!result.ok) toast(result.error, "error");
                        else toast("Listing removed.");
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Gavel size={34} />}
          title={filter === "all" ? "Empty shelf." : "Nothing in this shelf."}
          body={filter === "all" ? "Add the first piece and it will appear on the rail." : "Try another filter."}
          action={filter === "all" ? "Create a listing" : undefined}
          actionHref={filter === "all" ? "#/sell" : undefined}
        />
      )}

      {target && (
        <Modal title={`Schedule a live auction · ${target.title}`} onClose={() => setAuctionTarget("")}>
          <div className="auction-modal-body">
            <p>
              Bidding opens at <strong>{formatMoney(auctionStartingPrice(target.askingPrice, startPct))}</strong> —
              but you are always guaranteed <strong>{formatMoney(target.askingPrice)}</strong>. If bids stop short,
              lelam covers the difference.
            </p>
            <div className="auction-modal-row">
              <label>
                <span>Opens</span>
                <input
                  type="datetime-local"
                  value={auctionStart}
                  onChange={(event) => setAuctionStart(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="button button-olive"
                disabled={!auctionStart}
                onClick={() => {
                  const result = scheduleAuction(target.id, new Date(auctionStart).toISOString());
                  if (result.ok) {
                    toast("Auction scheduled. The hall does the rest.", "success");
                    setAuctionTarget("");
                    setAuctionStart("");
                  } else {
                    toast(result.error, "error");
                  }
                }}
              >
                Lock it in
              </button>
            </div>
            <p className="fineprint">
              The lot runs {db.settings.auctionDurationMinutes} minutes. You can start it early or end it from the
              Today rail.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
