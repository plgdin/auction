import { useEffect, type ReactNode } from "react";
import { BookOpen, ChevronRight, FileText, Mail } from "lucide-react";
import { Link } from "../components/Link";
import { useRoute } from "../lib/router";

type PolicyKey = "terms" | "privacy" | "returns" | "auction-terms";

const policyDetails: Record<PolicyKey, { title: string; intro: string; sections: { id: string; title: string; body: ReactNode }[] }> = {
  terms: {
    title: "Terms of Service",
    intro: "These terms govern your use of Lelam.co to buy, sell, and participate in marketplace auctions.",
    sections: [
      { id: "scope", title: "1. About Lelam and these terms", body: <><p>Lelam.co connects buyers and independent sellers and provides marketplace tools, checkout, account features, support channels, and auction features. Lelam does not manufacture goods listed by independent sellers. For third-party auction listings or services, the third party’s own terms apply.</p><p>By creating an account, placing an order or bid, or listing an item, you agree to the terms that apply to that activity. You must be legally able to make the transaction. A business account user confirms authority to act for that business.</p></> },
      { id: "roles", title: "2. Marketplace roles", body: <><p>Sellers control their listings and are responsible for accurate descriptions, photographs, condition disclosures, authenticity, lawful sale, correct item selection, packaging, dispatch within the promised time, and accurate tracking information. Sellers must comply with applicable Indian laws and respond to product-related complaints.</p><p>Lelam provides the online marketplace, facilitates checkout through its configured payment provider, coordinates seller settlement through that provider, shares transaction information needed to fulfil an order, and provides support and dispute-handling channels. Lelam may review suspicious activity, investigate complaints, and restrict accounts for policy or legal reasons. These terms do not remove any legal duty that applies to Lelam, a seller, or a payment provider.</p></> },
      { id: "buyer", title: "3. Buyer responsibilities", body: <ul><li>Provide accurate contact, billing, and delivery details.</li><li>Review listing details, photos, condition notes, shipping charges, and the total before ordering.</li><li>Pay using an authorised payment method and raise eligible issues promptly through the available support channel.</li><li>Use auctions honestly, follow the displayed bid increments, and pay for a winning bid within the stated deadline.</li><li>Do not abuse cancellation, return, refund, dispute, or account systems.</li></ul> },
      { id: "listings", title: "4. Listings, prices, and fees", body: <><p>Sellers must ensure that their listings are accurate, genuine, lawful, and available. Lelam may correct, pause, or remove a listing where appropriate. The amount displayed at checkout controls the buyer’s payable total.</p><p>A buyer platform fee of ₹10 applies per order, plus GST at the applicable rate. Seller commission is 10% of the applicable sale or winning amount (5% for verified sellers), inclusive of GST; GST is not added again on top of that commission. Applicable taxes, shipping, and fees must be shown before the buyer confirms payment.</p><p>Lelam’s GSTIN: <strong>32AABCY7420J1ZD</strong>.</p></> },
      { id: "payment", title: "5. Payments and seller settlement", body: <><p>Payments are processed through Razorpay or another payment method Lelam makes available. Payment credentials are handled by the payment provider; Lelam does not claim to store card or UPI credentials. Lelam coordinates seller settlement through its payment-provider arrangement and does not represent itself as an independent escrow provider.</p><p>For eligible regular marketplace orders, buyers may submit an eligible return or dispute request within 3 days after the delivery provider confirms delivery. If no eligible request is raised in that period, Lelam initiates seller settlement, subject to a lawful hold or an open dispute. Seller settlement is not automatically due merely because an item was dispatched.</p><p>The seller settlement timing is tied to the delivery-confirmed 3-day request period. Delivery can take longer than 7 days; no separate 10-day maximum applies. Payment-provider settlement rules and legal requirements may affect processing.</p></> },
      { id: "seller", title: "6. Seller settlements and commission", body: <><p>The standard seller commission is 10% of the sale amount (5% for verified sellers), inclusive of GST. For example, on a ₹1,000 sale amount, the total commission deduction is ₹100 (₹50 for verified sellers), not added on top of GST. Applicable invoice and tax details are shown or supplied through the seller’s transaction records.</p><p>Settlement begins after the eligible return-request window closes, unless a valid dispute, payment issue, legal hold, or payment-provider restriction requires review.</p></> },
      { id: "accounts", title: "7. Accounts, safety, and restrictions", body: <><p>Keep your credentials private and your account details accurate. Lelam may investigate suspected fraud, collusion, manipulation, unlawful listings, or repeated policy violations. Lelam may temporarily restrict or suspend access where proportionate and may provide a review route through support.</p><p>For auction participation, use an email address you control and complete the platform’s email verification process when required. One person may not create multiple accounts to bypass platform rules.</p></> },
      { id: "returns", title: "8. Returns and auctions", body: <p>Regular marketplace returns and cancellations are governed by the <Link href="/returns">Return, Refund &amp; Cancellation Policy</Link>. Auction bids and auction purchase rules are in the <Link href="/auction-terms">Auction Terms</Link>. Nothing in those policies removes a remedy that applicable law requires.</p> },
      { id: "availability", title: "9. Service availability and third parties", body: <p>Courier services, payment providers, network operators, and hosting providers may affect transactions. Lelam will share relevant status information and take reasonable steps to address platform issues, but a service interruption, courier delay, gateway failure, or event outside reasonable control may delay a transaction. This does not remove any statutory rights.</p> },
      { id: "liability", title: "10. Complaints and legal rights", body: <><p>Sellers remain responsible for the goods and their fulfilment obligations. Lelam helps users communicate and review marketplace complaints but does not become the manufacturer or seller of a third-party item merely by listing it.</p><p>Nothing in these terms excludes or limits liability, consumer remedies, or other rights that cannot lawfully be excluded or limited. Any permitted limitation applies only to the extent allowed by applicable law.</p><p>These terms are governed by Indian law. Courts with competent jurisdiction in Kerala, including Thiruvananthapuram, are the intended venue, subject to applicable law.</p></> },
      { id: "contact", title: "11. Contact and updates", body: <><p>Business address: No. 2, 20th Cross, Lakshimpuram, Halasuru, Bengaluru 560008, Karnataka, India. GSTIN: 32AABCY7420J1ZD.</p><p>Contact: <a href="mailto:support@lelam.co">support@lelam.co</a> · +91 94477 53889.</p><p>Last updated: 18 November 2026. These terms take effect when published. Lelam may update them and will provide notice where required.</p></> },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro: "This policy explains how Lelam.co handles personal information when you browse, buy, sell, or use auctions.",
    sections: [
      { id: "controller", title: "1. Who handles your information", body: <p>Lelam.co operates the marketplace. The business is registered in India under GSTIN 32AABCY7420J1ZD. Independent sellers separately handle information they receive to fulfil an order and meet their legal duties.</p> },
      { id: "data", title: "2. Information we collect", body: <ul><li>Account details such as name, email, phone, password or authentication tokens.</li><li>Billing and delivery addresses, saved addresses, orders, payments, refunds, and seller settlement records.</li><li>Listings, offers, bids, auction participation, watchlists, and account activity.</li><li>Support messages, complaints, and communications with Lelam or sellers.</li><li>Device, browser, IP, security-log, cookie, and usage information needed to operate and protect the service.</li><li>Payment references and status from the payment provider. Lelam does not claim to store card numbers or UPI credentials.</li></ul> },
      { id: "use", title: "3. How we use information", body: <p>We use information to create and secure accounts; show listings; process orders, payments, settlements, auctions, delivery, and refunds; prevent fraud; provide support and dispute handling; improve the marketplace; send essential service notices; and meet legal obligations. Marketing messages are sent only where permitted, and you can opt out where applicable.</p> },
      { id: "sharing", title: "4. When information is shared", body: <p>We share only information needed with sellers for order fulfilment, delivery partners for shipping, Razorpay or other payment providers for payment processing, and authentication, hosting, communications, and support providers that help run the service. We may also share information with professional advisers or authorities when legally required. Payment providers process payment credentials under their own terms.</p> },
      { id: "cookies", title: "5. Cookies and similar tools", body: <p>Essential cookies and browser storage support sign-in, session security, saved preferences, and core site functions. Analytics or marketing tools, if used, are described in the site’s consent controls and may be managed through browser settings. Blocking essential storage can affect sign-in or checkout.</p> },
      { id: "security", title: "6. Security and retention", body: <p>We use reasonable technical and organisational safeguards, access controls, and security monitoring. No internet service can guarantee absolute security. We retain information for as long as needed for accounts, transactions, support, security, and legal or accounting duties, then delete or de-identify it where appropriate. Some records may need to remain after account closure.</p> },
      { id: "rights", title: "7. Your choices and requests", body: <p>You may request access, correction, deletion where applicable, or withdrawal of consent where processing relies on consent. We handle requests under the Indian data-protection rules in force at the time, including applicable phased commencement of the Digital Personal Data Protection Act, 2023 and DPDP Rules, 2025. Contact <a href="mailto:support@lelam.co">support@lelam.co</a> for privacy requests.</p> },
      { id: "changes", title: "8. Updates and contact", body: <p>We may update this policy as the service and applicable law change. Last updated: 18 November 2026. For privacy questions, contact support@lelam.co. Business address: No. 2, 20th Cross, Lakshimpuram, Halasuru, Bengaluru 560008, Karnataka, India.</p> },
    ],
  },
  returns: {
    title: "Return, Refund & Cancellation Policy",
    intro: "Clear rules for regular marketplace orders, auction purchases, cancellations, and refunds.",
    sections: [
      { id: "regular", title: "1. Regular marketplace returns", body: <><p>For an eligible regular marketplace order, submit a return or dispute request through your account or the available support channel within 3 days after the delivery provider confirms delivery.</p><p>Requests may be considered for damaged, defective, incorrect, counterfeit, materially misdescribed, or otherwise non-compliant products. Share order details and reasonable evidence, such as clear photos, to help review the request. Once the ordinary 3-day window closes without an eligible request, ordinary change-of-mind returns are not accepted, subject always to remedies required by law.</p></> },
      { id: "settlement", title: "2. Seller settlement after delivery", body: <p>If no eligible request is raised during the 3-day period, Lelam initiates seller settlement through Razorpay or the applicable payment-provider arrangement. The period runs from confirmed delivery and can exceed 10 days after purchase when shipping takes longer; no separate 10-day cap applies. A valid dispute or legal hold can pause settlement.</p> },
      { id: "auction", title: "3. Auction purchases", body: <p>Auction purchases are final. Ordinary cancellations, returns, and change-of-mind refunds are not accepted. Review the listing, photos, and condition information before bidding. This rule does not remove mandatory remedies for defective, damaged, counterfeit, materially misdescribed, or legally non-compliant goods.</p> },
      { id: "cancel", title: "4. Cancellations", body: <p>For regular orders, request cancellation before the seller dispatches the item. After dispatch, the request is handled under the return rules and applicable law. A seller or Lelam may cancel an order when an item is unavailable, a transaction cannot be safely completed, payment fails or is duplicated, or another valid operational or legal reason applies. Auction winning bids follow the <Link href="/auction-terms">Auction Terms</Link>.</p> },
      { id: "refunds", title: "5. Refund processing", body: <p>Approved refunds are returned to the original payment method where possible. Lelam processes an approved refund within 10 working days. The bank, card issuer, UPI provider, or payment gateway may need additional time to show the credit. Refund initiation and final account credit are separate events; status information is available through support.</p> },
      { id: "contact", title: "6. How to ask for help", body: <p>Contact <a href="mailto:support@lelam.co">support@lelam.co</a> or +91 94477 53889 with your order number, issue, and supporting evidence. We may review the information with the seller and payment or delivery partner.</p> },
    ],
  },
  "auction-terms": {
    title: "Auction Terms & Conditions",
    intro: "Rules for participating in Lelam auctions, Bid Passes, closing extensions, and winning purchases.",
    sections: [
      { id: "eligibility", title: "1. Who can bid", body: <p>You must be signed in and have a verified email address to bid. One person may use one account and one verified email address. Keep your account secure and do not use false or duplicate accounts.</p> },
      { id: "passes", title: "2. Bid Passes", body: <p>A Bid Pass costs ₹49 and permits participation in the relevant auction, subject to platform rules. If you win, the applicable ₹49 pass amount is credited against the final auction purchase price. A pass not converted into a winning purchase may be carried forward for a future auction or submitted for a refund. Lelam processes approved refunds within 10 working days; payment-provider or bank credit time can vary. Pass purchases, credits, and refunds appear in account transaction history.</p> },
      { id: "bidding", title: "3. Bidding rules", body: <p>Each auction has a start and closing time, minimum bid, and displayed increment. Bids are binding. Do not place artificial, collusive, or fraudulent bids or interfere with auction systems. Lelam may investigate suspicious bidding and restrict accounts where appropriate.</p> },
      { id: "extensions", title: "4. Closing-time extensions", body: <p>A qualifying bid in the final 30 seconds extends the closing time by 30 seconds. Further qualifying bids can trigger further extensions. The auction closes when the countdown expires without another qualifying bid. The displayed countdown follows the auction state.</p> },
      { id: "winner", title: "5. Winning and payment", body: <p>A winning bid creates a purchase obligation. When you win, Lelam presents a pay-now prompt. Complete payment within 5 minutes. You can also see won auctions and any unpaid amount in your account. If payment is not completed on time, the winning transaction may be cancelled and auction access may be restricted after review.</p> },
      { id: "missed-payment", title: "6. Missed payment review", body: <p>If payment is missed, contact support promptly and explain the issue. Lelam may review payment failures, send a reminder, cancel the unpaid win, or apply proportionate restrictions for repeated or abusive failures. No penalty applies merely because an auction receives no bids or remains unsold. You may request review by contacting support@lelam.co.</p> },
      { id: "final", title: "7. Finality and legal rights", body: <p>Auction purchases do not allow ordinary change-of-mind returns or cancellations. Mandatory legal remedies for defective, damaged, counterfeit, materially misdescribed, or otherwise non-compliant goods remain available. Read the <Link href="/returns">Return, Refund &amp; Cancellation Policy</Link> and <Link href="/terms">Terms of Service</Link>.</p> },
    ],
  },
};

export function PoliciesPage() {
  const route = useRoute();
  const key = (route.path.slice(1) || "terms") as PolicyKey;
  const policy = policyDetails[key] || policyDetails.terms;

  useEffect(() => {
    document.title = `${policy.title} | Lelam.co`;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [policy.title]);

  const scrollToSection = (id: string) => {
    document.getElementById(`policy-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="page-shell legal-page">
      <div className="section-wrap">
        <div className="legal-hero">
          <span className="eyebrow"><FileText size={14} /> LELAM.CO POLICIES</span>
          <h1>{policy.title}</h1>
          <p>{policy.intro}</p>
          <span className="legal-updated">Last updated 18 November 2026 · Effective on publication</span>
        </div>
        <div className="legal-layout">
          <aside className="legal-toc">
            <h2><BookOpen size={15} /> Contents</h2>
            {policy.sections.map((section) => (
              <button key={section.id} type="button" onClick={() => scrollToSection(section.id)}>{section.title}</button>
            ))}
            <a href="mailto:support@lelam.co"><Mail size={14} /> Contact support</a>
          </aside>
          <article className="legal-article">
            {policy.sections.map((section) => (
              <section id={`policy-${section.id}`} key={section.id}>
                <h2>{section.title}</h2>
                <div className="legal-copy">{section.body}</div>
              </section>
            ))}
            <nav className="legal-related" aria-label="Related policies">
              <strong>Related policies</strong>
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/returns">Returns &amp; Refunds</Link>
              <Link href="/auction-terms">Auction Terms</Link>
            </nav>
          </article>
        </div>
        <div className="legal-breadcrumb"><Link href="/">Home</Link><ChevronRight size={14} /><span>{policy.title}</span></div>
      </div>
    </main>
  );
}
