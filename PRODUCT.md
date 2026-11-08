# lelam — product truth

## What it is
lelam (lelam.co) is a curated secondhand marketplace for Trivandrum, Kerala. Every piece is one
seller's own item — one owner at a time. A demo front-end: localStorage-backed store, seeded data,
no real payments, no real riders.

## Audience and scene
Sellers are locals with underused closet pieces — someone trying to clear a shelf without doing
another MeetUp. Buyers browse the rail for one-of-one finds. Most sessions happen on phones,
but equal-parity design applies to seller surfaces.

## Mechanics (must stay true in all copy)
- Sellers set an **asking price**. No fee to list.
- Buyers **Buy now** at the asking price exactly like any familiar shop — one tap, a rider picks the
  parcel up from the seller's door and goes. Buyers can also **cart** items or send a **private
  offer** (48-hour expiry; nobody negotiates in public; seller accepts or declines).
- **The twist:** any product can be picked at random and pulled into a short live auction (about 30
  minutes), starting at **50% of its base price**. Buy now remains available at the asking price.
  Picked items can sell faster. The base is protected: lelam covers bids below it; at or below
  130% of base, no auction commission applies; above 130%, lelam takes **10% of the amount above
  base**. The flat product charge still applies.
- **Money:** a flat **₹10 platform charge per product sold** (seller side), disclosed in copy.
- **Delivery is handled by the platform.** A delivery rider collects from the seller's door and
  goes. Service area is Trivandrum pincodes starting **695**. Sellers never meet buyers.
- **Payout story:** after delivery the buyer confirms arrival, then the seller's payout is credited
  **within 5 business days**. No admin approval step in the seller story.
- New listings may wait for admin review — controlled by `sellerAutoApprove` (currently true);
  copy must respect the setting at render time.

## Surfaces
- `#/sell` is a **marketing landing only** — hero CTA, proof, benefits, the twist, how-it-works
  with a payout preview, voices. The listing form is **not** on this page: CTAs lead signed-out
  visitors to sign-up, and signed-in sellers to `#/sell/new`, the listing form route (also serves
  `?edit=`). The form route shows a sign-in card when signed out.
- `#/seller` is titled **"Your dashboard."** — never "your shop" or "seller shop". Five tabs:
  Today (default), Inventory, Offers, Orders, Money. Auctions surface through the Today rail and
  the Inventory action; legacy tab names map: overview→today, auctions→inventory,
  earnings→money, listings→inventory.

## Voice
Indian English, warm and market-flavored: "the rail", "in circulation", "your closet", "one of one".
`₹` for all money. Numbers honest: every figure computed from the live store, never invented.
Do not sell blurred photos as acceptable; ask for steady, natural-light shots.

## Visual world (committed in `src/marketplace.css`)
Cream apothecary-editorial: `--mkt-cream #f4f2ec`, ink `#17150f`, olive `#5d6446`, hairline
`--mkt-line #e2ded4`, DM Serif Display headlines with italic olive emphases, DM Sans body,
Caveat handwriting for margin notes, small uppercase tracked labels, white cards on cream,
hairline borders, pill buttons. No cloned marketplaces UI; the page reads like a shop ledger,
not an ecommerce dashboard. Type floor is 12px anywhere.
