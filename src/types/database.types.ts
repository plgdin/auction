export type UserRole = 'buyer' | 'seller' | 'admin' | 'superadmin' | 'logistics';
export type AuctionStatus = 'draft' | 'published' | 'active' | 'closed' | 'cancelled';
export type BidStatus = 'active' | 'winning' | 'outbid' | 'withdrawn';
export type TenderStatus = 'draft' | 'open' | 'under_evaluation' | 'awarded' | 'cancelled';

export interface Organization {
  id: string;
  name: string;
  registration_number?: string;
  tax_id?: string;
  address?: string;
  contact_email?: string;
  contact_phone?: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  organization_id?: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuctionCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Auction {
  id: string;
  title: string;
  description?: string;
  category_id?: string;
  seller_id: string;
  status: AuctionStatus;
  starting_price: number;
  reserve_price?: number;
  bid_increment: number;
  emd_amount: number;
  start_time: string;
  end_time: string;
  terms_conditions?: string;
  regional_office?: string;
  location?: string;
  pre_bid?: boolean;
  reference_number?: string;   // Added via migration 00005
  winner_id?: string;          // Added via migration 00005
  created_at: string;
  updated_at: string;
}

export interface AuctionDocument {
  id: string;
  auction_id: string;
  name: string;
  file_url: string;
  file_type?: string;
  uploaded_by: string;
  created_at: string;
}

export interface AuctionImage {
  id: string;
  auction_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

export interface Bid {
  id: string;
  auction_id: string;
  bidder_id: string;
  amount: number;
  status: BidStatus;
  ip_address?: string;
  created_at: string;
}

export interface Watchlist {
  id: string;
  user_id: string;
  auction_id: string;
  created_at: string;
}

export interface Tender {
  id: string;
  title: string;
  reference_number: string;
  description?: string;
  issuer_id: string;
  status: TenderStatus;
  submission_deadline: string;
  opening_date?: string;
  emd_amount: number;
  document_fee: number;
  created_at: string;
  updated_at: string;
}

export interface TenderDocument {
  id: string;
  tender_id: string;
  name: string;
  file_url: string;
  file_type?: string;
  uploaded_by: string;
  created_at: string;
}

export interface TenderSubmission {
  id: string;
  tender_id: string;
  submitter_id: string;
  status: string;
  financial_bid?: number;
  technical_details?: string;
  submitted_at: string;
  updated_at: string;
}

export interface EmdTransaction {
  id: string;
  user_id: string;
  auction_id?: string;
  tender_id?: string;
  amount: number;
  status: string;
  transaction_reference?: string;
  payment_method?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentReceipt {
  id: string;
  user_id: string;
  amount: number;
  receipt_url?: string;
  description?: string;
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: string;
  status: string;       // Added via migration 00005
  reference_id?: string;
  description?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  type?: string;
  link_url?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: any;
  ip_address?: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  is_published: boolean;
  published_by?: string;
  created_at: string;
  updated_at: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewsUpdate {
  id: string;
  title: string;
  summary?: string;
  content: string;
  image_url?: string;
  is_published: boolean;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  status: string;
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: any;
  updated_at?: string;
  updated_by?: string;
}

export interface Blog {
  id: string;
  title: string;
  content: string;
  slug?: string;
  image_url?: string;
  is_featured: boolean;
  display_order: number;
  is_published: boolean;
  author_id?: string;
  author_name?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
}



export interface LogisticsProfile {
  id: string;
  company_name: string;
  service_areas: string[];
  vehicle_types: string[];
  base_rates?: string;
  certifications?: string;
  description?: string;
  contact_info?: Record<string, any>;
  is_accepting_requests?: boolean;
  created_at: string;
  updated_at: string;
}

export interface LogisticsRequest {
  id: string;
  sender_id: string;
  logistics_id: string;
  quote_data: any;
  status: 'pending' | 'responded' | 'rejected' | 'completed';
  user_note?: string;
  logistics_response?: string;
  created_at: string;
  updated_at: string;
}
