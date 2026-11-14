import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Ban,
  Check,
  Gavel,
  IndianRupee,
  Settings2,
  Shield,
  ShieldAlert,
  Sparkles,
  Tag,
  Wallet,
  X,
} from "lucide-react";
import { Link } from "../components/Link";
import { Countdown } from "../components/Countdown";
import { EmptyState, Field, StatusPill, Tabs } from "../components/Ui";
import { formatDate, formatMoney, timeAgo } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { toast } from "../lib/toast";

export function AdminPage() {
  const {
    db,
    user,
    approveProduct,
    rejectProduct,
    setUserBlocked,
    generateAuctions,
    startAuctionNow,
    endAuctionNow,
    cancelAuction,
    markSettlementPaid,
    updateSettings,
    resolveReport,
    resolveDispute,
  } = useStore();
  const route = useRoute();
  const [tab, setTab] = useState(route.query.get("tab") || "overview");
  const [rejectId, setRejectId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [settings, setSettings] = useState(db.settings);
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [disputeNotes, setDisputeNotes] = useState<string>("");
  const [disputeFilter, setDisputeFilter] = useState<"all" | "open">("open");
  const [resolvingDispute, setResolvingDispute] = useState(false);

  useEffect(() => {
    setTab(route.query.get("tab") || "overview");
  }, [route.query]);

  useEffect(() => {
    setSettings(db.settings);
  }, [db.settings]);

  if (!user || user.role !== "admin") {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <Shield size={38} />
          <h2>Admin only.</h2>
          <p>Switch to the admin demo account to open this panel.</p>
          <Link href="#/login" className="button button-olive">
            Sign in as admin
          </Link>
        </div>
      </main>
    );
  }

  const setTabAndHash = (next: string) => {
    setTab(next);
    window.location.hash = `#/admin?tab=${next}`;
  };

  const pending = db.products.filter((product) => product.status === "pending");
  const reports = db.reports.filter((report) => report.status === "open" || report.status === "reviewing");
  const allDisputes = db.disputes ?? [];
  const openDisputes = allDisputes.filter((d) => ["opened", "seller_response", "under_review"].includes(d.status));
  const filteredDisputes = disputeFilter === "open" ? openDisputes : allDisputes;
  const liveAuctions = db.auctions.filter((auction) => auction.status === "live");
  const scheduledAuctions = db.auctions.filter((auction) => auction.status === "scheduled");
  const paidOrders = db.orders.filter((order) => order.paymentStatus === "paid");
  const gmv = paidOrders.reduce((total, order) => total + order.total, 0);
  const pendingSettlements = db.settlements.filter((settlement) => settlement.status !== "paid");
  const payoutDue = pendingSettlements.reduce(
    (total, settlement) => total + settlement.sellerPayout,
    0,
  );
  const platformRevenue = db.settlements.reduce(
    (total, settlement) => total + settlement.platformCommission,
    0,
  );

  return (
    <main className="page-shell dashboard-page admin-page">
      <div className="section-wrap">
        <div className="page-header">
          <div>
            <div className="eyebrow">ADMIN</div>
            <h1>
              The running <em>list.</em>
            </h1>
            <p>Review listings, keep auctions fair, and track the money.</p>
          </div>
          <div className="admin-header-actions">
            <button
              type="button"
              className="button button-ghost"
              onClick={async () => {
                const result = await generateAuctions();
                if (result.ok) toast("Auction schedule generated.", "success");
                else toast(result.error, "error");
              }}
            >
              <Sparkles size={15} /> Generate auctions
            </button>
            <Link href="#/products" className="button button-olive">
              Marketplace <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>

        <div className="stat-grid admin-stat-grid">
          <div className="stat-card">
            <span>
              <Tag size={15} /> Pending listings
            </span>
            <strong>{pending.length}</strong>
            <em>{reports.length} open reports</em>
          </div>
          <div className="stat-card">
            <span>
              <Gavel size={15} /> Live auctions
            </span>
            <strong>{liveAuctions.length}</strong>
            <em>{scheduledAuctions.length} scheduled</em>
          </div>
          <div className="stat-card">
            <span>
              <IndianRupee size={15} /> Paid GMV
            </span>
            <strong>{formatMoney(gmv)}</strong>
            <em>{paidOrders.length} paid orders</em>
          </div>
          <div className="stat-card">
            <span>
              <Wallet size={15} /> Payouts due
            </span>
            <strong>{formatMoney(payoutDue)}</strong>
            <em>{formatMoney(platformRevenue)} commission earned</em>
          </div>
        </div>

        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "listings", label: "Listings", count: pending.length },
            { id: "reports", label: "Reports", count: reports.length },
            { id: "disputes", label: "Disputes", count: openDisputes.length },
            { id: "users", label: "Users", count: db.users.length },
            { id: "auctions", label: "Auctions", count: db.auctions.length },
            { id: "finance", label: "Finance", count: pendingSettlements.length },
            { id: "settings", label: "Settings" },
          ]}
          active={tab}
          onChange={setTabAndHash}
        />

        {tab === "overview" && (
          <div className="dashboard-section">
            <div className="dashboard-two-col">
              <section className="panel">
                <div className="panel-head">
                  <h2>Review queue</h2>
                  <span>{pending.length} waiting</span>
                </div>
                {pending.length ? (
                  <ul className="attention-list">
                    {pending.slice(0, 4).map((product) => (
                      <li key={product.id}>
                        <img src={product.images[0]} alt={product.title} />
                        <div>
                          <strong>{product.title}</strong>
                          <span>
                            {product.sellerName} · {formatMoney(product.askingPrice)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="text-link"
                          onClick={async () => {
                            const result = await approveProduct(product.id);
                            if (result.ok) toast("Listing approved.", "success");
                            else toast(result.error, "error");
                          }}
                        >
                          Approve
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="panel-empty">Nothing waiting for review.</p>
                )}
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Audit log</h2>
                  <span>Latest actions</span>
                </div>
                <ul className="activity-list">
                  {db.auditLogs.slice(0, 6).map((log) => (
                    <li key={log.id}>
                      <span className="activity-dot" />
                      <div>
                        <strong>{log.action}</strong>
                        <span>{log.detail || log.entityType}</span>
                      </div>
                      <em>{timeAgo(log.createdAt)}</em>
                    </li>
                  ))}
                  {db.auditLogs.length === 0 && <p className="panel-empty">No activity yet.</p>}
                </ul>
              </section>
            </div>

            <section className="panel">
              <div className="panel-head">
                <h2>Live auctions</h2>
                <button type="button" className="text-link" onClick={() => setTabAndHash("auctions")}>
                  Manage
                </button>
              </div>
              {liveAuctions.length ? (
                <div className="mini-auction-grid">
                  {liveAuctions.map((auction) => {
                    const product = db.products.find((item) => item.id === auction.productId);
                    if (!product) return null;
                    return (
                      <div key={auction.id} className="mini-auction">
                        <img src={product.images[0]} alt={product.title} />
                        <div>
                          <strong>{product.title}</strong>
                          <span>
                            {formatMoney(auction.currentBid ?? auction.startingPrice)} ·{" "}
                            {auction.bidCount} bids
                          </span>
                          <Countdown to={auction.endsAt} compact />
                        </div>
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => {
                            endAuctionNow(auction.id);
                            toast("Auction ended and settled.", "success");
                          }}
                        >
                          End
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="panel-empty">No live auctions.</p>
              )}
            </section>
          </div>
        )}

        {tab === "listings" && (
          <div className="dashboard-section">
            <div className="panel-head">
              <h2>Listing review</h2>
              <span>Approve or reject new listings</span>
            </div>
            {pending.length ? (
              <div className="admin-listing-list">
                {pending.map((product) => (
                  <article key={product.id} className="admin-listing">
                    <img src={product.images[0]} alt={product.title} />
                    <div className="admin-listing-info">
                      <strong>{product.title}</strong>
                      <span>
                        {product.sellerName} · {product.category} · {product.condition}
                      </span>
                      <p>{product.description}</p>
                      <em>Listed {timeAgo(product.createdAt)}</em>
                    </div>
                    <strong className="admin-listing-price">{formatMoney(product.askingPrice)}</strong>
                    <div className="admin-listing-actions">
                      <button
                        type="button"
                        className="button button-olive"
                        onClick={async () => {
                          const result = await approveProduct(product.id);
                          if (result.ok) toast("Listing approved.", "success");
                          else toast(result.error, "error");
                        }}
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={() => {
                          setRejectId(product.id);
                          setRejectReason("");
                        }}
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Check size={34} />}
                title="Queue is clear."
                body="Every submitted listing has been reviewed."
              />
            )}

            {rejectId && (
              <div className="panel reject-panel">
                <h3>Reject listing</h3>
                <Field label="Reason" hint="The seller sees this message.">
                  <textarea
                    rows={3}
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="Photos do not match the description."
                  />
                </Field>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button button-olive"
                    onClick={async () => {
                      if (!rejectReason.trim()) {
                        toast("Add a reason.", "error");
                        return;
                      }
                      const result = await rejectProduct(rejectId, rejectReason.trim());
                      if (result.ok) {
                        toast("Listing rejected. Seller notified.");
                        setRejectId("");
                        setRejectReason("");
                      } else {
                        toast(result.error, "error");
                      }
                    }}
                  >
                    Send rejection
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() => setRejectId("")}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "reports" && (
          <div className="dashboard-section">
            <div className="panel-head">
              <h2>Reports</h2>
              <span>Buyer-submitted listing reports</span>
            </div>
            {db.reports.length ? (
              <div className="admin-report-list">
                {db.reports.map((report) => {
                  const product = db.products.find((item) => item.id === report.productId);
                  const reporter = db.users.find((item) => item.id === report.reporterId);
                  return (
                    <article key={report.id} className="admin-report">
                      <div>
                        <strong>{report.reason}</strong>
                        <span>
                          {product?.title ?? "Removed listing"} · reported by{" "}
                          {reporter?.name ?? "buyer"} · {timeAgo(report.createdAt)}
                        </span>
                        {report.details && <p>{report.details}</p>}
                      </div>
                      <StatusPill status={report.status} />
                      <div className="admin-report-actions">
                        {(["reviewing", "resolved", "dismissed"] as const).map((status) => (
                          <button
                            key={status}
                            type="button"
                            className="text-link"
                            onClick={async () => {
                              const result = await resolveReport(report.id, status);
                              if (result.ok) toast(`Report marked ${status}.`);
                              else toast(result.error, "error");
                            }}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Shield size={34} />}
                title="No reports."
                body="Buyer reports about listings will appear here."
              />
            )}
          </div>
        )}

        {tab === "disputes" && (
          <div className="dashboard-section">
            <div className="panel-head" style={{ marginBottom: "16px" }}>
              <div>
                <h2>Order Disputes & SNAD Claims</h2>
                <span>48-hour buyer protection inspection disputes</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className={`button ${disputeFilter === "open" ? "button-olive" : "button-ghost"}`}
                  style={{ padding: "6px 14px", fontSize: "12px" }}
                  onClick={() => setDisputeFilter("open")}
                >
                  Open Claims ({openDisputes.length})
                </button>
                <button
                  type="button"
                  className={`button ${disputeFilter === "all" ? "button-olive" : "button-ghost"}`}
                  style={{ padding: "6px 14px", fontSize: "12px" }}
                  onClick={() => setDisputeFilter("all")}
                >
                  All History ({allDisputes.length})
                </button>
              </div>
            </div>

            {filteredDisputes.length ? (
              <div className="admin-dispute-list" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {filteredDisputes.map((dispute) => {
                  const order = db.orders.find((item) => item.id === dispute.orderId);
                  const buyer = db.users.find((item) => item.id === dispute.buyerId);
                  const seller = db.users.find((item) => item.id === dispute.sellerId);
                  const product = order?.items[0]
                    ? db.products.find((p) => p.id === order.items[0].productId)
                    : undefined;
                  const isPending = ["opened", "seller_response", "under_review"].includes(dispute.status);

                  return (
                    <article
                      key={dispute.id}
                      className="panel"
                      style={{
                        padding: "20px",
                        border: isPending ? "1px solid #d39e00" : "1px solid #e0ddd0",
                        background: isPending ? "rgba(255, 193, 7, 0.03)" : undefined,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 12,
                          flexWrap: "wrap",
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <strong style={{ fontSize: "16px" }}>
                              Order {order?.number ?? dispute.orderId.slice(0, 8)}
                            </strong>
                            <StatusPill status={dispute.status} />
                            <span style={{ fontSize: "12px", color: "#666" }}>
                              {timeAgo(dispute.createdAt)}
                            </span>
                          </div>
                          <div style={{ fontSize: "13px", color: "#555", marginTop: 4 }}>
                            Buyer: <strong>{buyer?.name ?? "Buyer"}</strong> · Seller: <strong>{seller?.name ?? "Seller"}</strong> · Amount: <strong>{order ? formatMoney(order.total) : "—"}</strong>
                          </div>
                        </div>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "4px",
                            background: "#fff3cd",
                            color: "#856404",
                            fontSize: "12px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                          }}
                        >
                          {dispute.reason.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "20px",
                          marginTop: "14px",
                          padding: "16px",
                          background: "#fcfbf7",
                          borderRadius: 8,
                        }}
                      >
                        {/* Buyer Claim */}
                        <div>
                          <h4
                            style={{
                              margin: "0 0 8px",
                              fontSize: "12px",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                              color: "#856404",
                            }}
                          >
                            Buyer Claim & Evidence
                          </h4>
                          <p style={{ margin: "0 0 10px", fontSize: "13px", lineHeight: 1.5, color: "#222" }}>
                            "{dispute.description}"
                          </p>
                          {dispute.photoEvidence.length > 0 && (
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: 8 }}>
                              {dispute.photoEvidence.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={url}
                                    alt="Dispute evidence"
                                    style={{
                                      width: 64,
                                      height: 64,
                                      objectFit: "cover",
                                      borderRadius: 4,
                                      border: "1px solid #ccc",
                                    }}
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Listing Reference */}
                        <div>
                          <h4
                            style={{
                              margin: "0 0 8px",
                              fontSize: "12px",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                              color: "#333",
                            }}
                          >
                            Original Listing & Disclosure
                          </h4>
                          <div style={{ fontSize: "13px", color: "#444" }}>
                            <div>
                              Item: <strong>{product?.title ?? order?.items[0]?.title ?? "Product"}</strong>
                            </div>
                            <div>
                              Condition: <strong>{product?.condition ?? "—"}</strong>
                            </div>
                            {product?.hasFlaws ? (
                              <div style={{ color: "#d9534f", marginTop: 4 }}>
                                Disclosed Flaw:{" "}
                                <strong>
                                  {Array.isArray(product.flaws) && product.flaws.length > 0
                                    ? product.flaws.join(", ")
                                    : "Flaws disclosed by seller"}
                                </strong>
                              </div>
                            ) : (
                              <div style={{ color: "#28a745", marginTop: 4 }}>
                                Flaw disclosure: <em>No flaws disclosed at listing</em>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Admin Resolution Area */}
                      {isPending ? (
                        <div
                          style={{
                            marginTop: 16,
                            paddingTop: 16,
                            borderTop: "1px solid #eee",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 12,
                          }}
                        >
                          <input
                            type="text"
                            placeholder="Optional resolution note to buyer & seller..."
                            style={{ flex: 1, minWidth: 240, padding: "8px 12px", fontSize: "13px" }}
                            value={selectedDisputeId === dispute.id ? disputeNotes : ""}
                            onChange={(e) => {
                              setSelectedDisputeId(dispute.id);
                              setDisputeNotes(e.target.value);
                            }}
                          />
                          <div style={{ display: "flex", gap: "10px" }}>
                            <button
                              type="button"
                              className="button button-olive"
                              style={{ padding: "8px 16px", fontSize: "12px", background: "#2e7d32" }}
                              disabled={resolvingDispute}
                              onClick={async () => {
                                setResolvingDispute(true);
                                const notes = selectedDisputeId === dispute.id ? disputeNotes : undefined;
                                const res = await resolveDispute(dispute.id, "approved_refund", notes, true);
                                setResolvingDispute(false);
                                if (res.ok) {
                                  toast("Refund approved. Buyer refunded & order closed.", "success");
                                  setDisputeNotes("");
                                } else {
                                  toast(res.error, "error");
                                }
                              }}
                            >
                              <Check size={14} /> Approve Refund to Buyer
                            </button>
                            <button
                              type="button"
                              className="button button-ghost"
                              style={{ padding: "8px 16px", fontSize: "12px" }}
                              disabled={resolvingDispute}
                              onClick={async () => {
                                setResolvingDispute(true);
                                const notes = selectedDisputeId === dispute.id ? disputeNotes : undefined;
                                const res = await resolveDispute(dispute.id, "rejected", notes, false);
                                setResolvingDispute(false);
                                if (res.ok) {
                                  toast("Dispute rejected. Escrow released to seller.", "success");
                                  setDisputeNotes("");
                                } else {
                                  toast(res.error, "error");
                                }
                              }}
                            >
                              <X size={14} /> Reject (Release Payout)
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 12, fontSize: "12px", color: "#666" }}>
                          Resolved status: <strong>{dispute.status}</strong>
                          {dispute.adminNotes && ` · Note: ${dispute.adminNotes}`}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<ShieldAlert size={34} />}
                title="No disputes found."
                body="Buyer inspection and SNAD claims will appear here for mediation."
              />
            )}
          </div>
        )}

        {tab === "users" && (
          <div className="dashboard-section">
            <div className="panel-head">
              <h2>Users</h2>
              <span>Demo accounts and registered users</span>
            </div>
            <div className="listing-table">
              <div className="table-head">
                <span>User</span>
                <span>Role</span>
                <span>Seller</span>
                <span>Joined</span>
                <span>Action</span>
              </div>
              {db.users.map((account) => (
                <div key={account.id} className="table-row">
                  <div className="table-product">
                    <span className="account-avatar">{account.name.slice(0, 1)}</span>
                    <div>
                      <strong>{account.name}</strong>
                      <span>{account.email}</span>
                    </div>
                  </div>
                  <StatusPill status={account.role} />
                  <span>{account.isSeller ? "Yes" : "No"}</span>
                  <span>{formatDate(account.joinedAt)}</span>
                  <div className="table-actions">
                    {account.role !== "admin" && (
                      <button
                        type="button"
                        className="text-link danger"
                        onClick={async () => {
                          const result = await setUserBlocked(account.id, !account.blocked);
                          if (result.ok) toast(account.blocked ? "User unblocked." : "User blocked.");
                          else toast(result.error, "error");
                        }}
                      >
                        <Ban size={13} /> {account.blocked ? "Unblock" : "Block"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "auctions" && (
          <div className="dashboard-section">
            <div className="panel-head">
              <h2>Auctions</h2>
              <button
                type="button"
                className="text-link"
                onClick={async () => {
                  const result = await generateAuctions();
                  if (result.ok) toast("Auction schedule generated.", "success");
                  else toast(result.error, "error");
                }}
              >
                <Sparkles size={14} /> Generate schedule
              </button>
            </div>
            {db.auctions.length ? (
              <div className="seller-auction-list">
                {[...db.auctions]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((auction) => {
                    const product = db.products.find((item) => item.id === auction.productId);
                    if (!product) return null;
                    return (
                      <article key={auction.id} className="seller-auction">
                        <img src={product.images[0]} alt={product.title} />
                        <div className="seller-auction-info">
                          <div>
                            <strong>{product.title}</strong>
                            <span>
                              {product.sellerName} · asking {formatMoney(auction.askingPrice)}
                            </span>
                          </div>
                          <div className="seller-auction-stats">
                            <span>{formatMoney(auction.currentBid ?? auction.startingPrice)}</span>
                            <em>{auction.bidCount} bids</em>
                            {auction.status === "live" && <Countdown to={auction.endsAt} compact />}
                          </div>
                        </div>
                        <div className="seller-auction-actions">
                          <StatusPill
                            status={auction.status}
                            tone={auction.status === "live" ? "live" : undefined}
                          />
                          {auction.status === "scheduled" && (
                            <button
                              type="button"
                              className="text-link"
                              onClick={() => {
                                startAuctionNow(auction.id);
                                toast("Auction started.", "success");
                              }}
                            >
                              Start
                            </button>
                          )}
                          {auction.status === "live" && (
                            <button
                              type="button"
                              className="text-link"
                              onClick={() => {
                                endAuctionNow(auction.id);
                                toast("Auction ended and settled.", "success");
                              }}
                            >
                              End
                            </button>
                          )}
                          {["scheduled", "live"].includes(auction.status) && (
                            <button
                              type="button"
                              className="text-link danger"
                              onClick={() => {
                                if (!window.confirm("Cancel this auction?")) return;
                                cancelAuction(auction.id, "Cancelled by admin.");
                                toast("Auction cancelled.");
                              }}
                            >
                              Cancel
                            </button>
                          )}
                          <Link href={`#/auction/${auction.id}`} className="text-link">
                            View
                          </Link>
                        </div>
                      </article>
                    );
                  })}
              </div>
            ) : (
              <EmptyState
                icon={<Gavel size={34} />}
                title="No auctions."
                body="Generate a schedule from eligible listings."
              />
            )}
          </div>
        )}

        {tab === "finance" && (
          <div className="dashboard-section">
            <div className="earning-cards">
              <div className="stat-card is-dark">
                <span>
                  <IndianRupee size={15} /> Paid GMV
                </span>
                <strong>{formatMoney(gmv)}</strong>
                <em>Across {paidOrders.length} paid orders</em>
              </div>
              <div className="stat-card">
                <span>
                  <Wallet size={15} /> Payouts due
                </span>
                <strong>{formatMoney(payoutDue)}</strong>
                <em>{pendingSettlements.length} settlements</em>
              </div>
              <div className="stat-card">
                <span>
                  <BadgeCheck size={15} /> Commission
                </span>
                <strong>{formatMoney(platformRevenue)}</strong>
                <em>Above asking price only</em>
              </div>
            </div>

            <section className="panel">
              <div className="panel-head">
                <h2>Settlements</h2>
                <span>Mark payouts as paid manually</span>
              </div>
              {db.settlements.length ? (
                <div className="listing-table">
                  <div className="table-head">
                    <span>Seller</span>
                    <span>Source</span>
                    <span>Payout</span>
                    <span>Status</span>
                    <span>Action</span>
                  </div>
                  {db.settlements.map((settlement) => {
                    const seller = db.users.find((item) => item.id === settlement.sellerId);
                    return (
                      <div key={settlement.id} className="table-row">
                        <div className="table-product">
                          <div>
                            <strong>{seller?.name ?? "Seller"}</strong>
                            <span>{formatDate(settlement.createdAt)}</span>
                          </div>
                        </div>
                        <span>{settlement.source}</span>
                        <strong>{formatMoney(settlement.sellerPayout)}</strong>
                        <StatusPill status={settlement.status} />
                        <div className="table-actions">
                          {settlement.status !== "paid" && (
                            <button
                              type="button"
                              className="text-link"
                              onClick={async () => {
                                const result = await markSettlementPaid(settlement.id);
                                if (result.ok) toast("Settlement marked paid.", "success");
                                else toast(result.error, "error");
                              }}
                            >
                              Mark paid
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="panel-empty">No settlements yet.</p>
              )}
            </section>
          </div>
        )}

        {tab === "settings" && (
          <div className="dashboard-section">
            <div className="panel-head">
              <h2>Platform settings</h2>
              <span>Applies platform-wide</span>
            </div>
            <form
              className="panel settings-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const result = await updateSettings(settings);
                if (result.ok) toast("Settings saved.", "success");
                else toast(result.error, "error");
              }}
            >
              <div className="settings-grid">
                <Field
                  label="Auction engine"
                  hint="Read-only until the auction backend ships."
                >
                  <label className="checkbox-line">
                    <input
                      type="checkbox"
                      disabled
                      checked={settings.auctionEngineEnabled}
                      onChange={(event) =>
                        setSettings((previous) => ({
                          ...previous,
                          auctionEngineEnabled: event.target.checked,
                        }))
                      }
                    />
                    Enabled
                  </label>
                </Field>
                <Field label="Daily auction slots">
                  <input
                    type="number"
                    min={1}
                    value={settings.auctionDailyCount}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        auctionDailyCount: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Starting price (% of base)" hint="Fixed at 50%; rounded to the nearest rupee.">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={50}
                    readOnly
                  />
                </Field>
                <Field label="Auction duration (minutes)">
                  <input
                    type="number"
                    min={1}
                    value={settings.auctionDurationMinutes}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        auctionDurationMinutes: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Min. increment (₹)">
                  <input
                    type="number"
                    min={1}
                    value={settings.auctionMinIncrement / 100}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        auctionMinIncrement: Math.round(Number(event.target.value) * 100),
                      }))
                    }
                  />
                </Field>
                <Field label="Anti-snipe window (seconds)">
                  <input
                    type="number"
                    min={1}
                    value={settings.auctionAntiSnipeSeconds}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        auctionAntiSnipeSeconds: Number(event.target.value),
                        auctionAntiSnipeTriggerSeconds: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Payment deadline (hours)">
                  <input
                    type="number"
                    min={1}
                    value={settings.auctionPaymentDeadlineHours}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        auctionPaymentDeadlineHours: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Offer validity (hours)">
                  <input
                    type="number"
                    min={1}
                    value={settings.offerValidityHours}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        offerValidityHours: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Offer checkout window (hours)">
                  <input
                    type="number"
                    min={1}
                    value={settings.offerCheckoutHours}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        offerCheckoutHours: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Shipping fee (₹)">
                  <input
                    type="number"
                    min={0}
                    value={settings.shippingFee / 100}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        shippingFee: Math.round(Number(event.target.value) * 100),
                      }))
                    }
                  />
                </Field>
                <Field label="Free shipping over (₹)">
                  <input
                    type="number"
                    min={0}
                    value={settings.freeShippingThreshold / 100}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        freeShippingThreshold: Math.round(Number(event.target.value) * 100),
                      }))
                    }
                  />
                </Field>
                <Field label="Commission on extra (past 130% of base)" hint="Fixed at 10% of the amount above base.">
                  <input
                    type="number"
                    value={10}
                    readOnly
                  />
                </Field>
                <Field label="Bid rate limit (per minute)">
                  <input
                    type="number"
                    min={1}
                    value={settings.bidRateLimitPerMinute}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        bidRateLimitPerMinute: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Serviceable pincode prefixes" hint="Comma separated. Trivandrum is 695.">
                  <input
                    value={settings.serviceablePrefixes.join(", ")}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        serviceablePrefixes: event.target.value
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean),
                      }))
                    }
                  />
                </Field>
                <Field label="Seller auto-approve listings">
                  <label className="checkbox-line">
                    <input
                      type="checkbox"
                      checked={settings.sellerAutoApprove}
                      onChange={(event) =>
                        setSettings((previous) => ({
                          ...previous,
                          sellerAutoApprove: event.target.checked,
                        }))
                      }
                    />
                    New listings go live immediately
                  </label>
                </Field>
              </div>
              <div className="modal-actions">
                <button type="submit" className="button button-olive">
                  <Settings2 size={15} /> Save settings
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => {
                    setSettings(db.settings);
                    toast("Changes reset.");
                  }}
                >
                  Reset form
                </button>
              </div>
            </form>

            <div className="panel audit-panel">
              <div className="panel-head">
                <h2>Audit log</h2>
                <span>{db.auditLogs.length} entries</span>
              </div>
              <ul className="activity-list">
                {db.auditLogs.map((log) => (
                  <li key={log.id}>
                    <span className="activity-dot" />
                    <div>
                      <strong>{log.action}</strong>
                      <span>{log.detail || log.entityType}</span>
                    </div>
                    <em>{timeAgo(log.createdAt)}</em>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="dashboard-footnote">
          <Shield size={15} />
          Admin actions affect the browser demo only. No real listings, payouts, or auctions exist.
          <Link href="#/products" className="text-link">
            Back to marketplace
          </Link>
        </div>
      </div>
    </main>
  );
}
