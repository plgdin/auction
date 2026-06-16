export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  rate: number; // multiplier from INR
}

export const CURRENCIES: Record<string, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', rate: 1 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', rate: 0.012 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.011 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', rate: 0.0094 },
};

export function formatPrice(priceInInr: number, currencyCode: string = 'INR'): string {
  const currency = CURRENCIES[currencyCode] || CURRENCIES.INR;
  const converted = priceInInr * currency.rate;
  
  // Format with currency symbol
  return `${currency.symbol}${Math.round(converted).toLocaleString(currencyCode === 'INR' ? 'en-IN' : 'en-US')}`;
}

export function formatPriceString(priceStr: string, currencyCode: string = 'INR'): string {
  if (!priceStr) return priceStr;
  const currency = CURRENCIES[currencyCode] || CURRENCIES.INR;
  
  // Replace rupee-prefixed amounts (e.g. ₹780, ₹ 3,50,000, INR 10,000)
  return priceStr.replace(/(?:₹|INR)\s*([\d,]+(?:\.\d+)?)/gi, (match, priceNumStr) => {
    const rawPrice = parseFloat(priceNumStr.replace(/,/g, ''));
    if (isNaN(rawPrice)) return match;
    const converted = rawPrice * currency.rate;
    const formattedNum = Math.round(converted).toLocaleString(currencyCode === 'INR' ? 'en-IN' : 'en-US');
    return `${currency.symbol}${formattedNum}`;
  });
}

