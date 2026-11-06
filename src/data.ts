export type Category =
  "All finds" | "Outerwear" | "Tops & knits" | "Denim" | "Accessories";
export interface Product {
  id: number;
  name: string;
  era: string;
  category: Category;
  price: number;
  size: string;
  image: string;
  tag?: string;
  color: string;
  description: string;
}

export const categories: Category[] = [
  "All finds",
  "Outerwear",
  "Tops & knits",
  "Denim",
  "Accessories",
];

export const products: Product[] = [
  {
    id: 1,
    name: "The worn-in denim jacket",
    era: "THE ’90S CALLED",
    category: "Outerwear",
    price: 64,
    size: "M / L",
    image: "/images/denim.jpg",
    tag: "A GOOD FIND",
    color: "#e4e7e1",
    description:
      "The kind of blue you can’t make in a factory. A beautifully faded denim jacket with an easy, boxy fit, original metal buttons, and a little history in every seam. Excellent vintage condition.",
  },
  {
    id: 2,
    name: "Sunday morning knit",
    era: "SOFT SPOT FOR THE ’80S",
    category: "Tops & knits",
    price: 42,
    size: "M",
    image: "/images/knit.jpg",
    color: "#e9e5dc",
    description:
      "An oatmeal knit made for slow mornings and late coffee runs. Soft, tactile, and just oversized enough. Freshly cleaned and checked by our team. Very good vintage condition with gentle, natural wear.",
  },
  {
    id: 3,
    name: "The quilted leather bag",
    era: "FOREVER KIND OF PIECE",
    category: "Accessories",
    price: 58,
    size: "ONE SIZE",
    image: "/images/bag.jpg",
    tag: "ONE OF ONE",
    color: "#e8e0d7",
    description:
      "Your new plus-one. A compact black quilted shoulder bag with gold-tone details, a secure closure, and room for the things that matter. Light surface marks tell its story; the lining is clean and ready for yours.",
  },
  {
    id: 4,
    name: "Perfectly imperfect 501s",
    era: "AN ORIGINAL, ALWAYS",
    category: "Denim",
    price: 56,
    size: "W 28",
    image: "/images/jeans.jpg",
    color: "#e1e4e4",
    description:
      "Straight-leg blue jeans with an authentic lived-in wash. High-rise, sturdy cotton denim, and that elusive vintage fit. Please check the measured waist: 28 inches, inseam: 30 inches. Good vintage condition.",
  },
  {
    id: 5,
    name: "After-hours leather jacket",
    era: "A LITTLE ROCK ’N’ ROLL",
    category: "Outerwear",
    price: 88,
    size: "S / M",
    image: "/images/leather.jpg",
    tag: "ARCHIVE FAVORITE",
    color: "#dfded9",
    description:
      "A classic black leather jacket with an attitude all its own. Supple leather, silver-tone hardware, and a timeless silhouette. Professionally cleaned. Some characterful wear at the cuffs.",
  },
  {
    id: 6,
    name: "The off-duty cotton tee",
    era: "KEEP IT SIMPLE",
    category: "Tops & knits",
    price: 24,
    size: "L",
    image: "/images/tee.jpg",
    color: "#e8e6df",
    description:
      "A soft cotton essential with a relaxed fit. Wear it tucked into your favorite vintage denim or under just about anything. Carefully inspected and freshly washed. Excellent pre-loved condition.",
  },
  {
    id: 7,
    name: "Heavyweight tee · Bone",
    era: "DHxWHY ARCHIVE",
    category: "Tops & knits",
    price: 48,
    size: "L",
    image: "https://cdn.21st.dev/assets/mirror/14/1485bf44725b18fcdba71bfae54d67d648ab3bff4b24215a042c0cc4c895a2e6.webp",
    tag: "ON THE RAIL",
    color: "#EFEBE2",
    description: "240 gsm organic cotton with a tonal DHxWHY embroidery on the chest. Regular fit with premium drape.",
  },
  {
    id: 8,
    name: "Graphic tee · CCgather",
    era: "CCGATHER DROP",
    category: "Tops & knits",
    price: 52,
    size: "XL",
    image: "https://cdn.21st.dev/assets/mirror/d7/d769f183472d0fd98a7aff2a643593748cd36ef9da1497d9bf6f0d87d1025a9b.webp",
    tag: "ON THE RAIL",
    color: "#101214",
    description: "Deep black tee with the CCgather wordmark printed front and back. Premium 240 gsm combed cotton.",
  },
  {
    id: 9,
    name: "Oxford shirt · Sky",
    era: "MAESTIQ VAULT",
    category: "Tops & knits",
    price: 74,
    size: "M",
    image: "https://cdn.21st.dev/assets/mirror/47/470a7723cef068f81e8a4c09d1ab3f8630c61b734c2168b10f3858e45efbf31f.webp",
    tag: "ON THE RAIL",
    color: "#A3D3EB",
    description: "Pale sky oxford cotton with a button-down collar and a tiny Maestiq embroidery. Single chest pocket.",
  },
  {
    id: 10,
    name: "Knit cardigan · Olive",
    era: "LAMBSWOOL EDIT",
    category: "Tops & knits",
    price: 96,
    size: "L",
    image: "https://cdn.21st.dev/assets/mirror/58/581b13c5ca241c653dc94d2c8048c92a60f022cfbaaf153261076d3a6655827e.webp",
    tag: "HOT BID",
    color: "#758151",
    description: "Chunky olive wool cardigan with genuine wooden buttons and thick ribbed trims. Deep V-neck.",
  },
  {
    id: 11,
    name: "Hoodie · Maestiq Heather",
    era: "HEAVY FLEECE",
    category: "Outerwear",
    price: 88,
    size: "L",
    image: "https://cdn.21st.dev/assets/mirror/51/51750ba098dd622df46695bca781b3f0ec336a36b93b070e638cc04455def6d6.webp",
    tag: "ON THE RAIL",
    color: "#A0A5AB",
    description: "400 gsm heather fleece hoodie with the Maestiq wordmark across the chest and double-layer hood.",
  },
  {
    id: 12,
    name: "Crewneck sweatshirt · Lilac",
    era: "PASTEL SERIES",
    category: "Tops & knits",
    price: 78,
    size: "M",
    image: "https://cdn.21st.dev/assets/mirror/8e/8e38660e2add9637c27846d9b8d620f2abb228a5a153ccfd7b1c808b6845e1f8.webp",
    tag: "ON THE RAIL",
    color: "#CCB2E0",
    description: "Muted lilac fleece crewneck with a raised DHxWHY puff print and heavy elasticated cuffs.",
  },
  {
    id: 13,
    name: "Piqué polo · Forest",
    era: "CLASSIC FIT",
    category: "Tops & knits",
    price: 62,
    size: "M / L",
    image: "https://cdn.21st.dev/assets/mirror/19/19fe43cb681195ae227e3164088d86a07a1b6e33cc54c6e35637374736a16894.webp",
    tag: "ON THE RAIL",
    color: "#185B37",
    description: "Forest green piqué polo with a bone CCgather embroidery on the chest and mother-of-pearl buttons.",
  },
  {
    id: 14,
    name: "Henley · Brick Slub",
    era: "WORKWEAR ARCHIVE",
    category: "Tops & knits",
    price: 56,
    size: "L",
    image: "https://cdn.21st.dev/assets/mirror/84/84aa4b0e21ed11fcbc083647a607b94ee3a6c21cb66c114cfb1dad0792c15499.webp",
    tag: "ON THE RAIL",
    color: "#B05139",
    description: "Dusty brick henley with a three-button placket, washed for that lived-in feel from day one.",
  },
  {
    id: 15,
    name: "Breton long sleeve · Marine",
    era: "NAUTICAL ESSENTIAL",
    category: "Tops & knits",
    price: 58,
    size: "M",
    image: "https://cdn.21st.dev/assets/mirror/09/096002a95aba7de9c197de4cb5c78cbbe17c1677b19c547cc20c6dbef47a899c.webp",
    tag: "ON THE RAIL",
    color: "#E4DFD3",
    description: "Classic ink-and-bone Breton stripe with a wide boat neck in 220 gsm combed cotton.",
  },
  {
    id: 16,
    name: "Oversized tee · CCgather Ochre",
    era: "STREET ARCHIVE",
    category: "Tops & knits",
    price: 52,
    size: "XL",
    image: "https://cdn.21st.dev/assets/mirror/72/7208c811f54e123dd7b1a5c1c3926f43ca832f6c4c20c45de10671ffd544409d.webp",
    tag: "ON THE RAIL",
    color: "#DE9C31",
    description: "Boxy ochre tee with a small chest mark and a large CCgather back print. Heavyweight drop-shoulder fit.",
  },
];

export const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
