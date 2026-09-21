/**
 * Image Resolver for GeM items
 * NOTE: Stock images (Unsplash/placeholders) have been completely removed.
 * Only genuine government portal assets and Supabase Storage scanned previews are permitted.
 */

export function getGemItemImage(_title: string = '', _category: string = ''): string | null {
  // Stock photography is disallowed for official government tenders & auctions.
  return null;
}

