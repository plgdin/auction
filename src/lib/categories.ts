import type { Category } from "./types";

/** Broad categories so people can sell anything, not just clothes. */
export const CATEGORIES: Category[] = [
  "Clothing",
  "Footwear",
  "Bags & accessories",
  "Electronics",
  "Mobile & tablets",
  "Computers & gaming",
  "Home & living",
  "Furniture",
  "Kitchen & dining",
  "Books & media",
  "Sports & outdoors",
  "Toys & games",
  "Beauty & care",
  "Art & collectibles",
  "Music & instruments",
  "Other",
];

export const CATEGORY_TILES: { name: Category; label: string; image: string }[] = [
  { name: "Clothing", label: "Wear it again", image: "/images/denim.jpg" },
  { name: "Electronics", label: "Tech, tested", image: "/images/editorial.jpg" },
  { name: "Home & living", label: "For your place", image: "/images/detail.jpg" },
  { name: "Bags & accessories", label: "The finishing piece", image: "/images/bag.jpg" },
];
