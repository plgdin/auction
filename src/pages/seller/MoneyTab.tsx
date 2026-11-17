import { Banknote, Clock3 } from "lucide-react";
import { SettlementLedgerRow } from "../../components/seller/Parts";
import { formatMoney } from "../../lib/format";
import { netPayout, sellerCommissionPercent } from "../../lib/sellerMath";
import { useStore } from "../../lib/store";

/**
 * Money — payouts over time. Honest figures from settlements only, shown net
 * of the seller commission. Seller settlement begins after the 3-day
 * post-delivery request window closes.
 */
export function MoneyTab() {
  const { db, user } = useStore();
  if (!user) return null;

  const commPct = sellerCommissionPercent(user.sellerTier);

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

  return (
    <div className="dashboard-section">
      <div className="money-cards">
        <div className="stat-card is-dark">
          <span>
            <Banknote size={16} /> In your pocket
          </span>
          <strong>{formatMoney(lifetime)}</strong>
            <em>settled and credited, after {commPct}% commission inclusive of GST</em>
        </div>
        <div className="stat-card">
          <span>
            <Clock3 size={16} /> On its way
          </span>
          <strong>{formatMoney(pending)}</strong>
            <em>settlement starts after the 3-day post-delivery request window</em>
        </div>
      </div>

      <section className="panel money-explain">
        <div className="panel-head">
          <h2>How a sale turns into money</h2>
          <span>three steps, no chasing</span>
        </div>
        <ol className="money-steps">
          <li>
            <span>1.</span> The seller dispatches the item and the delivery partner confirms delivery.
          </li>
          <li>
            <span>2.</span> The buyer has 3 days from confirmed delivery to raise an eligible request.
          </li>
          <li>
            <span>3.</span> If no eligible request is raised, settlement is initiated through the payment-provider arrangement after {commPct}% commission, inclusive of GST.
          </li>
        </ol>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Payout ledger</h2>
          <span>{mySettlements.length} entries</span>
        </div>
        {mySettlements.length ? (
          <>
            <div className="ledger ledger-head">
              <div><strong>Paid from</strong></div>
              <div>Sale value</div>
              <div>You receive</div>
              <div>Status</div>
            </div>
            {mySettlements.map((settlement) => (
              <SettlementLedgerRow
                key={settlement.id}
                source={settlement.source}
                orderId={settlement.orderId}
                asking={settlement.askingPrice}
                payout={netPayout(settlement.sellerPayout)}
                status={settlement.status}
                createdAt={settlement.createdAt}
              />
            ))}
          </>
        ) : (
          <p className="panel-empty">No payouts yet. Settlement begins after delivery and the 3-day request window.</p>
        )}
        {mySettlements.length > 0 && (
          <p className="fineprint">
            {commPct}% seller commission, inclusive of GST, is deducted from the sale price in each row, including auction wins.
          </p>
        )}
      </section>
    </div>
  );
}
