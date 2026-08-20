import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';

export type AuctionTypeKey =
  | 'mstc'
  | 'baanknet'
  | 'gem_bids'
  | 'gem_auctions'
  | 'gem_pbp'
  | 'custom';

export interface AuctionTypeDefinition {
  key: AuctionTypeKey;
  label: string;
  shortLabel: string;
  description: string;
  colorClass: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const ALL_AUCTION_TYPES: AuctionTypeDefinition[] = [
  {
    key: 'mstc',
    label: 'MSTC Industrial & Scrap Auctions',
    shortLabel: 'MSTC',
    description: 'Scrap, minerals, vehicles, and industrial e-auctions from MSTC India.',
    colorClass: 'text-sky-700 bg-sky-50 border-sky-200',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    badgeBorder: 'border-sky-200',
  },
  {
    key: 'baanknet',
    label: 'BaankNet Banking & SARFAESI Auctions',
    shortLabel: 'BaankNet',
    description: 'Bank-seized real estate, commercial assets, and IBC insolvency auctions.',
    colorClass: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200',
  },
  {
    key: 'gem_bids',
    label: 'GeM Procurement Bids & RFPs',
    shortLabel: 'GeM Bids',
    description: 'Central and state government procurement bids and reverse auctions.',
    colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
  },
  {
    key: 'gem_auctions',
    label: 'GeM Forward Disposal Auctions',
    shortLabel: 'GeM Auctions',
    description: 'Government forward asset disposal and commercial lot auctions.',
    colorClass: 'text-purple-700 bg-purple-50 border-purple-200',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
  },
  {
    key: 'gem_pbp',
    label: 'GeM Product PBP Notices',
    shortLabel: 'GeM PBP',
    description: 'Push Button Procurement demand notices from government buyers.',
    colorClass: 'text-amber-700 bg-amber-50 border-amber-200',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
  },
  {
    key: 'custom',
    label: 'Direct Platform Auctions',
    shortLabel: 'Direct Auctions',
    description: 'Direct seller listings, scrap metal lots, and verified supplier auctions.',
    colorClass: 'text-slate-700 bg-slate-50 border-slate-200',
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
  },
];

/**
 * Hook to evaluate whether the currently logged-in user has permission to access a specific auction type.
 */
export function useAuctionAccess() {
  const { profile, isAuthenticated } = useAuthStore();

  const isAdmin = useMemo(() => {
    return profile?.role === 'admin' || (profile?.role as any) === 'superadmin';
  }, [profile?.role]);

  const allowedTypes = useMemo<string[]>(() => {
    if (isAdmin) {
      return ALL_AUCTION_TYPES.map((t) => t.key);
    }
    if (profile && Array.isArray((profile as any).allowed_auction_types)) {
      return (profile as any).allowed_auction_types;
    }
    // Default fallback: Standard users only have access to MSTC by default
    return ['mstc'];
  }, [isAdmin, profile]);

  const hasAccess = (typeKey: AuctionTypeKey | string): boolean => {
    if (isAdmin) return true;
    if (!isAuthenticated) return false;
    return allowedTypes.includes(typeKey);
  };

  return {
    isAdmin,
    isAuthenticated,
    allowedTypes,
    hasAccess,
  };
}
