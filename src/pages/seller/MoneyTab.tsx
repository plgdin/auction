import { useEffect, useState } from "react";
import { Banknote, CheckCircle2, Clock3, CreditCard, ShieldCheck, TrendingUp } from "lucide-react";
import { SettlementLedgerRow } from "../../components/seller/Parts";
import { Field } from "../../components/Ui";
import { formatMoney } from "../../lib/format";
import { netPayout } from "../../lib/sellerMath";
import { useStore } from "../../lib/store";
import { supabase } from "../../lib/supabase";
import { toast } from "../../lib/toast";

/**
 * Money — payouts over time. Honest figures from settlements only, shown net
 * of the flat ₹10 platform charge. Story: rider delivers → buyer confirms
 * arrival → credited within 5 business days.
 */
export function MoneyTab() {
  const { db, user } = useStore();
  const [methodType, setMethodType] = useState<"upi" | "bank_account">("upi");
  const [upiVpa, setUpiVpa] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [holderName, setHolderName] = useState("");
  const [savedMethod, setSavedMethod] = useState<{
    method_type: string;
    upi_vpa?: string;
    account_number?: string;
    ifsc_code?: string;
    account_holder_name?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function loadMethod() {
      const { data } = await supabase
        .from("seller_payout_methods")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setSavedMethod(data);
        setMethodType(data.method_type === "bank_account" ? "bank_account" : "upi");
        if (data.upi_vpa) setUpiVpa(data.upi_vpa);
        if (data.account_number) setAccountNumber(data.account_number);
        if (data.ifsc_code) setIfscCode(data.ifsc_code);
        if (data.account_holder_name) setHolderName(data.account_holder_name);
      }
    }
    loadMethod();
  }, [user]);

  if (!user) return null;

  const savePayoutMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        method_type: methodType,
        account_holder_name: holderName.trim() || user.name,
        is_default: true,
        verification_status: "verified",
      };
      if (methodType === "upi") {
        if (!upiVpa.includes("@")) {
          toast("Please enter a valid UPI VPA (e.g. name@okhdfcbank)", "error");
          setSaving(false);
          return;
        }
        payload.upi_vpa = upiVpa.trim();
        payload.account_number = null;
        payload.ifsc_code = null;
      } else {
        if (!accountNumber.trim() || !ifscCode.trim()) {
          toast("Please enter both account number and IFSC code.", "error");
          setSaving(false);
          return;
        }
        payload.upi_vpa = null;
        payload.account_number = accountNumber.trim();
        payload.ifsc_code = ifscCode.trim().toUpperCase();
      }

      const { error } = await supabase.from("seller_payout_methods").upsert(payload);
      if (error) {
        toast(error.message, "error");
      } else {
        toast("Payout details saved securely.", "success");
        setSavedMethod({
          method_type: methodType,
          upi_vpa: methodType === "upi" ? upiVpa : undefined,
          account_number: methodType === "bank_account" ? accountNumber : undefined,
          ifsc_code: methodType === "bank_account" ? ifscCode : undefined,
          account_holder_name: holderName || user.name,
        });
      }
    } catch (err: unknown) {
      toast(String(err), "error");
    } finally {
      setSaving(false);
    }
  };

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

      {/* Escrow Release Status Alert */}
      <div
        style={{
          margin: "24px 0",
          padding: "16px 20px",
          background: "rgba(46, 125, 50, 0.06)",
          border: "1px dashed rgba(46, 125, 50, 0.4)",
          borderRadius: "8px",
          display: "flex",
          alignItems: "flex-start",
          gap: "14px",
        }}
      >
        <ShieldCheck size={22} style={{ color: "#2e7d32", flexShrink: 0, marginTop: "2px" }} />
        <div>
          <div style={{ fontWeight: 600, color: "#1e3a1e", fontSize: "14px" }}>
            Escrow Protection: Funds locked until buyer inspects or 48h passes
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#3a4a3a", lineHeight: 1.5 }}>
            To protect both parties, order payments are held securely in escrow. When an order is delivered, the buyer has 48 hours to confirm or report an issue. Once the buyer clicks <strong>Accept Item</strong> or the 48-hour inspection clock expires without dispute, funds are immediately credited and queued for payout.
          </p>
        </div>
      </div>

      {/* Payout Methods Configuration */}
      <section className="panel" style={{ marginBottom: "24px" }}>
        <div className="panel-head">
          <div>
            <h2>Payout destination</h2>
            <span>Bank Account or UPI VPA where your earnings are credited</span>
          </div>
          {savedMethod && (
            <span className="status-pill status-good" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={13} />
              {savedMethod.method_type === "upi"
                ? `UPI: ${savedMethod.upi_vpa}`
                : `A/C: ••••${savedMethod.account_number?.slice(-4) ?? ""}`}
            </span>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <button
              type="button"
              className={`button ${methodType === "upi" ? "button-olive" : "button-ghost"}`}
              style={{ padding: "8px 16px", fontSize: "13px" }}
              onClick={() => setMethodType("upi")}
            >
              UPI VPA (Instant)
            </button>
            <button
              type="button"
              className={`button ${methodType === "bank_account" ? "button-olive" : "button-ghost"}`}
              style={{ padding: "8px 16px", fontSize: "13px" }}
              onClick={() => setMethodType("bank_account")}
            >
              <CreditCard size={14} style={{ marginRight: 6, display: "inline" }} />
              Bank Account (NEFT/IMPS)
            </button>
          </div>

          <form onSubmit={savePayoutMethod} style={{ maxWidth: 480 }}>
            {methodType === "upi" ? (
              <Field label="UPI ID / VPA" hint="e.g. mobile@upi or yourname@okhdfcbank">
                <input
                  type="text"
                  placeholder="name@okhdfcbank"
                  value={upiVpa}
                  onChange={(e) => setUpiVpa(e.target.value)}
                  required
                />
              </Field>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Field label="Account Holder Name" hint="As shown in your bank passbook">
                  <input
                    type="text"
                    placeholder="Full Legal Name"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Bank Account Number">
                  <input
                    type="text"
                    placeholder="e.g. 918237461928"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                  />
                </Field>
                <Field label="IFSC Code" hint="11-character code (e.g. HDFC0001234)">
                  <input
                    type="text"
                    placeholder="HDFC0001234"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    maxLength={11}
                    required
                  />
                </Field>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <button
                type="submit"
                className="button button-olive"
                disabled={saving}
                style={{ minWidth: 160 }}
              >
                {saving ? "Saving..." : "Save Payout Method"}
              </button>
            </div>
          </form>
        </div>
      </section>

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
