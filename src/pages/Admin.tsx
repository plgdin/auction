import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Ban,
  Check,
  Copy,
  Gavel,
  IndianRupee,
  Link2,
  Settings2,
  Shield,
  Sparkles,
  Tag,
  Wallet,
  X,
} from "lucide-react";
import { Link, navigate } from "../components/Link";
import { Countdown } from "../components/Countdown";
import { EmptyState, Field, StatusPill, Tabs } from "../components/Ui";
import { formatDate, formatMoney, timeAgo } from "../lib/format";
import { affiliateUrl, summariseAffiliate } from "../lib/affiliate";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import type { AffiliateAccount } from "../lib/types";
import { toast } from "../lib/toast";

export function AdminPage() {
  const {
    db,
    user,
    approveProduct,
    rejectProduct,
    setUserBlocked,
    updateSellerTier,
    generateAuctions,
    startAuctionNow,
    endAuctionNow,
    cancelAuction,
    markSettlementPaid,
    updateSettings,
    resolveReport,
    createAffiliate,
    updateAffiliate,
    reviewAffiliateCommission,
  } = useStore();
  const route = useRoute();
  const [tab, setTab] = useState(route.query.get("tab") || "overview");
  const [rejectId, setRejectId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [settings, setSettings] = useState(db.settings);
  const [affiliateForm, setAffiliateForm] = useState({
    name: "",
    email: "",
    code: "",
    kind: "creator" as AffiliateAccount["kind"],
    commissionPct: db.settings.affiliateCommissionPct,
  });
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});

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
          <Link href="/login" className="button button-olive">
            Sign in as admin
          </Link>
        </div>
      </main>
    );
  }

  const setTabAndHash = (next: string) => {
    setTab(next);
    navigate(`/admin?tab=${next}`);
  };

  const pending = db.products.filter((product) => product.status === "pending");
  const reports = db.reports.filter((report) => report.status === "open" || report.status === "reviewing");
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
    (total, settlement) =>
      total + settlement.platformCommission + (settlement.buyerPlatformFee ?? 0),
    0,
  );
  const affiliateAccounts = [...(db.affiliates ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const affiliateCommissions = [...(db.affiliateCommissions ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const affiliatePendingCount = affiliateCommissions.filter(
    (entry) => entry.status === "pending" || entry.status === "approved",
  ).length;
  const affiliateApprovedTotal = affiliateCommissions
    .filter((entry) => entry.status === "approved")
    .reduce((total, entry) => total + entry.amount, 0);
  const affiliatePaidTotal = affiliateCommissions
    .filter((entry) => entry.status === "paid")
    .reduce((total, entry) => total + entry.amount, 0);

  const copyAffiliate = async (code: string) => {
    try {
      await navigator.clipboard.writeText(affiliateUrl(code));
      toast("Link copied.", "success");
    } catch {
      toast("Could not copy the link.", "error");
    }
  };

  const submitAffiliate = async () => {
    const result = await createAffiliate({
      name: affiliateForm.name,
      email: affiliateForm.email,
      code: affiliateForm.code,
      kind: affiliateForm.kind,
      commissionPct: Number(affiliateForm.commissionPct) || 0,
    });
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast("Affiliate link created.", "success");
    setAffiliateForm((previous) => ({
      ...previous,
      name: "",
      email: "",
      code: "",
    }));
  };

  const saveAffiliateRate = async (account: AffiliateAccount) => {
    const draft = rateDrafts[account.id];
    if (draft === undefined) return;
    const next = Number(draft);
    if (!Number.isFinite(next) || next < 0 || next > 50) {
      toast("Use a rate between 0 and 50%.", "error");
      setRateDrafts((previous) => {
        const copy = { ...previous };
        delete copy[account.id];
        return copy;
      });
      return;
    }
    if (next / 100 === account.commissionRate) return;
    const result = await updateAffiliate(account.id, { commissionPct: next });
    if (!result.ok) toast(result.error, "error");
    else toast(`${account.name} now earns ${next}%.`, "success");
    setRateDrafts((previous) => {
      const copy = { ...previous };
      delete copy[account.id];
      return copy;
    });
  };

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
              onClick={() => {
                const result = generateAuctions();
                if (result.ok) toast("Auction schedule generated.", "success");
                else toast(result.error, "error");
              }}
            >
              <Sparkles size={15} /> Generate auctions
            </button>
            <Link href="/products" className="button button-olive">
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
            <em>{formatMoney(platformRevenue)} platform revenue</em>
          </div>
        </div>

        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "listings", label: "Listings", count: pending.length },
            { id: "reports", label: "Reports", count: reports.length },
            { id: "users", label: "Users", count: db.users.length },
            { id: "auctions", label: "Auctions", count: db.auctions.length },
            { id: "finance", label: "Finance", count: pendingSettlements.length },
            { id: "affiliates", label: "Affiliates", count: affiliatePendingCount },
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
                          onClick={() => {
                            approveProduct(product.id);
                            toast("Listing approved.", "success");
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
                        onClick={() => {
                          approveProduct(product.id);
                          toast("Listing approved.", "success");
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
                    onClick={() => {
                      if (!rejectReason.trim()) {
                        toast("Add a reason.", "error");
                        return;
                      }
                      rejectProduct(rejectId, rejectReason.trim());
                      toast("Listing rejected. Seller notified.");
                      setRejectId("");
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
                            onClick={() => {
                              resolveReport(report.id, status);
                              toast(`Report marked ${status}.`);
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
                <span>Seller Tier & Fee</span>
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
                  <StatusPill status={account.role === "admin" ? "admin" : "active"} />
                  <div>
                    {account.role !== "admin" ? (
                      <select
                        aria-label={`Seller tier for ${account.name}`}
                        value={account.sellerTier || "normal"}
                        onChange={(e) => {
                          const tier = e.target.value as "normal" | "verified";
                          updateSellerTier(account.id, tier);
                          toast(
                            `Updated ${account.name} seller verification status. Commission remains 10%, inclusive of GST.`,
                            "success",
                          );
                        }}
                        style={{
                          fontSize: "12px",
                          fontWeight: 500,
                          padding: "4px 8px",
                          borderRadius: "6px",
                          border: account.sellerTier === "verified" ? "1px solid #15803d" : "1px solid #cbd5e1",
                          background: account.sellerTier === "verified" ? "#f0fdf4" : "#ffffff",
                          color: account.sellerTier === "verified" ? "#15803d" : "#334155",
                          cursor: "pointer",
                        }}
                      >
                        <option value="normal">Normal Seller (10%)</option>
                        <option value="verified">Verified seller (10% commission)</option>
                      </select>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                  <span>{formatDate(account.joinedAt)}</span>
                  <div className="table-actions">
                    {account.role !== "admin" && (
                      <button
                        type="button"
                        className="text-link danger"
                        onClick={() => {
                          setUserBlocked(account.id, !account.blocked);
                          toast(account.blocked ? "User unblocked." : "User blocked.");
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
                onClick={() => {
                  const result = generateAuctions();
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
                          <Link href={`/auction/${auction.id}`} className="text-link">
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
                  <BadgeCheck size={15} /> Platform revenue
                </span>
                <strong>{formatMoney(platformRevenue)}</strong>
                <em>Seller commission + buyer fees</em>
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
                                if (result.ok) toast("Payout recorded as sent. No transfer was initiated.", "success");
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

        {tab === "affiliates" && (
          <div className="dashboard-section">
            <div className="earning-cards">
              <div className="stat-card">
                <span>
                  <Link2 size={15} /> Links
                </span>
                <strong>{affiliateAccounts.length}</strong>
                <em>{affiliateAccounts.filter((account) => account.status === "active").length} active</em>
              </div>
              <div className="stat-card">
                <span>
                  <Wallet size={15} /> Ready to pay
                </span>
                <strong>{formatMoney(affiliateApprovedTotal)}</strong>
                <em>{affiliateCommissions.filter((entry) => entry.status === "approved").length} earnings released</em>
              </div>
              <div className="stat-card is-dark">
                <span>
                  <BadgeCheck size={15} /> Paid out
                </span>
                <strong>{formatMoney(affiliatePaidTotal)}</strong>
                <em>All time</em>
              </div>
            </div>

            <section className="panel">
              <div className="panel-head">
                <h2>Create a link</h2>
                <span>For colleges, creators, and partners</span>
              </div>
              <form
                className="settings-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitAffiliate();
                }}
              >
                <div className="form-grid">
                  <Field label="Name" hint="Shown in your reports.">
                    <input
                      value={affiliateForm.name}
                      onChange={(event) =>
                        setAffiliateForm((previous) => ({ ...previous, name: event.target.value }))
                      }
                      placeholder="Campus Finds Club"
                    />
                  </Field>
                  <Field label="Contact email">
                    <input
                      type="email"
                      value={affiliateForm.email}
                      onChange={(event) =>
                        setAffiliateForm((previous) => ({ ...previous, email: event.target.value }))
                      }
                      placeholder="hello@college.edu"
                    />
                  </Field>
                  <Field label="Link code" hint="4–20 letters or numbers. Left blank, we make one.">
                    <input
                      value={affiliateForm.code}
                      onChange={(event) =>
                        setAffiliateForm((previous) => ({ ...previous, code: event.target.value }))
                      }
                      placeholder="collegefinds"
                    />
                  </Field>
                  <Field label="Type">
                    <select
                      value={affiliateForm.kind}
                      onChange={(event) =>
                        setAffiliateForm((previous) => ({
                          ...previous,
                          kind: event.target.value as AffiliateAccount["kind"],
                        }))
                      }
                    >
                      <option value="creator">Creator</option>
                      <option value="college">College</option>
                      <option value="partner">Partner</option>
                    </select>
                  </Field>
                  <Field label="Commission (%)" hint="Share of the item subtotal.">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step={0.5}
                      value={affiliateForm.commissionPct}
                      onChange={(event) =>
                        setAffiliateForm((previous) => ({
                          ...previous,
                          commissionPct: Number(event.target.value),
                        }))
                      }
                    />
                  </Field>
                </div>
                <div className="modal-actions">
                  <button type="submit" className="button button-olive">
                    <Link2 size={15} /> Create link
                  </button>
                </div>
              </form>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Links</h2>
                <span>Change the rate or pause a partner anytime</span>
              </div>
              {affiliateAccounts.length ? (
                <div className="listing-table affiliate-table">
                  <div className="table-head">
                    <span>Partner</span>
                    <span>Link</span>
                    <span>Rate</span>
                    <span>Clicks / orders</span>
                    <span>Status</span>
                    <span>Actions</span>
                  </div>
                  {affiliateAccounts.map((account) => {
                    const summary = summariseAffiliate(account, db);
                    return (
                      <div key={account.id} className="table-row">
                        <div className="table-product">
                          <div>
                            <strong>{account.name}</strong>
                            <span>
                              {account.kind}
                              {account.userId ? " · site member" : ""}
                              {account.email ? ` · ${account.email}` : ""}
                            </span>
                          </div>
                        </div>
                        <span>?ref={account.code}</span>
                        <input
                          className="affiliate-rate-input"
                          type="number"
                          min={0}
                          max={50}
                          step={0.5}
                          value={rateDrafts[account.id] ?? (account.commissionRate * 100).toString()}
                          onChange={(event) =>
                            setRateDrafts((previous) => ({
                              ...previous,
                              [account.id]: event.target.value,
                            }))
                          }
                          onBlur={() => saveAffiliateRate(account)}
                          aria-label={`Commission percent for ${account.name}`}
                        />
                        <span>
                          {summary.clicks} clicks · {summary.orders} orders
                        </span>
                        <StatusPill
                          status={account.status}
                          tone={account.status === "active" ? "good" : account.status === "paused" ? "warm" : "bad"}
                        />
                        <div className="table-actions">
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => copyAffiliate(account.code)}
                          >
                            <Copy size={13} /> Copy
                          </button>
                          <button
                            type="button"
                            className="text-link"
                            onClick={async () => {
                              const result = await updateAffiliate(account.id, {
                                status: account.status === "active" ? "paused" : "active",
                              });
                              if (!result.ok) toast(result.error, "error");
                              else toast(account.status === "active" ? "Link paused." : "Link active.", "success");
                            }}
                          >
                            {account.status === "active" ? "Pause" : "Activate"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={<Link2 size={34} />}
                  title="No links yet."
                  body="Create the first college or creator link above."
                />
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Earnings</h2>
                <span>Released only after the {db.settings.returnWindowDays}-day return window</span>
              </div>
              {affiliateCommissions.length ? (
                <div className="listing-table affiliate-table">
                  <div className="table-head">
                    <span>Partner</span>
                    <span>Order</span>
                    <span>Amount</span>
                    <span>Unlocks</span>
                    <span>Status</span>
                    <span>Actions</span>
                  </div>
                  {affiliateCommissions.map((entry) => {
                    const account = affiliateAccounts.find((item) => item.id === entry.affiliateId);
                    const order = db.orders.find((item) => item.id === entry.orderId);
                    const unlockable =
                      entry.eligibleAt && new Date(entry.eligibleAt).getTime() <= Date.now();
                    return (
                      <div key={entry.id} className="table-row">
                        <div className="table-product">
                          <div>
                            <strong>{account?.name ?? "Partner"}</strong>
                            <span>{(entry.rate * 100).toFixed(1)}% of {formatMoney(entry.subtotal)}</span>
                          </div>
                        </div>
                        <span>{order?.number ?? entry.orderId.slice(0, 8)}</span>
                        <strong>{formatMoney(entry.amount)}</strong>
                        <span>
                          {entry.eligibleAt ? formatDate(entry.eligibleAt) : "After delivery"}
                        </span>
                        <StatusPill
                          status={entry.status}
                          tone={
                            entry.status === "paid" || entry.status === "approved"
                              ? "good"
                              : entry.status === "void"
                                ? "bad"
                                : "warm"
                          }
                        />
                        <div className="table-actions">
                          {entry.status === "pending" && (
                            <button
                              type="button"
                              className="text-link"
                              disabled={!unlockable}
                              title={unlockable ? "Release this earning" : "Return window still open"}
                              onClick={async () => {
                                const result = await reviewAffiliateCommission(entry.id, "approve");
                                if (!result.ok) toast(result.error, "error");
                                else toast("Earning released.", "success");
                              }}
                            >
                              Release
                            </button>
                          )}
                          {entry.status === "approved" && (
                            <button
                              type="button"
                              className="text-link"
                              onClick={async () => {
                                const result = await reviewAffiliateCommission(entry.id, "pay");
                                if (!result.ok) toast(result.error, "error");
                                else toast("Marked paid.", "success");
                              }}
                            >
                              Mark paid
                            </button>
                          )}
                          {entry.status !== "void" && entry.status !== "paid" && (
                            <button
                              type="button"
                              className="text-link"
                              onClick={async () => {
                                const result = await reviewAffiliateCommission(entry.id, "void");
                                if (!result.ok) toast(result.error, "error");
                                else toast("Earning voided.", "success");
                              }}
                            >
                              Void
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={<Wallet size={34} />}
                  title="No earnings yet."
                  body="When a referred customer pays for an order, it shows up here as pending."
                />
              )}
            </section>
          </div>
        )}

        {tab === "settings" && (
          <div className="dashboard-section">
            <div className="panel-head">
              <h2>Platform settings</h2>
              <span>Applies to this browser demo</span>
            </div>
            <form
              className="panel settings-form"
              onSubmit={(event) => {
                event.preventDefault();
                updateSettings(settings);
                toast("Settings saved.", "success");
              }}
            >
              <div className="settings-grid">
                <Field label="Auction engine">
                  <label className="checkbox-line">
                    <input
                      type="checkbox"
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
                <Field label="Auction winner payment deadline (minutes)">
                  <input
                    type="number"
                    min={1}
                    value={settings.auctionPaymentDeadlineMinutes}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        auctionPaymentDeadlineMinutes: Number(event.target.value),
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
                <Field
                  label="Affiliate commission (%)"
                  hint="Default share for new creator and college links."
                >
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    value={settings.affiliateCommissionPct}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        affiliateCommissionPct: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field
                  label="Affiliate return window (days)"
                  hint="Earnings unlock this many days after delivery."
                >
                  <input
                    type="number"
                    min={0}
                    value={settings.returnWindowDays}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        returnWindowDays: Number(event.target.value),
                      }))
                    }
                  />
                </Field>
                <Field label="Seller commission (%)" hint="Fixed at 10% of the full sale price.">
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
                <div className="admin-setting-note">
                  <strong>Delivery coverage</strong>
                  <span>Pan-India. Checkout accepts valid six-digit Indian PIN codes.</span>
                </div>
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
          <Link href="/products" className="text-link">
            Back to marketplace
          </Link>
        </div>
      </div>
    </main>
  );
}
