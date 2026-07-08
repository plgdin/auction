import { supabase } from "../utils/storage.js";

export interface MetalMandiRate {
  id: string;
  metal_type: string;
  grade_name: string;
  price_per_kg: number;
  price_change_percent: number;
  updated_at: string;
}

/**
 * Extracts and parses scrap metal rates from HTML page content
 * and upserts them to the database with sanity guardrails.
 */
export async function parseMetalMandiRates(htmlContent: string): Promise<MetalMandiRate[]> {
  const cleanHtml = (htmlContent || '').replace(/<[^>]*>/g, ' '); // Strip HTML tags for regex-friendly text
  
  const targetGrades = [
    { name: 'MS Scrap(Old)', type: 'iron', keywords: [/ms\s*scrap\s*\(?old\)?/i, /iron\s*scrap\s*old/i, /heavy\s*melting\s*scrap/i, /hms/i], minVal: 15, maxVal: 80, defaultVal: 35.00 },
    { name: 'Wire Scrap', type: 'copper', keywords: [/wire\s*scrap/i, /copper\s*wire\s*scrap/i, /copper\s*wire/i, /copper\s*scrap/i], minVal: 400, maxVal: 1000, defaultVal: 650.00 },
    { name: 'Brass Scrap', type: 'brass', keywords: [/brass\s*scrap/i, /scrap\s*brass/i], minVal: 250, maxVal: 650, defaultVal: 420.00 },
    { name: 'Aluminium Scrap', type: 'aluminium', keywords: [/aluminium\s*scrap/i, /aluminum\s*scrap/i, /scrap\s*aluminium/i], minVal: 100, maxVal: 350, defaultVal: 180.00 },
    { name: 'Lead Scrap', type: 'lead', keywords: [/lead\s*scrap/i, /scrap\s*lead/i], minVal: 80, maxVal: 280, defaultVal: 150.00 }
  ];

  const results: MetalMandiRate[] = [];

  for (const grade of targetGrades) {
    let extractedPrice: number | null = null;
    
    // Scan text near matching keywords to parse rates (like "₹329 /kg" or "Rs. 30")
    for (const pattern of grade.keywords) {
      const matchIndex = cleanHtml.search(pattern);
      if (matchIndex !== -1) {
        // Extract a clean substring context starting from the matching keyword (look forward only)
        const context = cleanHtml.substring(
          matchIndex,
          Math.min(cleanHtml.length, matchIndex + 120)
        );
        
        // Match numbers following or preceding currency symbols, optional slash-kg
        const priceMatch = context.match(/(?:₹|Rs\.?|INR)?\s*(\d+(?:\.\d+)?)\s*(?:\/\s*kg|kg)?/i);
        if (priceMatch) {
          const val = parseFloat(priceMatch[1]);
          if (!isNaN(val) && val > 0) {
            extractedPrice = val;
            break;
          }
        }
      }
    }

    // SANITY GUARDRAILS: Anomaly detection checks
    let finalPrice = grade.defaultVal;
    let isAnomaly = false;

    if (extractedPrice !== null) {
      // Validate extracted price sits within realistic boundaries
      if (extractedPrice >= grade.minVal && extractedPrice <= grade.maxVal) {
        finalPrice = extractedPrice;
      } else {
        isAnomaly = true;
        console.warn(
          `[Sanity Guardrail] Anomaly detected: Scraped rate for ${grade.name} (₹${extractedPrice}/kg) ` +
          `is outside normal bounds [₹${grade.minVal} - ₹${grade.maxVal}]. Utilizing baseline rate (₹${grade.defaultVal}).`
        );
      }
    } else {
      console.info(`[Scraper] Spot rate pattern not found for ${grade.name}, utilizing default baseline rate.`);
    }

    const livePayload: MetalMandiRate = {
      id: `metalmandi_${grade.type}_${grade.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      metal_type: grade.type,
      grade_name: grade.name,
      price_per_kg: finalPrice,
      price_change_percent: 0.00,
      updated_at: new Date().toISOString()
    };

    // Upsert to the live metal rates table in Supabase
    const { error } = await supabase
      .from('metalmandi_live_rates')
      .upsert(livePayload, { onConflict: 'id' });

    if (error) {
      console.error(`[Supabase] Failed to sync MetalMandi rates for ${grade.name}:`, error.message);
    } else {
      console.log(`[MetalMandi] Synced rate for ${grade.name}: ₹${finalPrice}/kg${isAnomaly ? ' (Fallback Guardrail Applied)' : ''}`);
      results.push(livePayload);
    }
  }

  return results;
}
