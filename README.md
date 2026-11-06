# lelam.co thrift auctions

A focused apparel-auction marketplace built with React, TypeScript, and Vite. It helps people browse one-of-one pre-owned clothing listings and gives thrift stores a clear path to publish auction inventory.

## Run locally

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite (usually http://localhost:5173).

```sh
npm run build  # Type check and production build
npm run preview
npm test       # Playwright browser checks
```

For a fresh machine, install the test browser with `npx playwright install chromium` before running tests.

## Included

- Responsive marketplace landing page for buyers and thrift-store sellers
- Live-auction cards with current bids, bid counts, sellers, conditions, and closing times
- Category filtering, expanded inventory, and auction search
- Product detail dialogs with watchlist and bid-list actions
- Watchlist and bid list persisted in local storage for the preview
- Clear auction policies, seller onboarding CTA, and auction-alert signup
- Keyboard-accessible native dialogs and responsive mobile navigation

## UI component setup

This Vite app uses TypeScript, Tailwind CSS, and a shadcn-compatible `components.json` configuration. The default component import path is `@/components/ui`; keeping reusable primitives there lets shadcn CLI-generated components and application components share the same alias. Global styles live in `src/styles.css`.

To create the same setup in a fresh project:

```sh
npx shadcn@latest init
npm install -D tailwindcss @tailwindcss/vite
```

The reusable UI experiments in `components/ui` are kept in the project for future use, while the homepage stays focused on the buyer and seller auction flow.

## Make it your store

Edit inventory, current bid values (USD), descriptions, and image paths in `src/data.ts`. Auction metadata used by the preview lives in `src/App.tsx`; marketplace layout and responsive styles live in `src/styles.css`. Photography is stored in `public/images`, so browsing does not require third-party image requests.

This is a frontend concept. Product records, auction metadata, condition descriptions, policies, and seller information are illustrative. Live bidding, auction closing, seller verification, payments, order fulfillment, inventory, customer support, and mailing-list delivery need real services before launch. The bid-list preview explicitly does not submit a bid or place an order.

## Visual inspiration & photography

Original design informed by the editorial curation and slow-fashion approach of [Rogue + Runway](https://www.databending.ca/work/rogue-runway/), [Born Again Thrift SF](https://dianabenavides.dev/projects/born-again-thrift-sf), and [La Fair Art](https://www.lunarinnovate.com/en/portfolio/la-fair-art).

Demonstration photography: [Unsplash](https://unsplash.com). Image identifiers: `photo-1539109136881-3be0616acf4b`, `photo-1483985988355-763728e1935b`, `photo-1543076447-215ad9ba6923`, `photo-1434389677669-e08b4cac3105`, `photo-1548036328-c9fa89d128fa`, `photo-1542272604-787c3835535d`, `photo-1551028719-00167b16eac5`, `photo-1521572163474-6864f9cf17ab`, and `photo-1445205170230-053b83016050`. Replace demonstration photos with your actual inventory before launch.
