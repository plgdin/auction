---
version: 1
slug: "src-pages-sell-tsx"
primary_target: "src/pages/Sell.tsx"
related_targets: ["src/pages/SellerDashboard.tsx"]
---

# Surface brief — Sell page + Seller dashboard (redesign)

Scope: `src/pages/Sell.tsx` (`#/sell`), `src/pages/SellForm.tsx` (`#/sell/new`), and
`src/pages/SellerDashboard.tsx` (`#/seller`). Modes: Sell = Persuade; form = Operate; dashboard = Operate.

## Direction contract

THESIS: The sell page converts hesitation into a started listing — the promise (we take it from
here) is demonstrated with live, computed proof, never claimed. It refuses the category-default
"empty form first". The dashboard is a ledger of one question per screen: what needs me.

OWN-WORLD: The committed lelam cream/ink/olive system, hairline editorial grids, serif display
with olive italics, Caveat margin notes. No new components vocabulary; existing tokens only.

STORY: Sell page — Buy now stays simple; any item may be picked randomly for a 30-minute live
auction. It starts at 50% of base; the seller is protected at base; if bids clear 130% of base,
lelam takes 10% of the amount above base. A flat ₹10 platform charge applies per product sold.
Rider picks up at the seller's door. Payout within 5 business days of buyer approval. The form is
a separate CTA destination at `#/sell/new`.
Dashboard — one glance answers: what needs me, what's for sale, what's coming in.

FIRST VIEWPORT: Hero headline "Your closet is a shop. You just haven't opened it." left,
fanned real product cards right, primary CTA "Start selling", proof chips beneath, note about a
possible live feature, ticker cutting the fold edge. At 1920×1080 everything above fits; ticker peeks.

FORM: seed: none — established-world extension; structure and copy approved by the user in
conversation (plan confirmed 3 rounds). No concept roll applicable.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Constraints locked by the user
- Signed-out visitors see the full marketing; CTA -> sign-up -> `#/sell/new`; form is never on
  the marketing page. Signed-in sellers go straight to `#/sell/new`.
- New dashboard IA: Today (default), Inventory, Offers, Orders, Money. Auctions dissolve into
  Today rail + Inventory action. Buyer approves after delivery; payout ≤5 business days.
- Readability at 1920×1080; generous space; minimalism; larger controls and type floor 12px;
  content cap 1240px.
- Fun budget: one authored delight per section, all real-data-driven, all killed by
  `prefers-reduced-motion`.
