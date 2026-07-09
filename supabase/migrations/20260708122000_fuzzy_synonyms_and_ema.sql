-- Migration: Real-Time EMA Pricing Trigger & Phrase-Level Synonym Mapping
-- 1. Create category_stats table for tracking running EMAs
-- 2. Create trigger function and trigger for bids
-- 3. Insert synonym phrases (HMS, Heavy Melting Scrap, etc.)
-- 4. Upgrade suggest_search_correction to perform phrase-level synonym resolution first

-- 1. Create category_stats table
CREATE TABLE IF NOT EXISTS public.category_stats (
    category_name TEXT PRIMARY KEY,
    current_ema_price NUMERIC NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for category_stats
ALTER TABLE public.category_stats ENABLE ROW LEVEL SECURITY;

-- Allow public read access to category_stats
CREATE POLICY "Allow read access to category_stats" ON public.category_stats
    FOR SELECT USING (true);

-- 2. Trigger Function for Real-Time EMA Calculation
CREATE OR REPLACE FUNCTION public.update_category_ema_price()
RETURNS TRIGGER AS $$
DECLARE
  v_category_name TEXT;
  v_old_ema NUMERIC;
  v_new_ema NUMERIC;
  v_alpha CONSTANT NUMERIC := 0.1; -- Smoothing factor (10% weight to new bids)
BEGIN
  -- Retrieve parent category name of the auction the bid is placed on
  SELECT c.name INTO v_category_name
  FROM public.auctions a
  JOIN public.auction_categories c ON a.category_id = c.id
  WHERE a.id = NEW.auction_id;

  IF v_category_name IS NULL THEN
    v_category_name := 'Uncategorized';
  END IF;

  -- Get current EMA price
  SELECT current_ema_price INTO v_old_ema
  FROM public.category_stats
  WHERE category_name = v_category_name;

  IF v_old_ema IS NULL THEN
    -- First bid, initialize EMA
    v_new_ema := NEW.amount;
    INSERT INTO public.category_stats (category_name, current_ema_price, last_updated)
    VALUES (v_category_name, v_new_ema, NOW())
    ON CONFLICT (category_name) 
    DO UPDATE SET current_ema_price = EXCLUDED.current_ema_price, last_updated = NOW();
  ELSE
    -- Compute dynamic EMA
    v_new_ema := v_alpha * NEW.amount + (1 - v_alpha) * v_old_ema;
    UPDATE public.category_stats
    SET current_ema_price = v_new_ema, last_updated = NOW()
    WHERE category_name = v_category_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run after inserting a bid
DROP TRIGGER IF EXISTS trg_update_category_ema_price ON public.bids;
CREATE TRIGGER trg_update_category_ema_price
AFTER INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.update_category_ema_price();


-- 3. Populate Search Synonyms (with HMS, Heavy Melting Scrap, etc.)
INSERT INTO public.search_synonyms (abbreviation, expansion) VALUES
    ('hms', 'steel / iron scrap'),
    ('heavy melting scrap', 'steel / iron scrap'),
    ('iron scrap old', 'steel / iron scrap'),
    ('ms scrap', 'steel / iron scrap'),
    ('scrap iron', 'steel / iron scrap'),
    ('scrap steel', 'steel / iron scrap'),
    ('copper wire', 'copper'),
    ('wire scrap', 'cable_wire'),
    ('battery scrap', 'battery'),
    ('scrap battery', 'battery'),
    ('ss', 'stainless steel'),
    ('al', 'aluminium'),
    ('alu', 'aluminium'),
    ('pb', 'lead'),
    ('zn', 'zinc'),
    ('gi', 'galvanized iron')
ON CONFLICT (abbreviation) DO UPDATE SET expansion = EXCLUDED.expansion;


-- 4. Upgrade suggest_search_correction to perform phrase-level synonym check first
CREATE OR REPLACE FUNCTION public.suggest_search_correction(p_query TEXT)
RETURNS TEXT AS $$
DECLARE
  v_synonym RECORD;
  v_word TEXT;
  v_corrected_query TEXT := '';
  v_best_match TEXT;
  v_temp_query TEXT := lower(p_query);
BEGIN
  -- First replace all matching synonym phrases/abbreviations (phrase-level replacement)
  FOR v_synonym IN SELECT abbreviation, expansion FROM public.search_synonyms LOOP
    -- Using regexp_replace to match word boundaries for the abbreviation
    v_temp_query := regexp_replace(v_temp_query, '\b' || regexp_replace(v_synonym.abbreviation, '([.|\(\)\[\]\+])', '\\\1', 'g') || '\b', v_synonym.expansion, 'gi');
  END LOOP;

  -- Split remainder query into words and check dictionary fuzzy matching
  FOR v_word IN SELECT unnest(string_to_array(v_temp_query, ' ')) LOOP
    IF v_word = '' THEN 
      CONTINUE; 
    END IF;
    
    -- Fuzzy match against search_dictionary (pg_trgm, alpha words only)
    SELECT word INTO v_best_match
    FROM public.search_dictionary
    WHERE word ~ '^[a-z]+$'
    ORDER BY word <-> v_word
    LIMIT 1;

    -- Relaxed threshold (0.75) to catch transposition typos like cusotms→customs
    IF v_best_match IS NOT NULL AND (v_best_match <-> v_word) < 0.75 THEN
      v_corrected_query := v_corrected_query || ' ' || v_best_match;
    ELSE
      v_corrected_query := v_corrected_query || ' ' || v_word;
    END IF;
  END LOOP;

  RETURN trim(v_corrected_query);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
