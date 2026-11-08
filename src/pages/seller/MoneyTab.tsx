import { Banknote, Clock3, TrendingUp } from "lucide-react";
import { SettlementLedgerRow } from "../../components/seller/Parts";
import { formatMoney } from "../../lib/format";
import { netPayout } from "../../lib/sellerMath";
import { useStore } from "../../lib/store";

/**
 * Money — payouts over time. Honest figures from settlements only, shown net
 * of the flat ₹10 platform charge. Story: rider delivers → buyer confirms
 * arrival → credited within 5 business days.
 */
export function MoneyTab() {
  const { db, user } = useStore();
  if (!user) return null;

  const mySettlements = db.settlements
    .filter((settlement) => settlement.sellerId === user.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const lifetime = mySettlements.reduce(
    (total, settlement) => (settlement.status === "paid" ? total + netPayout(settlement.sellerPayout) : total),
    0,
  );
  const pending = mySettlements
    .filter((settlement) => settlement.status !== "paid")
    .reduce((total, settlement) => total + netPayout(settlement.sellerPayout), 0);
  const subsidy = mySettlements.reduce((total, settlement) => total + settlement.platformSubsidy, 0);

  return (
    <div className="dashboard-section">
      <div className="money-cards">
        <div className="stat-card is-dark">
          <span>
            <Banknote size={16} /> In your pocket
          </span>
          <strong>{formatMoney(lifetime)}</strong>
          <em>settled and credited, minus the ₹10 charge</em>
        </div>
        <div className="stat-card">
          <span>
            <Clock3 size={16} /> On its way
          </span>
          <strong>{formatMoney(pending)}</strong>
          <em>credited ≤5 business days after buyer approval</em>
        </div>
        <div className="stat-card">
          <span>
            <TrendingUp size={16} /> Platform covered
          </span>
          <strong>{formatMoney(subsidy)}</strong>
          <em>bids below your base — lelam paid the gap</em>
        </div>
      </div>

      <section className="panel money-explain">
        <div className="panel-head">
          <h2>How a sale turns into money</h2>
          <span>three steps, no chasing</span>
        </div>
        <ol className="money-steps">
          <li>
            <span>1.</span> The rider collects the parcel at your door and delivers it to the buyer.
          </li>
          <li>
            <span>2.</span> The buyer confirms arrival — you never chase anyone.
          </li>
          <li>
            <span>3.</span> Your payout is credited within 5 business days, minus the flat ₹10 platform charge.
          </li>
        </ol>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Payout ledger</h2>
          <span>{mySettlements.length} entries</span>
        </div>
        {mySettlements.length ? (
          <div className="ledger ledger-head">
            <div><strong>Paid from</strong></div>
            <div>Sale value</div>
            <div>You receive</div>
            <div>Status</div>
          </div>
        ) : (
          <p className="panel-empty">No payouts yet. They appear the moment an order is delivered and approved.</p>
        )}
        {mySettlements.map((settlement) => (
          <SettlementLedgerRow
            key={settlement.id}
            source={settlement.source}
            orderId={settlement.orderId}
            asking={settlement.askingPrice}
            payout={netPayout(settlement.sellerPayout)}
            subsidy={settlement.platformSubsidy}
            status={settlement.status}
            createdAt={settlement.createdAt}
          />
        ))}
        {mySettlements.length > 0 && (
          <p className="fineprint">
            A flat ₹10 platform charge per product, already deducted in each row. A live auction lot
            never sells under your base price — lelam covers any gap; once bidding clears 30% over
            base, lelam keeps 10% of the amount above base.
          </p>
        )}
      </section>
    </div>
  );
}
