export type VintedGroup = { name: string; subs: string[] };
export type VintedCategory = { top: string; groups: VintedGroup[] };

/** Exact Vinted taxonomy from screenshots (transcribed as-is). */
export const VINTED_CATALOG: VintedCategory[] = [
  {
    top: "Women",
    groups: [
      {
        name: "Clothing",
        subs: [
          "All",
          "Jumpers & sweaters",
          "Dresses",
          "Skorts",
          "Jeans",
          "Shorts & cropped pants",
          "Swimwear",
          "Maternity clothes",
          "Costumes & special outfits",
          "Outerwear",
          "Suits & blazers",
          "Skirts",
          "Tops & T-shirts",
          "Pants & leggings",
          "Jumpsuits & rompers",
          "Lingerie & nightwear",
          "Activewear",
          "Other clothing",
        ],
      },
      { name: "Shoes", subs: ["All", "Sneakers", "Boots", "Sandals", "Heels", "Flats", "Trainers & runners", "Other shoes"] },
      { name: "Bags", subs: ["All", "Shoulder bags", "Handbags", "Tote bags", "Clutches", "Backpacks", "Crossbody bags", "Other bags"] },
      { name: "Accessories", subs: ["All", "Jewellery", "Scarves & gloves", "Belts", "Hats & caps", "Sunglasses", "Wallets & card holders", "Other accessories"] },
      { name: "Beauty", subs: ["All", "Makeup", "Skincare", "Hair care", "Perfumes", "Tools & brushes", "Other beauty"] },
    ],
  },
  {
    top: "Men",
    groups: [
      {
        name: "Clothing",
        subs: [
          "All",
          "Outerwear",
          "Suits & blazers",
          "Pants",
          "Socks & underwear",
          "Swimwear",
          "Costumes & special outfits",
          "Jeans",
          "Tops & T-shirts",
          "Sweaters & sweatshirts",
          "Shorts",
          "Sleepwear",
          "Activewear",
          "Other clothing",
        ],
      },
      { name: "Shoes", subs: ["All", "Sneakers", "Boots", "Sandals", "Formal shoes", "Trainers & runners", "Other shoes"] },
      { name: "Accessories", subs: ["All", "Watches", "Wallets", "Belts", "Sunglasses", "Hats & caps", "Other accessories"] },
      { name: "Grooming", subs: ["All", "Shaving & grooming", "Skincare", "Hair care", "Fragrances", "Other grooming"] },
    ],
  },
  {
    top: "Designer",
    groups: [
      {
        name: "Designer women",
        subs: ["All", "Designer shoes", "Designer clothing", "Designer bags", "Designer accessories"],
      },
      {
        name: "Designer men",
        subs: ["All", "Designer shoes", "Designer clothing", "Designer bags", "Designer accessories"],
      },
    ],
  },
  {
    top: "Kids",
    groups: [
      {
        name: "Girls clothing",
        subs: [
          "All",
          "Shoes",
          "Sweaters & hoodies",
          "Dresses",
          "Pants, shorts & overalls",
          "Accessories",
          "Underwear & socks",
          "Activewear",
          "Clothing for twins",
          "Formal wear & special occasion clothing",
          "Baby clothing",
          "Outerwear",
          "Tops & T-shirts",
          "Skirts",
          "Bags & backpacks",
          "Swimwear",
          "Sleepwear & nightwear",
          "Clothing bundles",
          "Costumes",
          "Other girls' clothing",
        ],
      },
      { name: "Boys clothing", subs: ["All", "Shoes", "Sweaters & hoodies", "Tops & T-shirts", "Pants, shorts & overalls", "Outerwear", "Activewear", "Swimwear", "Sleepwear & nightwear", "Clothing bundles", "Costumes", "Other boys' clothing"] },
      { name: "Toys", subs: ["All", "Action figures", "Dolls", "Building toys", "Plush toys", "Games & puzzles", "Other toys"] },
      { name: "Strollers", subs: ["All", "Pushchairs", "Jogging strollers", "Prams", "Accessories"] },
      { name: "Furniture & decor", subs: ["All", "Cribs & beds", "High chairs", "Storage", "Decor", "Other furniture & decor"] },
      { name: "Bathing & changing", subs: ["All", "Bath tubs", "Changing mats", "Towels & robes", "Other bathing & changing"] },
      { name: "Childproofing & safety equipment", subs: ["All", "Gates", "Monitors", "Locks & guards", "Other safety equipment"] },
      { name: "Health & pregnancy", subs: ["All", "Pregnancy care", "First aid", "Thermometers", "Other health"] },
      { name: "Nursing & feeding", subs: ["All", "Bottles", "Breast pumps", "High chairs", "Weaning", "Other nursing & feeding"] },
      { name: "Sleep & bedding", subs: ["All", "Cots", "Bedding", "Sleeping bags", "Swaddles", "Other sleep & bedding"] },
      { name: "School supplies", subs: ["All", "Backpacks", "Stationery", "Uniforms", "Lunchboxes", "Other school supplies"] },
      { name: "Other kids' items", subs: ["All", "Other kids' items"] },
    ],
  },
  {
    top: "Home",
    groups: [
      {
        name: "Small kitchen appliances",
        subs: [
          "All",
          "Coffee, tea & espresso making",
          "Blenders, mixers & food processors",
          "Fryers",
          "Hotplates",
          "Water & drink dispensers",
          "Small kitchen appliance accessories",
          "Kettles & water boilers",
          "Toasters",
          "Microwaves",
          "Electric grills & griddles",
          "Juicers",
          "Speciality appliances",
          "Small kitchen appliance parts",
        ],
      },
      { name: "Cookware & bakeware", subs: ["All", "Pots & pans", "Bakeware", "Kitchen knives", "Other cookware & bakeware"] },
      { name: "Kitchen tools", subs: ["All", "Cutlery", "Utensils", "Gadgets", "Other kitchen tools"] },
      { name: "Tableware", subs: ["All", "Plates", "Bowls", "Glasses", "Cutlery sets", "Other tableware"] },
      { name: "Household care", subs: ["All", "Cleaning", "Laundry", "Ironing", "Storage", "Other household care"] },
      { name: "Textiles", subs: ["All", "Bedding", "Towels", "Curtains", "Cushions", "Other textiles"] },
      { name: "Home accessories", subs: ["All", "Decor", "Vases", "Candles", "Mirrors", "Clocks", "Other home accessories"] },
      { name: "Office supplies", subs: ["All", "Paper", "Pens & stationery", "Desk accessories", "Filing", "Other office supplies"] },
      { name: "Celebrations & holidays", subs: ["All", "Party supplies", "Decorations", "Balloons", "Games", "Other celebrations & holidays"] },
      { name: "Tools & DIY", subs: ["All", "Power tools", "Hand tools", "Painting", "Measuring", "Other tools & DIY"] },
      { name: "Outdoor & garden", subs: ["All", "Pots & planters", "Garden tools", "Outdoor furniture", "Other outdoor & garden"] },
      { name: "Pet care", subs: ["All", "Food & treats", "Toys", "Beds", "Carriers", "Other pet care"] },
    ],
  },
  {
    top: "Electronics",
    groups: [
      {
        name: "Video games & consoles",
        subs: ["All", "Games", "Gaming headsets", "Virtual reality", "Consoles", "Controllers", "Simulators", "Accessories"],
      },
      { name: "Computers & accessories", subs: ["All", "Laptops", "Desktops", "Monitors", "Keyboards & mice", "Peripherals", "Parts", "Other computers & accessories"] },
      { name: "Cell phones & communication", subs: ["All", "Smartphones", "Cases & covers", "Chargers & cables", "Power banks", "Other phones & communication"] },
      { name: "Audio, headphones & hi-fi", subs: ["All", "Headphones", "Earbuds", "Speakers", "Soundbars", "Turntables", "Amps & receivers", "Other audio & hi-fi"] },
      { name: "Cameras & accessories", subs: ["All", "Cameras", "Lenses", "Tripods", "Bags & straps", "Drones", "Other cameras & accessories"] },
      { name: "Tablets, e-readers & accessories", subs: ["All", "Tablets", "E-readers", "Cases & covers", "Styluses", "Other tablets & accessories"] },
      { name: "TV & home theater", subs: ["All", "TVs", "Projectors", "Home theater", "Remotes", "Other TV & home theater"] },
      { name: "Beauty & personal care electronics", subs: ["All", "Hair dryers", "Straighteners", "Shavers & trimmers", "Massagers", "Other beauty & personal care electronics"] },
      { name: "Wearables", subs: ["All", "Smartwatches", "Fitness trackers", "Smart glasses", "Other wearables"] },
      { name: "Other devices & accessories", subs: ["All", "Smart home", "Cables & adapters", "Batteries", "Other devices & accessories"] },
    ],
  },
  {
    top: "Books & Media",
    groups: [
      {
        name: "Books",
        subs: [
          "All",
          "Non-fiction",
          "Comics, manga & graphic novels",
          "Coloring, puzzle & activity books",
          "Fiction",
          "Kids & young adults",
          "Textbooks & study materials",
        ],
      },
      { name: "Magazines", subs: ["All", "Fashion", "Lifestyle", "Business", "Sports", "Other magazines"] },
      { name: "Music", subs: ["All", "Vinyl", "CDs", "Cassettes", "Sheet music", "Other music"] },
      { name: "Video", subs: ["All", "DVDs", "Blu-ray", "VHS", "Other video"] },
    ],
  },
  {
    top: "Hobbies & collectibles",
    groups: [
      {
        name: "Trading cards",
        subs: [
          "All",
          "Booster packs",
          "Card decks",
          "Uncut card sheets",
          "Single trading cards",
          "Booster boxes",
          "Trading card lots",
        ],
      },
      { name: "Board games", subs: ["All", "Strategy games", "Family games", "Party games", "Chess & checkers", "Other board games"] },
      { name: "Puzzles", subs: ["All", "Jigsaw puzzles", "3D puzzles", "Puzzle accessories", "Other puzzles"] },
      { name: "Tabletop & miniature gaming", subs: ["All", "Miniatures", "Dice", "Mats & terrain", "Other tabletop & gaming"] },
      { name: "Memorabilia", subs: ["All", "Autographs", "Photos", "Tickets", "Other memorabilia"] },
      { name: "Coins & banknotes", subs: ["All", "Coins", "Banknotes", "Sets", "Other coins & banknotes"] },
      { name: "Stamps", subs: ["All", "Single stamps", "Stamp blocks", "Albums", "Other stamps"] },
      { name: "Postcards", subs: ["All", "Single postcards", "Postcard sets", "Albums", "Other postcards"] },
      { name: "Musical instruments & gear", subs: ["All", "Guitars", "Keyboards", "Drums", "Amps", "Strings & picks", "Other instruments & gear"] },
      { name: "Arts & crafts", subs: ["All", "Paints", "Brushes", "Paper & canvas", "Yarn & fabric", "Other arts & crafts"] },
      { name: "Collectibles storage", subs: ["All", "Binders", "Sleeves", "Cases", "Other collectibles storage"] },
      { name: "Gaming accessories", subs: ["All", "Dice", "Tokens", "Storage", "Other gaming accessories"] },
    ],
  },
  {
    top: "Sports",
    groups: [
      {
        name: "Cycling",
        subs: ["All", "Cycling accessories & tools", "Kids' bike seats", "Kids' bikes", "Bike trailers", "Bike parts"],
      },
      { name: "Fitness, running & yoga", subs: ["All", "Weights", "Yoga mats", "Resistance bands", "Running gear", "Other fitness, running & yoga"] },
      { name: "Outdoor sports", subs: ["All", "Camping", "Hiking", "Climbing", "Fishing", "Other outdoor sports"] },
      { name: "Water sports", subs: ["All", "Swimming", "Surfing", "Kayaking", "Paddleboarding", "Other water sports"] },
      { name: "Team sports", subs: ["All", "Football", "Basketball", "Cricket", "Hockey", "Other team sports"] },
      { name: "Racket sports", subs: ["All", "Tennis", "Badminton", "Table tennis", "Squash", "Other racket sports"] },
      { name: "Golf", subs: ["All", "Clubs", "Bags", "Balls", "Shoes", "Other golf"] },
      { name: "Equestrian & horseback riding", subs: ["All", "Saddles", "Bridles", "Boots", "Helmets", "Other equestrian & riding"] },
      { name: "Skateboards & scooters", subs: ["All", "Skateboards", "Scooters", "Helmets", "Parts", "Other skateboards & scooters"] },
      { name: "Boxing & martial arts", subs: ["All", "Gloves", "Pads", "Uniforms", "Belts", "Other boxing & martial arts"] },
      { name: "Casual sports & games", subs: ["All", "Darts", "Pool & snooker", "Boules", "Other casual sports & games"] },
      { name: "Winter sports", subs: ["All", "Skis", "Snowboards", "Boots", "Clothing", "Other winter sports"] },
    ],
  },
];

export const CATEGORIES = VINTED_CATALOG.map((c) => c.top as string);
export type CategoryName = (typeof VINTED_CATALOG)[number]["top"];

export function groupsFor(top: string): VintedGroup[] {
  return VINTED_CATALOG.find((c) => c.top === top)?.groups ?? [];
}
export function subsFor(top: string, group: string): string[] {
  return groupsFor(top).find((g) => g.name === group)?.subs ?? ["All", "Other"];
}
export function findTopForLegacy(category: string): string {
  const m: Record<string, string> = {
    Clothing: "Women",
    Footwear: "Women",
    "Bags & accessories": "Women",
    Electronics: "Electronics",
    "Mobile & tablets": "Electronics",
    "Computers & gaming": "Electronics",
    "Home & living": "Home",
    Furniture: "Home",
    "Kitchen & dining": "Home",
    "Books & media": "Books & Media",
    "Sports & outdoors": "Sports",
    "Toys & games": "Kids",
    "Beauty & care": "Women",
    "Art & collectibles": "Hobbies & collectibles",
    "Music & instruments": "Hobbies & collectibles",
    Other: "Home",
  };
  return m[category] ?? "Women";
}

export const CLOTHING_BRANDS = [
  "H&M", "Zara", "Levi's", "Nike", "Adidas", "Uniqlo", "Mango", "Bershka", "Pull&Bear",
  "Abercrombie & Fitch", "American Eagle", "Hollister", "Esprit", "Next", "ASOS",
  "New Look", "Primark", "C&A", "Superdry", "Jack & Jones", "Only", "Selected",
  "Vero Moda", "Comma", "Tommy Hilfiger", "Ralph Lauren", "Lacoste", "Fred Perry",
  "G-Star", "Diesel", "Calvin Klein", "New Balance", "Puma", "Reebok", "Under Armour",
  "Columbia", "The North Face", "Patagonia", "Benetton", "GAP", "Old Navy",
  "Unbranded", "Other",
];

export const ELECTRONICS_BRANDS = [
  "Apple", "Samsung", "Sony", "LG", "OnePlus", "Xiaomi", "HP", "Dell", "Lenovo",
  "Asus", "Acer", "Nintendo", "PlayStation", "Xbox", "Logitech", "Bose", "JBL",
  "Canon", "Nikon", "GoPro", "Anker", "Other",
];

export const APPAREL_SIZES = [
  "XXXS", "XXS", "XS", "S", "M", "L", "XL",
  "2XL", "3XL", "4XL", "5XL", "6XL", "7XL", "8XL", "9XL", "10XL", "11XL", "12XL", "13XL", "14XL",
];

export const SHOE_SIZES = [
  "EU 35","EU 36","EU 37","EU 38","EU 39","EU 40","EU 41","EU 42","EU 43","EU 44","EU 45","EU 46","EU 47","EU 48",
  "UK 3","UK 4","UK 5","UK 6","UK 7","UK 8","UK 9","UK 10","UK 11","UK 12","UK 13",
  "US 4","US 5","US 6","US 7","US 8","US 9","US 10","US 11","US 12","US 13",
];

export const CATEGORY_TILES = [
  { name: "Women", label: "Clothing & more", image: "/images/denim.jpg" },
  { name: "Electronics", label: "Tech, tested", image: "/images/editorial.jpg" },
  { name: "Home", label: "For your place", image: "/images/detail.jpg" },
  { name: "Sports", label: "Gear up", image: "/images/bag.jpg" },
];
