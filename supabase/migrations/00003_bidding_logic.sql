-- Function to place a bid securely with anti-sniping logic
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

  -- 5. Insert the bid
  INSERT INTO bids (auction_id, bidder_id, amount, status)
  VALUES (p_auction_id, p_bidder_id, p_bid_amount, 'active');

  -- Update previous highest bid to 'outbid' if it exists
  UPDATE bids
  SET status = 'outbid'
  WHERE auction_id = p_auction_id 
    AND id != (SELECT id FROM bids WHERE auction_id = p_auction_id ORDER BY created_at DESC LIMIT 1)
    AND status = 'active';

  -- 6. Anti-Sniping Logic
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
    -- Build error result
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
