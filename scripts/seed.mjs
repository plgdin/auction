// Seeds all 28 UI catalog products, Vinted taxonomy, and demo accounts into live Supabase.
// Usage: npm run seed
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

config({ path: ".env.local" });
config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_PASSWORD ?? "lelam-demo-2026";

if (!url || !serviceKey) {
  console.error("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local before seeding.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  {
    email: "admin@lelam.co",
    full_name: "Lelam Admin",
    as_seller: false,
    role: "admin",
  },
  {
    email: "buyer@lelam.co",
    full_name: "Aisha Rahman",
    as_seller: false,
    role: "user",
  },
  {
    email: "seller@lelam.co",
    full_name: "Nila Vintage",
    as_seller: true,
    role: "user",
  },
  {
    email: "kochu@lelam.co",
    full_name: "Kochu House",
    as_seller: true,
    role: "user",
  },
];

const UI_TO_CONDITION = {
  New: "new",
  "Like new": "like_new",
  Good: "good",
  Fair: "fair",
};

async function main() {
  console.log("Seeding Supabase with full catalog and accounts...");

  // 1. Ensure Auth Users & Profiles
  const userMap = new Map();
  for (const spec of USERS) {
    let uid = null;
    const { data: created, error } = await admin.auth.admin.createUser({
      email: spec.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: spec.full_name },
    });

    if (error && error.message.includes("already registered")) {
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users?.find((u) => u.email === spec.email);
      uid = existing?.id;
    } else if (created?.user) {
      uid = created.user.id;
    }

    if (!uid) {
      console.error(`Could not create or find user: ${spec.email}`, error);
      continue;
    }

    userMap.set(spec.email, uid);

    await admin.from("profiles").upsert(
      {
        id: uid,
        email: spec.email,
        full_name: spec.full_name,
        role: spec.role,
        is_seller: spec.as_seller,
      },
      { onConflict: "id" }
    );

    if (spec.as_seller) {
      await admin.from("seller_profiles").upsert(
        {
          id: uid,
          bio: "Curated vintage & pre-loved pieces from Trivandrum.",
          location: "Trivandrum, Kerala",
          pickup_address: "6, Baker Street, Kowdiar, Trivandrum 695003",
          pickup_phone: "9847098765",
          is_verified: true,
        },
        { onConflict: "id" }
      );
    }
  }

  // 2. Ensure Categories
  const categories = [
    { name: "Women", slug: "women", sort_order: 1 },
    { name: "Men", slug: "men", sort_order: 2 },
    { name: "Designer", slug: "designer", sort_order: 3 },
    { name: "Kids", slug: "kids", sort_order: 4 },
    { name: "Home", slug: "home", sort_order: 5 },
    { name: "Electronics", slug: "electronics", sort_order: 6 },
    { name: "Books & Media", slug: "books-media", sort_order: 7 },
    { name: "Hobbies & collectibles", slug: "hobbies-collectibles", sort_order: 8 },
    { name: "Sports", slug: "sports", sort_order: 9 },
  ];

  const catMap = new Map();
  for (const cat of categories) {
    const { data } = await admin
      .from("categories")
      .upsert({ ...cat, is_active: true }, { onConflict: "slug" })
      .select("id, name")
      .single();
    if (data) catMap.set(cat.name, data.id);
  }

  // 3. Insert 28 Catalog Products
  const dump = JSON.parse(fs.readFileSync("scratch/seed_dump.json", "utf8"));
  const defaultSellerId = userMap.get("seller@lelam.co");

  console.log(`Seeding ${dump.products.length} products...`);
  for (const [idx, p] of dump.products.entries()) {
    const catId = catMap.get(p.category);
    const cond = UI_TO_CONDITION[p.condition] || "good";
    const slug = `${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${idx + 1}`;

    const { data: prod, error } = await admin
      .from("products")
      .upsert(
        {
          seller_id: defaultSellerId,
          category_id: catId,
          subcategory: p.subcategory || null,
          title: p.title,
          slug,
          description: p.description,
          brand: p.brand || null,
          condition: cond,
          asking_price_paise: p.askingPrice,
          size: p.size || null,
          quantity: p.quantity || 1,
          is_unique: p.isUnique !== false,
          location: p.location || "Trivandrum, Kerala",
          shipping_fee_paise: p.shippingFee || 4900,
          status: "active",
          allow_offers: p.allowOffers !== false,
          auction_consent: Boolean(p.auctionConsent),
          published_at: new Date().toISOString(),
          tag: p.tag || null,
          color: p.color || "#e8e6df",
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();

    if (error) {
      console.warn(`Product ${p.title} failed:`, error.message);
      continue;
    }

    if (prod && Array.isArray(p.images) && p.images.length > 0) {
      await admin.from("product_images").delete().eq("product_id", prod.id);
      const rows = p.images.map((url, pos) => ({
        product_id: prod.id,
        url,
        position: pos,
      }));
      await admin.from("product_images").insert(rows);
    }
  }

  console.log("\nDone! All products, categories and users seeded.");
}

main().catch(console.error);
