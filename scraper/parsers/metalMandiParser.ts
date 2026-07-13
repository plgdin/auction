import { supabase } from "../utils/storage.js";

export interface MetalMandiRate {
  id: string;
  metal_type: string;
  grade_name: string;
  price_per_kg: number;
  price_change_percent: number;
  updated_at: string;
}

export interface ScrapedRate {
  category: string;
  name: string;
  priceText: string;
  changeText: string;
}

function parsePrice(priceText: string): number | null {
  if (!priceText) return null;
  
  // Match ranges like "₹1197 - 1307 /kg" or "1197 - 1307"
  const rangeMatch = priceText.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const val1 = parseFloat(rangeMatch[1]);
    const val2 = parseFloat(rangeMatch[2]);
    if (!isNaN(val1) && !isNaN(val2)) {
      return (val1 + val2) / 2;
    }
  }
  
  // Match single price like "₹1179 /kg" or "₹1526"
  const singleMatch = priceText.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1]);
    if (!isNaN(val)) return val;
  }
  
  return null;
}

function parseChangePercent(changeText: string): number {
  if (!changeText) return 0.00;
  const match = changeText.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  if (match) {
    const val = parseFloat(match[1]);
    if (!isNaN(val)) return val;
  }
  return 0.00;
}

/**
 * Syncs MetalMandi rates to the database. Supports dynamic scraped rates
 * from browser evaluation, and falls back to baseline defaults if no rates are provided.
 */
export async function parseMetalMandiRates(scrapedRates?: ScrapedRate[] | string): Promise<MetalMandiRate[]> {
  const results: MetalMandiRate[] = [];
  const now = new Date().toISOString();

  // Baseline target legacy grades configuration for defaults & fallback compatibility
  const legacyConfig = [
    { name: 'MS Scrap(Old)', type: 'iron', minVal: 15, maxVal: 100, defaultVal: 35.00 },
    { name: 'Wire Scrap', type: 'copper', minVal: 400, maxVal: 1600, defaultVal: 650.00 },
    { name: 'Brass Scrap', type: 'brass', minVal: 250, maxVal: 1000, defaultVal: 420.00 },
    { name: 'Aluminium Scrap', type: 'aluminium', minVal: 100, maxVal: 350, defaultVal: 180.00 },
    { name: 'Lead Scrap', type: 'lead', minVal: 80, maxVal: 400, defaultVal: 150.00 }
  ];

  let ratesToProcess = scrapedRates;
  if (typeof scrapedRates === "string" && scrapedRates.trim().length > 0) {
    try {
      ratesToProcess = JSON.parse(scrapedRates);
    } catch (e: any) {
      console.error("[MetalMandi] Failed to parse scrapedRates string to JSON:", e.message);
      ratesToProcess = undefined;
    }
  }

  // If scraped rates are provided and it's an array of rates, we parse and sync them
  if (Array.isArray(ratesToProcess) && ratesToProcess.length > 0) {
    console.log(`[MetalMandi] Processing ${ratesToProcess.length} scraped rates dynamically...`);

    // 1. Process and upsert each dynamic rate
    for (const rate of ratesToProcess) {
      const price = parsePrice(rate.priceText);
      if (price === null || price <= 0) continue;

      const changePercent = parseChangePercent(rate.changeText);
      const metalType = rate.category.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
      const unit = rate.priceText.includes('/pcs') ? 'pcs' : 'kg';
      
      // If unit is pcs, append it to grade_name to distinguish from kg rates
      const gradeName = unit === 'pcs' ? `${rate.name.trim()} (pcs)` : rate.name.trim();
      const id = `metalmandi_${metalType}_${gradeName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${unit}`;

      const payload: MetalMandiRate = {
        id,
        metal_type: metalType,
        grade_name: gradeName,
        price_per_kg: price,
        price_change_percent: changePercent,
        updated_at: now
      };

      const { error } = await supabase
        .from('metalmandi_live_rates')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error(`[Supabase] Failed to sync dynamic rate ${gradeName}:`, error.message);
      } else {
        results.push(payload);
      }
    }

    console.log(`[MetalMandi] Synced ${results.length} dynamic rates successfully.`);

    // 2. Map and upsert the 5 legacy categories to maintain backward compatibility
    console.log('[MetalMandi] Updating legacy backward-compatible rates...');
    for (const legacy of legacyConfig) {
      let matchedPrice: number | null = null;
      let matchedChange = 0.00;

      if (legacy.name === 'MS Scrap(Old)') {
        // Map to Iron -> MS Scrap(Old)
        const match = ratesToProcess.find(r => r.category.toLowerCase() === 'iron' && r.name.toLowerCase().includes('ms scrap(old)'))
          || ratesToProcess.find(r => r.category.toLowerCase() === 'iron' && r.name.toLowerCase().includes('ms scrap'));
        if (match) {
          matchedPrice = parsePrice(match.priceText);
          matchedChange = parseChangePercent(match.changeText);
        }
      } else if (legacy.name === 'Wire Scrap') {
        // Legacy "Wire Scrap" was Copper Wire. Map to Copper -> Telewire or Copper -> CCR Rod
        const match = ratesToProcess.find(r => r.category.toLowerCase() === 'copper' && r.name.toLowerCase() === 'telewire')
          || ratesToProcess.find(r => r.category.toLowerCase() === 'copper' && r.name.toLowerCase().includes('wire'))
          || ratesToProcess.find(r => r.category.toLowerCase() === 'copper' && r.name.toLowerCase().includes('cc rod'));
        if (match) {
          matchedPrice = parsePrice(match.priceText);
          matchedChange = parseChangePercent(match.changeText);
        }
      } else if (legacy.name === 'Brass Scrap') {
        // Map to Brass -> Purja(AC) or any brass rate
        const match = ratesToProcess.find(r => r.category.toLowerCase() === 'brass' && r.name.toLowerCase().includes('purja'))
          || ratesToProcess.find(r => r.category.toLowerCase() === 'brass');
        if (match) {
          matchedPrice = parsePrice(match.priceText);
          matchedChange = parseChangePercent(match.changeText);
        }
      } else if (legacy.name === 'Aluminium Scrap') {
        // Map to Aluminium -> wire scrap, scrap, or fall back to aluminium spot
        const match = ratesToProcess.find(r => r.category.toLowerCase() === 'aluminium' && r.name.toLowerCase().includes('scrap'))
          || ratesToProcess.find(r => r.category.toLowerCase() === 'aluminium' && r.name.toLowerCase() === 'wire scrap')
          || ratesToProcess.find(r => r.category.toLowerCase() === 'aluminium' && r.name.toLowerCase() === 'aluminium spot');
        if (match) {
          matchedPrice = parsePrice(match.priceText);
          matchedChange = parseChangePercent(match.changeText);
        }
      } else if (legacy.name === 'Lead Scrap') {
        // Lead is not on page, look for category 'lead'
        const match = ratesToProcess.find(r => r.category.toLowerCase() === 'lead');
        if (match) {
          matchedPrice = parsePrice(match.priceText);
          matchedChange = parseChangePercent(match.changeText);
        }
      }

      // Apply sanity check guardrails to dynamic mapping
      let finalPrice = legacy.defaultVal;
      let isAnomaly = false;

      if (matchedPrice !== null) {
        if (matchedPrice >= legacy.minVal && matchedPrice <= legacy.maxVal) {
          finalPrice = matchedPrice;
        } else {
          isAnomaly = true;
          console.warn(
            `[Sanity Guardrail] Anomaly on legacy mapping ${legacy.name}: mapped price ₹${matchedPrice} ` +
            `is outside bounds [₹${legacy.minVal} - ₹${legacy.maxVal}]. Using default ₹${legacy.defaultVal}.`
          );
        }
      }

      const legacyPayload: MetalMandiRate = {
        id: `metalmandi_${legacy.type}_${legacy.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        metal_type: legacy.type,
        grade_name: legacy.name,
        price_per_kg: finalPrice,
        price_change_percent: matchedPrice !== null && !isAnomaly ? matchedChange : 0.00,
        updated_at: now
      };

      const { error } = await supabase
        .from('metalmandi_live_rates')
        .upsert(legacyPayload, { onConflict: 'id' });

      if (error) {
        console.error(`[Supabase] Failed to sync legacy rate ${legacy.name}:`, error.message);
      } else {
        console.log(`[MetalMandi] Synced legacy rate ${legacy.name} -> ₹${finalPrice}/kg${isAnomaly ? ' (Fallback Guardrail Applied)' : ''}`);
        results.push(legacyPayload);
      }
    }
  } else {
    // Fallback mode: upsert baseline legacy rates
    console.log('[MetalMandi] Running fallback mode. Syncing baseline legacy rates...');
    for (const legacy of legacyConfig) {
      const payload: MetalMandiRate = {
        id: `metalmandi_${legacy.type}_${legacy.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        metal_type: legacy.type,
        grade_name: legacy.name,
        price_per_kg: legacy.defaultVal,
        price_change_percent: 0.00,
        updated_at: now
      };

      const { error } = await supabase
        .from('metalmandi_live_rates')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error(`[Supabase] Failed to sync fallback legacy rate ${legacy.name}:`, error.message);
      } else {
        results.push(payload);
      }
    }
    console.log('[MetalMandi] Baseline fallback rates upserted.');
  }

  return results;
}
