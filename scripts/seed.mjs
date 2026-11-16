// Seeds demo auth users and a small, real-looking catalog into Supabase.
//
// Usage:
//   cp .env.example .env.local   # fill VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//   npm run seed
//
// The service-role key is read from the environment only. Never commit it.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_PASSWORD ?? "lelam-demo-2026";

if (!url || !serviceKey) {
  console.error(
    "Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local before seeding.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  {
    email: "admin@lelam.com",
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
];

const SELLER = {
  bio: "Hand-picked vintage clothing and small-batch finds from Trivandrum.",
  location: "Kowdiar, Trivandrum",
  pickupAddress: "6, Baker Street, Kowdiar, Trivandrum 695003",
  pickupPhone: "9847098765",
  isVerified: true,
};

const PRODUCTS = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    title: "The worn-in denim jacket",
    slug: "the-worn-in-denim-jacket",
    description:
      "The kind of blue you can't make in a factory. A beautifully faded denim jacket with an easy, boxy fit, original metal buttons, and a little history in every seam. Excellent vintage condition.",
    brand: "Levi's",
    condition: "like_new",
    category: "Clothing",
    asking_price_paise: 145000,
    size: "M / L",
    images: ["/images/denim.jpg", "/images/editorial.jpg"],
    tag: "A GOOD FIND",
    color: "#e4e7e1",
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    title: "Sunday morning knit",
    slug: "sunday-morning-knit",
    description:
      "An oatmeal knit made for slow mornings and late coffee runs. Soft, tactile, and just oversized enough. Freshly cleaned and checked. Very good vintage condition with gentle, natural wear.",
    brand: "Unbranded",
    condition: "good",
    category: "Clothing",
    asking_price_paise: 98000,
    size: "M",
    images: ["/images/knit.jpg"],
    tag: null,
    color: "#e9e5dc",
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    title: "The quilted leather bag",
    slug: "the-quilted-leather-bag",
    description:
      "Your new plus-one. A compact black quilted shoulder bag with gold-tone details, a secure closure, and room for the things that matter. Light surface marks tell its story; the lining is clean and ready for yours.",
    brand: "Charles & Keith",
    condition: "good",
    category: "Bags & accessories",
    asking_price_paise: 125000,
    size: "One size",
    images: ["/images/bag.jpg"],
    tag: "ONE OF ONE",
    color: "#e8e0d7",
  },
  {
    id: "11111111-1111-4111-8111-111111111104",
    title: "Perfectly imperfect 501s",
    slug: "perfectly-imperfect-501s",
    description:
      "Straight-leg blue jeans with an authentic lived-in wash. High-rise, sturdy cotton denim, and that elusive vintage fit. Measured waist: 28 inches, inseam: 30 inches. Good vintage condition.",
    brand: "Levi's",
    condition: "good",
    category: "Clothing",
    asking_price_paise: 110000,
    size: "W 28",
    images: ["/images/jeans.jpg"],
    tag: null,
    color: "#e1e4e4",
  },
  {
    id: "11111111-1111-4111-8111-111111111105",
    title: "After-hours leather jacket",
    slug: "after-hours-leather-jacket",
    description:
      "A classic black leather jacket with an attitude all its own. Supple leather, silver-tone hardware, and a timeless silhouette. Professionally cleaned. Some characterful wear at the cuffs.",
    brand: "Vintage",
    condition: "good",
    category: "Clothing",
    asking_price_paise: 240000,
    size: "S / M",
    images: ["/images/leather.jpg"],
    tag: "ARCHIVE FAVORITE",
    color: "#dfded9",
  },
  {
    id: "11111111-1111-4111-8111-111111111106",
    title: "The off-duty cotton tee",
    slug: "the-off-duty-cotton-tee",
    description:
      "A soft cotton essential with a relaxed fit. Wear it tucked into your favorite vintage denim or under just about anything. Carefully inspected and freshly washed. Excellent pre-loved condition.",
    brand: "Uniqlo",
    condition: "like_new",
    category: "Clothing",
    asking_price_paise: 45000,
    size: "L",
    images: ["/images/tee.jpg"],
    tag: "ON THE RAIL",
    color: "#e8e6df",
  },
];

async function findUser(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const hit = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function ensureUser(spec) {
  const existing = await findUser(spec.email);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        full_name: spec.full_name,
        as_seller: spec.as_seller,
      },
    });
    if (error) throw error;
    console.log(`updated ${spec.email}`);
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: spec.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: spec.full_name,
      as_seller: spec.as_seller,
    },
  });
  if (error) throw error;
  console.log(`created ${spec.email}`);
  return data.user.id;
}

async function main() {
  const ids = {};
  for (const spec of USERS) {
    const id = await ensureUser(spec);
    ids[spec.email] = id;

    const { error } = await admin
      .from("profiles")
      .update({
        full_name: spec.full_name,
        role: spec.role,
        is_seller: spec.as_seller,
        is_blocked: false,
      })
      .eq("id", id);
    if (error) throw error;
  }

  const sellerId = ids["seller@lelam.co"];

  const { error: sellerError } = await admin.from("seller_profiles").upsert(
    {
      user_id: sellerId,
      display_name: "Nila Vintage",
      bio: SELLER.bio,
      location: SELLER.location,
      pickup_address: SELLER.pickupAddress,
      pickup_phone: SELLER.pickupPhone,
      is_verified: SELLER.isVerified,
    },
    { onConflict: "user_id" },
  );
  if (sellerError) throw sellerError;

  const { data: categories, error: categoryError } = await admin
    .from("categories")
    .select("id, name");
  if (categoryError) throw categoryError;

  const categoryId = (name) =>
    categories.find((category) => category.name === name)?.id ?? null;

  const now = new Date().toISOString();

  for (const product of PRODUCTS) {
    const { error } = await admin.from("products").upsert(
      {
        id: product.id,
        seller_id: sellerId,
        category_id: categoryId(product.category),
        title: product.title,
        slug: product.slug,
        description: product.description,
        brand: product.brand,
        condition: product.condition,
        asking_price_paise: product.asking_price_paise,
        size: product.size,
        quantity: 1,
        is_unique: true,
        location: "Kowdiar, Trivandrum",
        shipping_fee_paise: 4900,
        status: "active",
        allow_offers: true,
        auction_consent: false,
        tag: product.tag,
        color: product.color,
        published_at: now,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
  }

  const productIds = PRODUCTS.map((product) => product.id);
  const { error: imageDeleteError } = await admin
    .from("product_images")
    .delete()
    .in("product_id", productIds);
  if (imageDeleteError) throw imageDeleteError;

  const imageRows = PRODUCTS.flatMap((product) =>
    product.images.map((imageUrl, index) => ({
      product_id: product.id,
      url: imageUrl,
      alt: product.title,
      sort_order: index,
    })),
  );

  const { error: imageError } = await admin
    .from("product_images")
    .insert(imageRows);
  if (imageError) throw imageError;

  console.log("\nSeed complete.");
  console.log(`  admin  admin@lelam.com  / ${password}`);
  console.log(`  buyer  buyer@lelam.co   / ${password}`);
  console.log(`  seller seller@lelam.co  / ${password}`);
  console.log(`  listings: ${PRODUCTS.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
