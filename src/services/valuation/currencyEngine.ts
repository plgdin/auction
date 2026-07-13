// Currency Engine - Handles conversions and currency rates

export interface ExchangeRate {
  rate: number; // to INR
  updatedAt: string;
  source: string;
}

export const EXCHANGE_RATES: Record<string, ExchangeRate> = {
  INR: { rate: 1.0, updatedAt: '2026-07-13T00:00:00Z', source: 'RBI Baseline' },
  USD: { rate: 85.0, updatedAt: '2026-07-13T00:00:00Z', source: 'Interbank Spot' },
  GBP: { rate: 108.0, updatedAt: '2026-07-13T00:00:00Z', source: 'Interbank Spot' },
  EUR: { rate: 92.0, updatedAt: '2026-07-13T00:00:00Z', source: 'Interbank Spot' },
  AED: { rate: 23.0, updatedAt: '2026-07-13T00:00:00Z', source: 'Interbank Spot' },
};

export const currencyEngine = {
  getRates(): Record<string, ExchangeRate> {
    return EXCHANGE_RATES;
  },

  convert(amount: number, from: string, to: string): number {
    const fromRate = EXCHANGE_RATES[from.toUpperCase()]?.rate;
    const toRate = EXCHANGE_RATES[to.toUpperCase()]?.rate;

    if (!fromRate || !toRate) {
      console.warn(`Unsupported currency conversion: ${from} to ${to}. Defaulting to original amount.`);
      return amount;
    }

    // Convert from source currency to INR, then to target currency
    const amountInInr = amount * fromRate;
    return amountInInr / toRate;
  },

  convertToInr(amount: number, from: string): number {
    return this.convert(amount, from, 'INR');
  },

  convertFromInr(amount: number, to: string): number {
    return this.convert(amount, 'INR', to);
  }
};
