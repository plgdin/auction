/**
 * Shared type definitions for the MSTC catalog parsing pipeline.
 *
 * All parser modules import their types from this single source of truth
 * to avoid circular dependencies and duplication.
 */

export interface SubItem {
  sr: number | string;
  description: string;
  qty: string;
  unit: string;
}

export interface CatalogItem {
  sr: number | string;
  description: string;
  qty: string;
  unit: string;
  taxRate: string;
  attachments?: string[];
  images?: string[];
  marketPrice?: string;
  subItems?: SubItem[];
  pcbGroup?: string;
  productType?: string;
  preBidEmd?: string;
  lotLocation?: string;
  lotState?: string;
}

export interface KeyContact {
  role: string;
  name: string;
  email: string;
  phone?: string;
}

export interface DepositDetails {
  emd: string;
  preBidDdg: string;
  adminCharges: string;
}

export interface InspectionDetails {
  time: string;
  contact: string;
}

export interface CatalogSummary {
  overview: string;
  scopeOfWork: string;
  items: CatalogItem[];
  eligibility: string[];
  depositDetails: DepositDetails;
  keyContacts: KeyContact[];
  preview_image_url?: string | null;
  extracted_images?: string[];
  totalMarketValue?: number;
  auctionType?: string;
  inspectionDetails?: InspectionDetails;
  needsReview?: boolean;
  reviewReason?: string;
  auctionStartTime?: string;
  auctionCloseTime?: string;
}
