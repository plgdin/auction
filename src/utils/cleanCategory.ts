/**
 * Utility to extract clean, short category names without title clutter,
 * pipe symbols (|), or duplicated title strings.
 */
export function cleanCategoryName(categoryName?: string | null, title?: string | null): string {
  if (!categoryName) return 'GeM Auction';

  let cleaned = categoryName.trim();

  // 1. If category contains '|', split by '|' and take the first part
  if (cleaned.includes('|')) {
    const parts = cleaned.split('|');
    cleaned = parts[0].trim();
  }

  // 2. If category contains ' - ', split by ' - ' and take the first part
  if (cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ');
    cleaned = parts[0].trim();
  } else if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    cleaned = parts[0].trim();
  }

  // 3. If cleaned category is identical to title or contains title text, return clean default
  if (title) {
    const cleanTitle = title.trim().toLowerCase();
    if (cleaned.toLowerCase() === cleanTitle) {
      return 'GeM Auction';
    }
    if (cleaned.length > 35 && cleanTitle.length > 10 && cleaned.toLowerCase().includes(cleanTitle.substring(0, 15))) {
      return 'GeM Auction';
    }
  }

  // 4. If category name is still excessively long (> 35 chars), truncate to first 3 words
  if (cleaned.length > 35) {
    const words = cleaned.split(/\s+/);
    if (words.length > 3) {
      cleaned = words.slice(0, 3).join(' ');
    }
  }

  return cleaned || 'GeM Auction';
}
