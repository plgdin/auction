CREATE OR REPLACE FUNCTION suggest_search_correction(p_query TEXT)
RETURNS TEXT AS $$
DECLARE
  v_word TEXT;
  v_corrected_query TEXT := '';
  v_best_match TEXT;
  v_synonym TEXT;
BEGIN
  -- Split query into words
  FOR v_word IN SELECT unnest(string_to_array(lower(p_query), ' ')) LOOP
    
    -- 1. Check Synonym Table first
    SELECT expansion INTO v_synonym FROM search_synonyms WHERE abbreviation = v_word;
    
    IF v_synonym IS NOT NULL THEN
      v_corrected_query := v_corrected_query || ' ' || v_synonym;
      CONTINUE;
    END IF;

    -- 2. Fuzzy match against search_dictionary (pg_trgm) ONLY for words > 3 chars
    IF length(v_word) > 3 THEN
      SELECT word INTO v_best_match
      FROM search_dictionary
      ORDER BY word <-> v_word
      LIMIT 1;

      -- If distance is close enough (similarity > 0.4 usually means distance < 0.6)
      IF v_best_match IS NOT NULL AND (v_best_match <-> v_word) < 0.6 THEN
        v_corrected_query := v_corrected_query || ' ' || v_best_match;
      ELSE
        v_corrected_query := v_corrected_query || ' ' || v_word;
      END IF;
    ELSE
      v_corrected_query := v_corrected_query || ' ' || v_word;
    END IF;
  END LOOP;

  RETURN trim(v_corrected_query);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
