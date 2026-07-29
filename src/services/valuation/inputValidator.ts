import type { ValuationCosts } from './types';

// --- Numeric Safety Utilities ---

/**
 * Coerces a value to a finite number. Handles `number | '' | undefined | null | NaN`.
 * Returns `fallback` (default 0) if the value is not a valid finite number.
 */
export function safeNumber(value: unknown, fallback: number = 0): number {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Non-negative coercion — same as safeNumber but clamps to >= 0.
 */
export function safePositive(value: unknown, fallback: number = 0): number {
  return Math.max(0, safeNumber(value, fallback));
}

/**
 * Safe rounding that can never return NaN or Infinity.
 */
export function safeRound(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

/**
 * Safe division — returns `fallback` when divisor is zero or result is non-finite.
 */
export function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  if (denominator === 0 || !Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return fallback;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

/**
 * Clamps a number to a range, returning fallback for non-finite values.
 */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

// --- Item Validation ---

export interface RawItem {
  sr: number;
  description: string;
  qty: string;
  unit: string;
  marketPrice?: string;
  ocrConfidence?: number;
}

export interface ValidationWarning {
  itemIndex: number;
  field: string;
  message: string;
}

interface ItemValidationResult {
  items: RawItem[];
  warnings: ValidationWarning[];
}

/**
 * Validates and sanitizes raw item inputs before pipeline processing.
 * Never throws — always returns a valid (possibly empty) item array with warnings.
 */
export function validateAndSanitizeItems(rawItems: unknown): ItemValidationResult {
  const warnings: ValidationWarning[] = [];

  if (!Array.isArray(rawItems)) {
    warnings.push({ itemIndex: -1, field: 'items', message: 'Items input is not an array, defaulting to empty' });
    return { items: [], warnings };
  }

  const sanitized: RawItem[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    if (!raw || typeof raw !== 'object') {
      warnings.push({ itemIndex: i, field: 'item', message: 'Invalid item object, skipping' });
      continue;
    }

    const description = typeof raw.description === 'string' ? raw.description.trim() : '';
    if (!description) {
      warnings.push({ itemIndex: i, field: 'description', message: 'Empty description, skipping item' });
      continue;
    }

    const qty = typeof raw.qty === 'string' ? raw.qty.trim() : String(raw.qty || '1');
    const unit = typeof raw.unit === 'string' ? raw.unit.trim() : '';
    const sr = safeNumber(raw.sr, i + 1);
    const marketPrice = typeof raw.marketPrice === 'string' ? raw.marketPrice.trim() : undefined;
    const ocrConfidence = raw.ocrConfidence !== undefined && raw.ocrConfidence !== null ? clamp(safeNumber(raw.ocrConfidence, 0), 0, 100) : undefined;

    sanitized.push({ sr, description, qty, unit, marketPrice, ocrConfidence });
  }

  return { items: sanitized, warnings };
}

// --- Cost Validation ---

/** All cost fields except currentBid and percentage fields */
const COST_AMOUNT_FIELDS = [
  'auctionFee', 'emdCost', 'transportation', 'loading', 'unloading',
  'warehouse', 'storage', 'insurance', 'interest', 'opportunityCost',
  'repair', 'fuel', 'customDuty', 'labour', 'shrinkage', 'processingLoss',
  'miscellaneous', 'contingency', 'extraCharge', 'loadingUnloading',
  'refurbishment', 'otherFees'
] as const;

export interface SanitizedCosts {
  currentBid: number;
  gstPercent: number;
  tcsPercent: number;
  gstAmount?: number;
  tcsAmount?: number;
  auctionFee: number;
  emdCost: number;
  transportation: number;
  loading: number;
  unloading: number;
  warehouse: number;
  storage: number;
  insurance: number;
  interest: number;
  opportunityCost: number;
  repair: number;
  fuel: number;
  customDuty: number;
  labour: number;
  shrinkage: number;
  processingLoss: number;
  miscellaneous: number;
  contingency: number;
  extraCharge: number;
  loadingUnloading: number;
  refurbishment: number;
  otherFees: number;
}

/**
 * Validates and sanitizes cost inputs. Coerces all `number | ''` fields to `number`.
 * Clamps percentages to 0-100, amounts to >= 0.
 * Never throws.
 */
export function validateAndSanitizeCosts(costs: ValuationCosts): SanitizedCosts {
  const currentBid = safePositive(costs.currentBid);
  const gstPercent = clamp(safeNumber(costs.gstPercent, 18), 0, 100);
  const tcsPercent = clamp(safeNumber(costs.tcsPercent, 1), 0, 100);

  const sanitized: SanitizedCosts = {
    currentBid,
    gstPercent,
    tcsPercent,
    auctionFee: 0,
    emdCost: 0,
    transportation: 0,
    loading: 0,
    unloading: 0,
    warehouse: 0,
    storage: 0,
    insurance: 0,
    interest: 0,
    opportunityCost: 0,
    repair: 0,
    fuel: 0,
    customDuty: 0,
    labour: 0,
    shrinkage: 0,
    processingLoss: 0,
    miscellaneous: 0,
    contingency: 0,
    extraCharge: 0,
    loadingUnloading: 0,
    refurbishment: 0,
    otherFees: 0,
  };

  for (const field of COST_AMOUNT_FIELDS) {
    sanitized[field] = safePositive((costs as unknown as Record<string, unknown>)[field]);
  }

  return sanitized;
}
