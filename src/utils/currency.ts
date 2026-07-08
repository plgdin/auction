export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  rate: number; // multiplier from INR
}

export const CURRENCIES: Record<string, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', rate: 1 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', rate: 0.010056 }, // 1 USD ≈ 99.44 INR (so 1,800 USD ≈ 1.79 lakhs INR)
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.00922 },      // 1 EUR ≈ 108.48 INR
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', rate: 0.00799 }, // 1 GBP ≈ 125.16 INR
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
  
  // Replace rupee-prefixed amounts (e.g. ₹780, ₹ 3,50,000, INR 10,000, or mojibake Ôé╣780)
  return priceStr.replace(/(?:₹|Ôé╣|INR)\s*([\d,]+(?:\.\d+)?)/gi, (match, priceNumStr) => {
    const rawPrice = parseFloat(priceNumStr.replace(/,/g, ''));
    if (isNaN(rawPrice)) return match;
    const converted = rawPrice * currency.rate;
    const formattedNum = Math.round(converted).toLocaleString(currencyCode === 'INR' ? 'en-IN' : 'en-US');
    return `${currency.symbol}${formattedNum}`;
  });
}

export async function fetchLatestRates(): Promise<Record<string, number> | null> {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/INR');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    if (data && data.result === 'success' && data.rates) {
      const rates: Record<string, number> = {};
      if (data.rates.USD) {
        CURRENCIES.USD.rate = data.rates.USD;
        rates.USD = data.rates.USD;
      }
      if (data.rates.EUR) {
        CURRENCIES.EUR.rate = data.rates.EUR;
        rates.EUR = data.rates.EUR;
      }
      if (data.rates.GBP) {
        CURRENCIES.GBP.rate = data.rates.GBP;
        rates.GBP = data.rates.GBP;
      }
      console.log('Successfully fetched and updated daily exchange rates:', CURRENCIES);
      return rates;
    }
  } catch (error) {
    console.error('Failed to fetch daily currency exchange rates:', error);
  }
  return null;
}

