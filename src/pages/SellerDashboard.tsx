import { useEffect, useState } from "react";
import { BadgeCheck, Plus } from "lucide-react";
import { Link } from "../components/Link";
import { Tabs } from "../components/Ui";
import { formatMoney } from "../lib/format";
import { useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { TodayTab } from "./seller/TodayTab";
import { InventoryTab } from "./seller/InventoryTab";
import { OffersTab } from "./seller/OffersTab";
import { OrdersTab } from "./seller/OrdersTab";
import { MoneyTab } from "./seller/MoneyTab";

const TAB_IDS = ["today", "inventory", "offers", "orders", "money"] as const;
type SellerTabId = (typeof TAB_IDS)[number];

/** Legacy tab names map to the new five without breaking old links. */
function normalizeTab(raw: string | null): SellerTabId {
  if (TAB_IDS.includes(raw as SellerTabId)) return raw as SellerTabId;
  if (raw === "auctions") return "inventory";
  if (raw === "overview") return "today";
  if (raw === "earnings") return "money";
  if (raw === "listings") return "inventory";
  return "today";
}

export function SellerDashboardPage() {
  const { db, user } = useStore();
  const route = useRoute();
  const [tab, setTab] = useState<SellerTabId>(() => normalizeTab(route.query.get("tab")));

  useEffect(() => {
    setTab(normalizeTab(route.query.get("tab")));
  }, [route.query]);

  if (!user) {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <h2>Sign in to your dashboard.</h2>
          <Link href="#/login" className="button button-olive">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (!user.isSeller && user.role !== "admin") {
    return (
      <main className="page-shell">
        <div className="section-wrap empty-state page-empty">
          <h2>
            You are not <em>selling</em> yet.
          </h2>
          <p>Your first listing opens the shop — two minutes, one photo, no fees.</p>
          <div className="modal-actions center">
            <Link href="#/sell" className="button button-olive">
              Start selling
            </Link>
            <Link href="#/account?tab=profile" className="button button-ghost">
              My profile
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const myProducts = db.products.filter((product) => product.sellerId === user.id);
  const liveCount = db.auctions.filter((auction) => auction.sellerId === user.id && auction.status === "live").length;
  const mySettlements = db.settlements.filter((settlement) => settlement.sellerId === user.id);
  const lifetime = mySettlements.reduce(
    (total, settlement) => (settlement.status === "paid" ? total + settlement.sellerPayout : total),
    0,
  );

  const goToTab = (next: string) => {
    setTab(normalizeTab(next));
    window.location.hash = `#/seller?tab=${normalizeTab(next)}`;
  };

  return (
    <main className="page-shell dashboard-page">
      <div className="section-wrap">
        <header className="page-header seller-head">
          <div>
            <h1>
              Your <em>dashboard.</em>
            </h1>
            <p>
              {user.name} · {myProducts.filter((product) => product.status === "active").length} pieces on the rail
              {liveCount > 0 && ` · ${liveCount} live in the hall`} · {formatMoney(lifetime)} sold so far
            </p>
          </div>
          <Link href="#/sell" className="button button-olive">
            <Plus size={15} /> New listing
          </Link>
        </header>

        <Tabs
          tabs={[
            { id: "today", label: "Today" },
            { id: "inventory", label: "Inventory", count: myProducts.length },
            { id: "offers", label: "Offers" },
            { id: "orders", label: "Orders" },
            { id: "money", label: "Money" },
          ]}
          active={tab}
          onChange={goToTab}
        />

        {tab === "today" && <TodayTab onGoToTab={goToTab} />}
        {tab === "inventory" && <InventoryTab />}
        {tab === "offers" && <OffersTab />}
        {tab === "orders" && <OrdersTab />}
        {tab === "money" && <MoneyTab />}

        <div className="dashboard-footnote">
          <BadgeCheck size={15} />
          Demo dashboard. No real payouts or rider bookings — delivery states and money figures update locally.
          <button type="button" className="text-link" onClick={() => (window.location.hash = "#/products")}>
            Back to the market
          </button>
        </div>
      </div>
    </main>
  );
}
