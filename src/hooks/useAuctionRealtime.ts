// @ts-nocheck
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { auctionService } from '../services/auctionService';
import type { Auction } from '../types/database.types';

export function useAuctionRealtime(initialAuction: Auction) {
  const [auction, setAuction] = useState<Auction>(initialAuction);
  const [bids, setBids] = useState<any[]>([]);
  const [currentMaxBid, setCurrentMaxBid] = useState(0);

  useEffect(() => {
    let isMounted = true;

    // Load initial bid history
    const loadBids = async () => {
      const history = await auctionService.getBidHistory(initialAuction.id);
      if (isMounted) {
        setBids(history);
        if (history.length > 0) {
          setCurrentMaxBid(history[0].amount);
        }
      }
    };
    loadBids();

    // 1. Subscribe to Auction table updates (for end_time extensions and status changes)
    const auctionSubscription = supabase
      .channel(`auction_updates_${initialAuction.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${initialAuction.id}`
        },
        (payload) => {
          if (isMounted) {
            setAuction(prev => ({ ...prev, ...payload.new }));
          }
        }
      )
      .subscribe();

    // 2. Subscribe to Bids table inserts (for realtime highest bid updates)
    const bidsSubscription = supabase
      .channel(`bid_inserts_${initialAuction.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids',
          filter: `auction_id=eq.${initialAuction.id}`
        },
        async (payload) => {
          // payload.new is the new bid row. But it lacks the nested 'bidder' relation data.
          // We can fetch the history again to get the full joined data, or do a targeted fetch.
          // For safety and correctness of the list, we fetch the updated history.
          const newHistory = await auctionService.getBidHistory(initialAuction.id);
          if (isMounted) {
            setBids(newHistory);
            if (newHistory.length > 0) {
              setCurrentMaxBid(newHistory[0].amount);
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(auctionSubscription);
      supabase.removeChannel(bidsSubscription);
    };
  }, [initialAuction.id]);

  return { auction, bids, currentMaxBid };
}
