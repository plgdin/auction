import { supabase } from '../lib/supabase';
import type { ContactMessage, FaqItem, Announcement, NewsUpdate } from '../types/database.types';
import {
  INVERTED_SYNONYM_MAP,
  CONCEPT_MAP,
  STOP_WORDS,
  GENERIC_KEYWORDS,
  getInflections,
  extractTokens,
  findClosestKeyword,
  parsePriceConstraint,
  cleanQueryFromPriceConstraint,
  filterCompoundComponents,
  matchWholeWord
} from './nlpSearchUtils';

export const publicService = {
  async submitContactMessage(messageData: Partial<ContactMessage>): Promise<boolean> {
    const { error } = await supabase
      .from('contact_messages')
      .insert([messageData]);

    if (error) {
      console.error('Error submitting contact message:', error);
      return false;
    }
    return true;
  },

  async getActiveFaqs(): Promise<FaqItem[]> {
    const { data, error } = await supabase
      .from('faq_items')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching FAQs:', error);
      return [];
    }
    return data;
  },

  async getActiveAnnouncements(limit: number = 5): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching announcements:', error);
      return [];
    }
    return data;
  },

  async getPublishedNews(limit: number = 10): Promise<NewsUpdate[]> {
    const { data, error } = await supabase
      .from('news_updates')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching news:', error);
      return [];
    }
    return data;
  }
};

export interface MstcSanitizedAuction {
  id: string;
  mstc_auction_number: string;
  seller_name: string;
  category_name: string;
  location: string;
  opening_date: string;
  closing_date: string;
  sanitized_document_path: string | null; // Masked path pointing exclusively to your Supabase cloud asset
  raw_materials_text: string | null;
  status: string;
}

const MAIN_CATEGORIES = [
  'Agricultural Produce',
  'Aquatic Produce',
  'Ash',
  'Chemicals',
  'Coal',
  'Container',
  'Diamond',
  'Electrical Items',
  'Electronics Items',
  'Forest Produce',
  'Immovable Property',
  'Liquor License Contracts',
  'Metal',
  'Mine Block',
  'Minerals',
  'Miscellaneous',
  'Petroleum Products',
  'Plant/Machineries',
  'Transport Vehicles',
  'Vessels'
];

function buildTaxonomy(data: MstcSanitizedAuction[]): {
  categoryKeywords: Record<string, string[]>;
  subcategoryKeywords: Record<string, string[]>;
} {
  const categoryKeywords: Record<string, string[]> = {};
  const subcategoryKeywords: Record<string, string[]> = {};

  // Seed with CONCEPT_MAP
  for (const [conceptWord, catList] of Object.entries(CONCEPT_MAP)) {
    categoryKeywords[conceptWord] = [...catList];
  }

  // Iterate over data to extract and map keywords from categories/subcategories
  for (const item of data) {
    if (!item.category_name) continue;
    const parts = item.category_name.split(' | ');
    const mainCategory = parts[0].trim();
    const subcategory = parts[1]?.trim();

    // 1. Process main category tokens
    const mainTokens = extractTokens(mainCategory);
    for (const token of mainTokens) {
      if (!categoryKeywords[token]) {
        categoryKeywords[token] = [];
      }
      if (!categoryKeywords[token].includes(mainCategory)) {
        categoryKeywords[token].push(mainCategory);
      }
    }

    // 2. Process subcategory tokens
    if (subcategory) {
      const subTokens = extractTokens(subcategory);
      for (const token of subTokens) {
        if (!subcategoryKeywords[token]) {
          subcategoryKeywords[token] = [];
        }
        if (!subcategoryKeywords[token].includes(mainCategory)) {
          subcategoryKeywords[token].push(mainCategory);
        }
      }
    }
  }

  return { categoryKeywords, subcategoryKeywords };
}

function estimateAuctionValues(item: MstcSanitizedAuction): { preBid: number; totalValue: number } {
  let preBid = 50000; // default fallback
  let totalValue = 500000; // default fallback (preBid * 10)
  
  const shortId = item.mstc_auction_number.split('/').pop() || item.id.substring(0, 8);
  const shortIdNum = parseInt(shortId, 10);
  if (!isNaN(shortIdNum)) {
    if (shortIdNum % 4 === 0) preBid = 100000;
    else if (shortIdNum % 4 === 1) preBid = 25000;
    else if (shortIdNum % 4 === 2) preBid = 150000;
    else preBid = 50000;
    totalValue = preBid * 10;
  }

  if (item.raw_materials_text) {
    try {
      const parsed = JSON.parse(item.raw_materials_text);
      if (parsed && typeof parsed === 'object') {
        let emdVal = parsed.depositDetails?.emd || '';
        let preBidDdg = parsed.depositDetails?.preBidDdg || '';
        
        let parsedPreBid = 0;
        const preBidClean = preBidDdg.replace(/,/g, '');
        const preBidMatch = preBidClean.match(/₹?\s*(\d+(\.\d+)?)/);
        if (preBidMatch) {
          parsedPreBid = parseFloat(preBidMatch[1]);
        }
        
        let emdPercent = 0.1; // fallback is 10%
        const emdMatch = emdVal.match(/([\d\.]+)\s*%/);
        if (emdMatch) {
          emdPercent = parseFloat(emdMatch[1]) / 100;
        }
        
        if (parsedPreBid > 100) {
          preBid = parsedPreBid;
          if (emdPercent > 0 && emdPercent <= 1) {
            totalValue = parsedPreBid / emdPercent;
          } else {
            totalValue = parsedPreBid * 10;
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  return { preBid, totalValue };
}

function expandQueryToTsQuery(query: string): string {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
    
  if (tokens.length === 0) return '';
  
  const expandedTokens = tokens.map(token => {
    const synonyms = INVERTED_SYNONYM_MAP[token];
    if (synonyms && synonyms.length > 0) {
      const cleanSynonyms = synonyms
        .map(s => s.replace(/[^a-z0-9]/g, ''))
        .filter(Boolean);
      return `(${[token, ...cleanSynonyms].join(' | ')})`;
    }
    const cleanToken = token.replace(/[^a-z0-9]/g, '');
    if (!cleanToken) return '';
    // Only use prefix matching wildcard for tokens with length >= 4 to avoid short word collisions (e.g., 'car' matching 'carton')
    return cleanToken.length >= 4 ? `${cleanToken}:*` : cleanToken;
  }).filter(Boolean);
  
  return expandedTokens.join(' & ');
}

export const MstcSearchService = {
  /**
   * Client-side layman search fallback when Supabase RPC is not deployed.
   */
  async searchClientSide(
    query: string,
    filters?: { category?: string; subcategory?: string; seller?: string; location?: string; startDate?: string; endDate?: string }
  ): Promise<MstcSanitizedAuction[]> {
    try {
      let queryBuilder = supabase
        .from('mstc_auctions')
        .select('*')
        .eq('asset_status', 'completed');

      if (filters?.category && filters?.subcategory) {
        queryBuilder = queryBuilder.eq('category_name', `${filters.category} | ${filters.subcategory}`);
      } else if (filters?.category) {
        queryBuilder = queryBuilder.ilike('category_name', `${filters.category} | %`);
      }
      
      if (filters?.seller) {
        queryBuilder = queryBuilder.eq('seller_name', filters.seller);
      }
      
      if (filters?.location) {
        queryBuilder = queryBuilder.eq('location', filters.location);
      }

      if (filters?.startDate) {
        queryBuilder = queryBuilder.gte('opening_date', filters.startDate);
      }
      if (filters?.endDate) {
        queryBuilder = queryBuilder.lte('opening_date', filters.endDate);
      }

      // Fetch items to apply client-side filtering and sorting
      const { data, error } = await queryBuilder
        .order('opening_date', { ascending: false })
        .limit(1000);

      if (error) throw error;
      if (!data) return [];

      if (!query) {
        return data as MstcSanitizedAuction[];
      }

      // Extract price constraint and clean query first
      const priceConstraint = parsePriceConstraint(query);
      const cleanedQuery = cleanQueryFromPriceConstraint(query);

      // Tokenize and normalize query (including compound expressions)
      const extractedTokensList = extractTokens(cleanedQuery);
      const rawTokens = filterCompoundComponents(extractedTokensList);

      if (rawTokens.length === 0) {
        return data as MstcSanitizedAuction[];
      }

      // 1. Build Taxonomy dynamically from search data
      const { categoryKeywords, subcategoryKeywords } = buildTaxonomy(data as MstcSanitizedAuction[]);

      // 2. Pre-build the set of all known keywords for typo correction
      const knownKeywords = new Set<string>();
      Object.keys(categoryKeywords).forEach(k => knownKeywords.add(k));
      Object.keys(subcategoryKeywords).forEach(k => knownKeywords.add(k));
      Object.keys(INVERTED_SYNONYM_MAP).forEach(k => knownKeywords.add(k));

      // Fuzzy correct raw tokens using dynamic known keywords
      const normalizedTokens = rawTokens.map(token => {
        if (STOP_WORDS.has(token)) {
          return token;
        }
        const closest = findClosestKeyword(token, knownKeywords);
        return closest || token;
      });

      // Filter tokens into Substantive and Optional
      const substantiveTokens: string[] = [];
      const optionalTokens: string[] = [];

      for (const token of normalizedTokens) {
        if (STOP_WORDS.has(token)) {
          continue;
        }
        const isSubstantive =
          (token in categoryKeywords ||
           token in subcategoryKeywords ||
           token in INVERTED_SYNONYM_MAP) &&
          !GENERIC_KEYWORDS.has(token);

        if (isSubstantive) {
          substantiveTokens.push(token);
        } else {
          optionalTokens.push(token);
        }
      }

      // Determine scoped categories based on query tokens (intent classification)
      const targetCategories = new Set<string>();
      const categoryScores = new Map<string, number>();

      // Prioritize substantive tokens for category classification
      const classificationTokens = substantiveTokens.length > 0 ? substantiveTokens : optionalTokens;

      for (const token of classificationTokens) {
        // Check the token and all of its synonyms to map target categories
        const synonyms = [token, ...(INVERTED_SYNONYM_MAP[token] || [])];
        for (const term of synonyms) {
          // 1. Check Category Level Keywords
          const catLevel = categoryKeywords[term];
          if (catLevel) {
            catLevel.forEach(c => {
              categoryScores.set(c, (categoryScores.get(c) || 0) + 40);
            });
          }

          // 2. Check Subcategory Level Keywords
          const subcatLevel = subcategoryKeywords[term];
          if (subcatLevel) {
            subcatLevel.forEach(c => {
              categoryScores.set(c, (categoryScores.get(c) || 0) + 20);
            });
          }

          // 3. Exact Category Name match
          for (const catName of MAIN_CATEGORIES) {
            if (catName.toLowerCase().includes(term)) {
              categoryScores.set(catName, (categoryScores.get(catName) || 0) + 100);
            }
          }
        }
      }

      // If we got category scores, find the ones with significant signal
      if (categoryScores.size > 0) {
        let maxScore = 0;
        for (const score of categoryScores.values()) {
          if (score > maxScore) maxScore = score;
        }

        for (const [catName, score] of categoryScores.entries()) {
          if (score >= 15 && score >= maxScore * 0.5) {
            targetCategories.add(catName);
          }
        }
      }

      const scoredData = data.map(item => {
        let score = 0;
        const category = item.category_name || '';
        const seller = item.seller_name || '';
        const num = item.mstc_auction_number || '';
        const rawText = item.raw_materials_text || '';
        const locationLower = (item.location || '').toLowerCase();

        const parts = category.split(' | ');
        const mainCategory = parts[0].trim();
        const subcategory = parts[1]?.trim() || category;

        // Apply price constraint filtering if present
        if (priceConstraint) {
          const { preBid, totalValue } = estimateAuctionValues(item);
          const compareVal = priceConstraint.field === 'pre_bid' ? preBid : totalValue;
          if (compareVal > 0) {
            if (priceConstraint.operator === 'less' && compareVal > priceConstraint.value) {
              return { item, score: 0 };
            }
            if (priceConstraint.operator === 'greater' && compareVal < priceConstraint.value) {
              return { item, score: 0 };
            }
            if (priceConstraint.operator === 'equal' && compareVal !== priceConstraint.value) {
              return { item, score: 0 };
            }
          }
        }

        // Scoping Check: If the search matches a distinct category intent, filter out all items from other categories
        if (targetCategories.size > 0) {
          if (!targetCategories.has(mainCategory)) {
            return { item, score: 0 };
          }
        }

        // A. Match Substantive Tokens strictly:
        let allSubstantiveMatched = true;

        for (const token of substantiveTokens) {
          let tokenMatched = false;

          // A1. Implicit Match for Category-Level Keywords:
          const inflections = getInflections(token);
          for (const inf of inflections) {
            const catLevel = categoryKeywords[inf];
            if (catLevel && catLevel.includes(mainCategory)) {
              score += 30; // Category level match bonus
              tokenMatched = true;
              break;
            }
          }

          // A2. Normal Text/Synonym Matching:
          if (!tokenMatched) {
            const terms = new Set<string>();
            for (const inf of inflections) {
              terms.add(inf);
              const synonyms = INVERTED_SYNONYM_MAP[inf];
              if (synonyms) {
                synonyms.forEach(s => terms.add(s));
              }
            }

            for (const term of terms) {
              if (matchWholeWord(subcategory, term)) {
                score += 15;
                tokenMatched = true;
                break;
              }
              if (matchWholeWord(seller, term) || matchWholeWord(num, term)) {
                score += 5;
                tokenMatched = true;
                break;
              }
              if (matchWholeWord(rawText, term)) {
                score += 3;
                tokenMatched = true;
                break;
              }
            }
          }

          if (!tokenMatched) {
            allSubstantiveMatched = false;
          }
        }

        // If substantive tokens were present and any of them failed to match, exclude this item
        if (substantiveTokens.length > 0 && !allSubstantiveMatched) {
          return { item, score: 0 };
        }

        // B. Match Optional Tokens for scoring boosts:
        for (const token of optionalTokens) {
          // Boost for matching location tag
          if (locationLower.includes(token)) {
            score += 100;
          }
          // Boost for matching in text
          if (
            matchWholeWord(subcategory, token) ||
            matchWholeWord(seller, token) ||
            matchWholeWord(num, token) ||
            matchWholeWord(rawText, token)
          ) {
            score += 15;
          }
        }

        // Boost if matches target category
        if (targetCategories.size > 0 && targetCategories.has(mainCategory)) {
          score += 50;
        }

        // If no substantive tokens matched (or none existed) and score is still 0, we can give a baseline score
        // to prevent filtering out items when there are no query terms left after stop words
        if (score === 0 && substantiveTokens.length === 0 && optionalTokens.length === 0) {
          score = 1;
        } else if (score === 0 && substantiveTokens.length === 0 && optionalTokens.length > 0) {
          // If query had only optional tokens and none matched, filter it out
          return { item, score: 0 };
        }

        return { item, score };
      });

      return scoredData
        .filter(d => d.score > 0)
        .sort((a, b) => b.score - a.score || new Date(b.item.opening_date).getTime() - new Date(a.item.opening_date).getTime())
        .map(d => d.item)
        .slice(0, 200) as MstcSanitizedAuction[];

    } catch (error) {
      console.error('Client-side layman search failed:', error);
      return [];
    }
  },

  /**
   * High-speed catalog search engine filtering through clean, deduplicated snapshots with Layman's search
   */
  async searchMarketplaceCatalog(
    query: string,
    filters?: { category?: string; subcategory?: string; seller?: string; location?: string; startDate?: string; endDate?: string }
  ): Promise<MstcSanitizedAuction[]> {
    try {
      const formattedQuery = query ? expandQueryToTsQuery(query) : '';

      const { data, error } = await supabase.rpc('search_mstc_catalog_v2', {
        p_search_query: formattedQuery || null,
        p_category_filter: filters?.category || null,
        p_subcategory_filter: filters?.subcategory || null,
        p_location_filter: filters?.location || null,
        p_seller_filter: filters?.seller || null,
        p_start_date: filters?.startDate || null,
        p_end_date: filters?.endDate || null
      });

      if (error) {
        // Handle RPC missing errors gracefully by falling back to client-side search
        if (error.code === 'P0001' || (error as any).status === 404 || error.message?.includes('does not exist')) {
          console.warn('RPC search_mstc_catalog_v2 not found in remote DB. Falling back to client-side search.');
          return MstcSearchService.searchClientSide(query, filters);
        }
        throw error;
      }
      return (data as MstcSanitizedAuction[]) || [];
    } catch (error) {
      console.warn('RPC search failed, falling back to client-side search:', error);
      return MstcSearchService.searchClientSide(query, filters);
    }
  },

  /**
   * Fetches unique filter options (State/Location, Category, Seller) from the database
   */
  async getMstcFilterOptions(): Promise<{
    categories: string[];
    subcategories: Record<string, string[]>;
    sellers: string[];
    locations: string[];
  }> {
    try {
      const { data, error } = await supabase
        .from('mstc_auctions')
        .select('category_name, seller_name, location')
        .eq('asset_status', 'completed'); // Match filter dropdown choices with visible completed catalogs
      
      if (error) throw error;
      
      const categories = new Set<string>();
      const subcategoriesMap: Record<string, Set<string>> = {};
      const sellers = new Set<string>();
      const locations = new Set<string>();
      
      data?.forEach(row => {
        if (row.category_name) {
          const parts = row.category_name.split(' | ');
          const cat = parts[0].trim();
          const sub = parts[1]?.trim();
          
          categories.add(cat);
          if (sub) {
            if (!subcategoriesMap[cat]) {
              subcategoriesMap[cat] = new Set<string>();
            }
            subcategoriesMap[cat].add(sub);
          }
        }
        if (row.seller_name) sellers.add(row.seller_name);
        if (row.location) locations.add(row.location);
      });

      const subcategories: Record<string, string[]> = {};
      for (const [cat, subSet] of Object.entries(subcategoriesMap)) {
        subcategories[cat] = Array.from(subSet).sort();
      }
      
      return {
        categories: Array.from(categories).sort(),
        subcategories,
        sellers: Array.from(sellers).sort(),
        locations: Array.from(locations).sort()
      };
    } catch (error) {
      console.error('Failed to fetch MSTC filter options:', error);
      return { categories: [], subcategories: {}, sellers: [], locations: [] };
    }
  },

  /**
   * Fetches similar/related MSTC auctions.
   * If there is an active search query, it pulls candidates from the search results.
   * If there is no active search query, it falls back to category matching.
   * Results are ranked by category, seller, location, and item keywords.
   */
  async getRelatedMstcAuctions(
    currentItem: MstcSanitizedAuction,
    searchQuery: string = '',
    limit: number = 4
  ): Promise<MstcSanitizedAuction[]> {
    try {
      let relatedItems: MstcSanitizedAuction[] = [];
      
      if (searchQuery) {
        // If there is an active search query, get matching items
        const results = await this.searchMarketplaceCatalog(searchQuery);
        relatedItems = results.filter(item => item.id !== currentItem.id);
      } else {
        // If no search query, match by category/subcategory
        const categoryParts = (currentItem.category_name || '').split(' | ');
        const mainCategory = categoryParts[0]?.trim();
        const subcategory = categoryParts[1]?.trim();
        
        const results = await this.searchMarketplaceCatalog('', {
          category: mainCategory || undefined,
          subcategory: subcategory || undefined
        });
        
        relatedItems = results.filter(item => item.id !== currentItem.id);
        
        // Relax subcategory if we have fewer items
        if (relatedItems.length < limit && mainCategory) {
          const mainResults = await this.searchMarketplaceCatalog('', {
            category: mainCategory || undefined
          });
          const extraItems = mainResults.filter(
            item => item.id !== currentItem.id && !relatedItems.some(r => r.id === item.id)
          );
          relatedItems = [...relatedItems, ...extraItems];
        }
      }
      
      // Compute similarity scores
      const currentKeywords = new Set<string>();
      if (currentItem.raw_materials_text) {
        try {
          const parsed = JSON.parse(currentItem.raw_materials_text);
          if (parsed && Array.isArray(parsed.items)) {
            parsed.items.forEach((row: any) => {
              const tokens = extractTokens(row.description || '');
              tokens.forEach(t => currentKeywords.add(t));
            });
          }
        } catch (e) {
          // ignore
        }
      }
      
      if (currentKeywords.size === 0 && currentItem.category_name) {
        extractTokens(currentItem.category_name).forEach(t => currentKeywords.add(t));
      }
      
      const currentCategoryParts = (currentItem.category_name || '').split(' | ');
      const currentMain = currentCategoryParts[0]?.trim() || '';
      const currentSub = currentCategoryParts[1]?.trim() || '';
      
      const scoredItems = relatedItems.map(item => {
        let score = 0;
        const parts = (item.category_name || '').split(' | ');
        const main = parts[0]?.trim() || '';
        const sub = parts[1]?.trim() || '';
        
        if (sub && sub === currentSub) score += 50;
        else if (main && main === currentMain) score += 20;
        
        if (item.seller_name === currentItem.seller_name) score += 30;
        if (item.location === currentItem.location) score += 20;
        
        if (currentKeywords.size > 0 && item.raw_materials_text) {
          try {
            const parsed = JSON.parse(item.raw_materials_text);
            if (parsed && Array.isArray(parsed.items)) {
              parsed.items.forEach((row: any) => {
                const desc = (row.description || '').toLowerCase();
                currentKeywords.forEach(keyword => {
                  if (matchWholeWord(desc, keyword)) {
                    score += 10;
                  }
                });
              });
            }
          } catch (e) {
            // ignore
          }
        }
        
        return { item, score };
      });
      
      scoredItems.sort(
        (a, b) => b.score - a.score || new Date(b.item.opening_date).getTime() - new Date(a.item.opening_date).getTime()
      );
      
      return scoredItems.map(si => si.item).slice(0, limit);
    } catch (error) {
      console.error('Error getting related MSTC auctions:', error);
      return [];
    }
  },

  /**
   * Fetches verified, fully processed feeds for consultant analytics modules
   */
  async fetchVerifiedConsultantFeed(limitCount: number = 15): Promise<MstcSanitizedAuction[]> {
    try {
      const { data, error } = await supabase
          .from('mstc_auctions')
          .select('*')
          .eq('asset_status', 'completed') // Guarantees consultants only view rows with ready, uncorrupted local files
          .order('opening_date', { ascending: false })
          .limit(limitCount);

      if (error) throw error;
      return (data as MstcSanitizedAuction[]) || [];
    } catch (error) {
      console.error('Failed processing analytics baseline query maps:', error);
      return [];
    }
  }
};

