import { OfferDecision } from "../../components/seller/Parts";
import { StatusPill } from "../../components/Ui";
import { formatMoney, timeAgo } from "../../lib/format";
import { useStore } from "../../lib/store";
import { toast } from "../../lib/toast";

/**
 * Offers — private, buyer-initiated price messages. Pending ones are decisions
 * with a clock; settled ones sink into a quiet ledger.
 */
export function OffersTab() {
  const { db, user, respondToOffer } = useStore();
  if (!user) return null;

  const myOffers = [...db.offers.filter((offer) => offer.sellerId === user.id)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const pending = myOffers.filter((offer) => offer.status === "pending");
  const settled = myOffers.filter((offer) => offer.status !== "pending");

  if (!myOffers.length) {
    return (
      <div className="panel offers-empty">
        <p className="panel-empty">
          No offers yet. They arrive here the moment a buyer sends one — private, 48 hours on the clock. Nobody
          negotiates in public.
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-section">
      <section className="offer-stream">
        {pending.map((offer) => (
          <OfferDecision
            key={offer.id}
            offer={offer}
            product={db.products.find((item) => item.id === offer.productId)}
            buyer={db.users.find((item) => item.id === offer.buyerId)}
            onAccept={() => {
              const result = respondToOffer(offer.id, true);
              if (result.ok) toast("Offer accepted. The buyer can pay now.", "success");
              else toast(result.error, "error");
            }}
            onDecline={() => {
              const result = respondToOffer(offer.id, false);
              if (result.ok) toast("Offer declined.");
              else toast(result.error, "error");
            }}
          />
        ))}
      </section>

      {settled.length > 0 && (
        <section className="panel offers-ledger">
          <div className="panel-head">
            <h2>Past offers</h2>
            <span>{settled.length} settled</span>
          </div>
          <ul className="ledger settled-offer-list">
            {settled.map((offer) => (
              <li key={offer.id} className="settled-offer-row">
                <div>
                  <strong>{db.products.find((item) => item.id === offer.productId)?.title ?? "Listing"}</strong>
                  <span>
                    Offer {formatMoney(offer.amount)} ·{" "}
                    {offer.respondedAt ? timeAgo(offer.respondedAt) : timeAgo(offer.createdAt)}
                  </span>
                </div>
                <StatusPill status={offer.status} />
              </li>
            ))}
          </ul>
          <p className="fineprint">Private, buyer-only prices. Accepted offers convert to paid orders.</p>
        </section>
      )}
    </div>
  );
}
