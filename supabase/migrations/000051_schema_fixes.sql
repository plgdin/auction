-- ============================================================================
-- Migration 00005: Schema Fixes
-- Resolves all frontend-backend mismatches identified in audit
-- ============================================================================

-- Fix 1: Add reference_number to auctions table
-- Used across AuctionCard, AuctionDetail, MyBids, Dashboard, Reminders
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100) UNIQUE;

-- Auto-populate reference numbers for any existing auctions so they aren't NULL
UPDATE auctions
SET reference_number = CONCAT('AUC-', UPPER(SUBSTRING(id::text, 1, 8)))
WHERE reference_number IS NULL;

-- Fix 2: Add winner_id to auctions table
-- Used in MyBids.tsx to detect won auctions
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix 3: Add status column to wallet_transactions
-- paymentService.getWalletBalance() filters by status = 'completed'
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed';

-- Fix 4: Change reference_id in wallet_transactions from UUID to TEXT
-- paymentService.processWalletDeposit() inserts a string like "MOCK-1718352000-123"
ALTER TABLE wallet_transactions ALTER COLUMN reference_id TYPE TEXT USING reference_id::TEXT;

-- Fix 5: Update the place_bid function to properly mark bids as 'winning'
-- and update the winning bid status when a new bid outbids everyone
CREATE OR REPLACE FUNCTION place_bid(
  p_auction_id UUID,
  p_bidder_id UUID,
  p_bid_amount DECIMAL
) RETURNS JSONB AS $$
DECLARE
  v_auction RECORD;
  v_current_max DECIMAL;
  v_new_end_time TIMESTAMP WITH TIME ZONE;
  v_result JSONB;
BEGIN
  -- 1. Lock the auction row for update to prevent concurrent bids from racing
  SELECT * INTO v_auction
  FROM auctions
  WHERE id = p_auction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;

  -- 2. Verify auction is active
  IF v_auction.status != 'active' THEN
    RAISE EXCEPTION 'Auction is not active';
  END IF;

  -- Verify time
  IF now() > v_auction.end_time THEN
    RAISE EXCEPTION 'Auction has already ended';
  END IF;

  -- 3. Get current max bid
  SELECT COALESCE(MAX(amount), 0) INTO v_current_max
  FROM bids
  WHERE auction_id = p_auction_id;

  -- 4. Validate bid amount
  IF v_current_max = 0 THEN
    -- First bid
    IF p_bid_amount < v_auction.starting_price THEN
      RAISE EXCEPTION 'Bid amount % is less than starting price %', p_bid_amount, v_auction.starting_price;
    END IF;
  ELSE
    -- Subsequent bids
    IF p_bid_amount < (v_current_max + v_auction.bid_increment) THEN
      RAISE EXCEPTION 'Bid amount must be at least %', (v_current_max + v_auction.bid_increment);
    END IF;
  END IF;

  -- 5. Mark all previous 'winning' or 'active' bids for this auction as 'outbid'
  UPDATE bids
  SET status = 'outbid'
  WHERE auction_id = p_auction_id
    AND status IN ('active', 'winning');

  -- 6. Insert the new highest bid as 'winning'
  INSERT INTO bids (auction_id, bidder_id, amount, status)
  VALUES (p_auction_id, p_bidder_id, p_bid_amount, 'winning');

  -- 7. Anti-Sniping Logic
  -- If bid is placed within the last 5 minutes, extend end_time by 5 minutes from now
  v_new_end_time := v_auction.end_time;
  IF extract(epoch from (v_auction.end_time - now())) < 300 THEN
    v_new_end_time := now() + interval '5 minutes';
    UPDATE auctions
    SET end_time = v_new_end_time
    WHERE id = p_auction_id;
  END IF;

  -- Build success result
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Bid placed successfully',
    'bid_amount', p_bid_amount,
    'end_time', v_new_end_time
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 6: Add a trigger to set winner_id on auctions when an auction closes
-- This marks the highest bidder as the winner when status changes to 'closed'
CREATE OR REPLACE FUNCTION set_auction_winner()
RETURNS TRIGGER AS $$
BEGIN
  -- When auction status changes to 'closed', find the highest bidder and set winner_id
  IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
    SELECT bidder_id INTO NEW.winner_id
    FROM bids
    WHERE auction_id = NEW.id
      AND status = 'winning'
    ORDER BY amount DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auction_closed
  BEFORE UPDATE ON auctions
  FOR EACH ROW
  EXECUTE PROCEDURE set_auction_winner();

-- Fix 7: Add RLS policy so admins can see all profiles
-- Admins need to read all profiles for the user management page
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
    )
  );

-- Fix 8: Add RLS so authenticated users can insert into watchlists and read their own
-- (May already work but ensures completeness)
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own watchlist"
  ON watchlists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow notifications: users can read their own
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own notifications read"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);
