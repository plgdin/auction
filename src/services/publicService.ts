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

const MSTC_OFFICE_MAP: Record<string, string> = {
  // Main/Regional MSTC Offices & Branches
  'BBR': 'Bhubaneswar',
  'BLR': 'Bengaluru',
  'BPL': 'Bhopal',
  'CDG': 'Chandigarh',
  'ERO': 'Eastern Regional Office (Kolkata)',
  'GHY': 'Guwahati',
  'HYD': 'Hyderabad',
  'JPR': 'Jaipur',
  'LKO': 'Lucknow',
  'NRO': 'Northern Regional Office (Delhi)',
  'SRO': 'Southern Regional Office (Chennai)',
  'WRO': 'Western Regional Office (Mumbai)',
  'TVC': 'Trivandrum Central',
  'VSP': 'Visakhapatnam',
  'VZG': 'Visakhapatnam (Vizag)',
  'PTN': 'Patna',
  'VAD': 'Vadodara',
  'CO': 'Corporate Office',
  'KOC': 'Kochi',
  'VIZ': 'Vizag',
  'RNC': 'Ranchi',
  'RPR': 'Raipur',
  'DDN': 'Dehradun',
  'VZ': 'Visakhapatnam (Vizag)',

  // Extended Potential Office & City Codes (IATA / Common Abbreviations)
  'AMD': 'Ahmedabad',
  'PNE': 'Pune',
  'PNQ': 'Pune',
  'NGP': 'Nagpur',
  'NAG': 'Nagpur',
  'GOA': 'Goa',
  'JMU': 'Jammu',
  'SXR': 'Srinagar',
  'SGR': 'Srinagar',
  'SML': 'Shimla',
  'IMF': 'Imphal',
  'SHL': 'Shillong',
  'ITR': 'Itanagar',
  'KOH': 'Kohima',
  'AJL': 'Aizawl',
  'IXA': 'Agartala',
  'GTK': 'Gangtok',
  'IXZ': 'Port Blair',
  'JBP': 'Jabalpur',
  'IDR': 'Indore',
  'GWL': 'Gwalior',
  'KNP': 'Kanpur',
  'ALD': 'Prayagraj (Allahabad)',
  'VNS': 'Varanasi',
  'AGR': 'Agra',
  'MRT': 'Meerut',
  'GZB': 'Ghaziabad',
  'NDA': 'Noida',
  'FDB': 'Faridabad',
  'GGN': 'Gurugram (Gurgaon)',
  'LDH': 'Ludhiana',
  'ATQ': 'Amritsar',
  'JAL': 'Jalandhar',
  'PTL': 'Patiala',
  'BUP': 'Bathinda',
  'SLD': 'Shimla',
  'SOL': 'Solan',
  'DHS': 'Dharamshala',
  'LEH': 'Leh',
  'JDQ': 'Jodhpur',
  'UDR': 'Udaipur',
  'KOT': 'Kota',
  'BKN': 'Bikaner',
  'AJM': 'Ajmer',
  'ALW': 'Alwar',
  'BHL': 'Bhilwara',
  'SIK': 'Sikar',
  'SRT': 'Surat',
  'RAJ': 'Rajkot',
  'BHV': 'Bhavnagar',
  'JGA': 'Jamnagar',
  'JND': 'Junagadh',
  'GDN': 'Gandhinagar',
  'AND': 'Anand',
  'NDD': 'Nadiad',
  'MSN': 'Mehsana',
  'BHQ': 'Bharuch',
  'VLD': 'Valsad',
  'VAP': 'Vapi',
  'MRB': 'Morbi',
  'BHJ': 'Bhuj',
  'GDM': 'Gandhidham',
  'PBD': 'Porbandar',
  'VRL': 'Veraval',
  'AML': 'Amreli',
  'SUN': 'Surendranagar',
  'PLP': 'Palanpur',
  'GDH': 'Godhra',
  'DHD': 'Dahod',
  'VYR': 'Vyara',
  'AHW': 'Ahwa',
  'SIL': 'Silvassa',
  'DAM': 'Daman',
  'DIU': 'Diu',
  'PNJ': 'Panaji',
  'MDG': 'Madgaon',
  'VDG': 'Vasco da Gama',
  'BOM': 'Mumbai',
  'MUM': 'Mumbai',
  'NVM': 'Navi Mumbai',
  'THN': 'Thane',
  'KLY': 'Kalyan',
  'DBL': 'Dombivli',
  'ULN': 'Ulhasnagar',
  'BWD': 'Bhiwandi',
  'MBA': 'Mira-Bhayandar',
  'VVR': 'Vasai-Virar',
  'PCW': 'Pimpri-Chinchwad',
  'ISK': 'Nashik',
  'NSK': 'Nashik',
  'IXU': 'Aurangabad',
  'AUB': 'Aurangabad',
  'SSL': 'Solapur',
  'SLP': 'Solapur',
  'AMR': 'Amravati',
  'AMV': 'Amravati',
  'NDC': 'Nanded',
  'NND': 'Nanded',
  'KHP': 'Kolhapur',
  'KLP': 'Kolhapur',
  'SGL': 'Sangli',
  'SNG': 'Sangli',
  'JLG': 'Jalgaon',
  'AKL': 'Akola',
  'AKO': 'Akola',
  'LTR': 'Latur',
  'DHL': 'Dhule',
  'ANG': 'Ahmednagar',
  'ANR': 'Ahmednagar',
  'CND': 'Chandrapur',
  'CHA': 'Chandrapur',
  'PRB': 'Parbhani',
  'ICH': 'Ichalkaranji',
  'JLN': 'Jalna',
  'AMB': 'Ambarnath',
  'BSL': 'Bhusawal',
  'PNV': 'Panvel',
  'RTN': 'Ratnagiri',
  'RTG': 'Ratnagiri',
  'SND': 'Sindhudurg',
  'SDU': 'Sindhudurg',
  'STR': 'Satara',
  'WRD': 'Wardha',
  'YVT': 'Yavatmal',
  'YAV': 'Yavatmal',
  'GND': 'Gondia',
  'GON': 'Gondia',
  'BHN': 'Bhandara',
  'GDC': 'Gadchiroli',
  'GAD': 'Gadchiroli',
  'HNG': 'Hingoli',
  'WSM': 'Washim',
  'BLD': 'Buldhana',
  'BUL': 'Buldhana',
  'NDB': 'Nandurbar',
  'RGD': 'Raigad',
  'ALB': 'Alibag',
  'BED': 'Beed',
  'OSM': 'Osmanabad',
  'MAA': 'Chennai',
  'CBI': 'Coimbatore',
  'CBE': 'Coimbatore',
  'CJB': 'Coimbatore',
  'IXM': 'Madurai',
  'MDU': 'Madurai',
  'TRZ': 'Trichy',
  'TRY': 'Trichy',
  'SXV': 'Salem',
  'SLM': 'Salem',
  'TUP': 'Tiruppur',
  'TPR': 'Tiruppur',
  'ERD': 'Erode',
  'VEL': 'Vellore',
  'TNY': 'Tirunelveli',
  'TNV': 'Tirunelveli',
  'TUT': 'Thoothukudi',
  'TTC': 'Thoothukudi',
  'NGL': 'Nagercoil',
  'TJV': 'Thanjavur',
  'DDL': 'Dindigul',
  'DGL': 'Dindigul',
  'RNP': 'Ranipet',
  'SVK': 'Sivakasi',
  'KRR': 'Karur',
  'UAM': 'Ooty (Udhagamandalam)',
  'KCP': 'Kanchipuram',
  'TVL': 'Tiruvallur',
  'CPT': 'Chengalpattu',
  'CUD': 'Cuddalore',
  'VPM': 'Villupuram',
  'KLC': 'Kallakurichi',
  'TVM': 'Tiruvannamalai',
  'TPTR': 'Tirupathur',
  'KGI': 'Krishnagiri',
  'DPI': 'Dharmapuri',
  'NMK': 'Namakkal',
  'NLG': 'Nilgiris',
  'PBL': 'Perambalur',
  'ALR': 'Ariyalur',
  'PDK': 'Pudukkottai',
  'TVR': 'Tiruvarur',
  'MYD': 'Mayiladuthurai',
  'TNI': 'Theni',
  'VDN': 'Virudhunagar',
  'SVG': 'Sivaganga',
  'RMD': 'Ramanathapuram',
  'TKS': 'Tenkasi',
  'KKM': 'Kanniyakumari',
  'PUD': 'Puducherry',
  'SBC': 'Bengaluru',
  'MYS': 'Mysore',
  'IXE': 'Mangaluru',
  'HBX': 'Hubballi-Dharwad',
  'IXG': 'Belagavi',
  'BGM': 'Belagavi',
  'GBG': 'Kalaburagi (Gulbarga)',
  'GLB': 'Kalaburagi (Gulbarga)',
  'DVG': 'Davanagere',
  'BYI': 'Ballari (Bellary)',
  'BLY': 'Ballari (Bellary)',
  'SMG': 'Shivamogga (Shimoga)',
  'TKR': 'Tumakuru (Tumkur)',
  'UDP': 'Udupi',
  'HSN': 'Hassan',
  'BDR': 'Bidar',
  'BJP': 'Vijayapura (Bijapur)',
  'RCR': 'Raichur',
  'RCH': 'Raichur',
  'BGK': 'Bagalkote',
  'KLR': 'Kolar',
  'MND': 'Mandya',
  'CRN': 'Chamarajanagar',
  'RMN': 'Ramanagara',
  'CBP': 'Chikkaballapur',
  'CTA': 'Chitradurga',
  'CKM': 'Chikmagalur',
  'DKN': 'Dakshina Kannada',
  'UKN': 'Uttara Kannada',
  'DWD': 'Dharwad',
  'GDG': 'Gadag',
  'HVR': 'Haveri',
  'YDG': 'Yadgir',
  'KPL': 'Koppal',
  'WGL': 'Warangal',
  'NZB': 'Nizamabad',
  'KMR': 'Karimnagar',
  'KHM': 'Khammam',
  'MBN': 'Mahabubnagar',
  'ADB': 'Adilabad',
  'MDK': 'Medak',
  'SRD': 'Sangareddy',
  'SDP': 'Siddipet',
  'KMD': 'Kamareddy',
  'BDN': 'Bodhan',
  'JGT': 'Jagtial',
  'MNCL': 'Mancherial',
  'KGD': 'Kothagudem',
  'SRP': 'Suryapet',
  'MRG': 'Miryalaguda',
  'WNP': 'Wanaparthy',
  'GDW': 'Gadwal',
  'NGK': 'Nagarkurnool',
  'VKB': 'Vikarabad',
  'TDR': 'Tandur',
  'BNG': 'Yadadri Bhuvanagiri',
  'JNG': 'Jangaon',
  'MHB': 'Mahabubabad',
  'BPP': 'Jayashankar Bhupalpally',
  'MLG': 'Mulugu',
  'NRM': 'Nirmal',
  'ASF': 'Kumuram Bheem Asifabad',
  'PDP': 'Peddapalli',
  'SRC': 'Rajanna Sircilla',
  'MDC': 'Medchal',
  'MKG': 'Malkajgiri',
  'RRD': 'Rangareddy',
  'VGA': 'Vijayawada',
  'VJW': 'Vijayawada',
  'GNT': 'Guntur',
  'NLR': 'Nellore',
  'KNL': 'Kurnool',
  'RJY': 'Rajahmundry',
  'KKI': 'Kakinada',
  'KKD': 'Kakinada',
  'TPT': 'Tirupati',
  'CDP': 'Kadapa',
  'ATP': 'Anantapur',
  'ELR': 'Eluru',
  'OGL': 'Ongole',
  'VZM': 'Vizianagaram',
  'VZN': 'Vizianagaram',
  'SKL': 'Srikakulam',
  'SKM': 'Srikakulam',
  'BMV': 'Bhimavaram',
  'BVM': 'Bhimavaram',
  'MPL': 'Madanapalle',
  'NDY': 'Nandyal',
  'TNL': 'Tenali',
  'PRD': 'Proddatur',
  'ADN': 'Adoni',
  'CTR': 'Chittoor',
  'MPT': 'Machilipatnam',
  'HDP': 'Hindupur',
  'GTL': 'Guntakal',
  'DVM': 'Dharmavaram',
  'TDP': 'Tadpatri',
  'KDR': 'Kadiri',
  'RCT': 'Rayachoty',
  'SKH': 'Srikalahasti',
  'GDR': 'Gudur',
  'KVL': 'Kavali',
  'SYK': 'Singarayakonda',
  'CRL': 'Chirala',
  'BPT': 'Bapatla',
  'NSP': 'Narasaraopet',
  'GDV': 'Gudivada',
  'TPG': 'Tadepalligudem',
  'TNK': 'Tanuku',
  'SMT': 'Samalkot',
  'AMP': 'Amalapuram',
  'TUN': 'Tuni',
  'AKP': 'Anakapalle',
  'PVP': 'Parvathipuram',
  'COK': 'Kochi',
  'CCJ': 'Kozhikode',
  'TCR': 'Thrissur',
  'QLN': 'Kollam',
  'ALP': 'Alappuzha',
  'PGD': 'Palakkad',
  'KTM': 'Kottayam',
  'MLP': 'Malappuram',
  'CNN': 'Kannur',
  'KSG': 'Kasaragod',
  'WYD': 'Wayanad',
  'IDK': 'Idukki',
  'PTA': 'Pathanamthitta',
  'EKM': 'Ernakulam',
  'TRV': 'Thiruvananthapuram',
  'BBI': 'Bhubaneswar',
  'CTC': 'Cuttack',
  'RKL': 'Rourkela',
  'SBP': 'Sambalpur',
  'PRI': 'Puri',
  'BLS': 'Balasore',
  'BDK': 'Bhadrak',
  'BPD': 'Baripada',
  'JSG': 'Jharsuguda',
  'BRG': 'Bargarh',
  'BLG': 'Balangir',
  'JYP': 'Jeypore',
  'KPT': 'Koraput',
  'BAM': 'Berhampur',
  'CAP': 'Chatrapur',
  'PLB': 'Phulbani',
  'NYG': 'Nayagarh',
  'KRD': 'Khordha',
  'JSP': 'Jagatsinghpur',
  'KDP': 'Kendrapara',
  'JJP': 'Jajpur',
  'DNK': 'Dhenkanal',
  'AGL': 'Angul',
  'TLC': 'Talcher',
  'KJR': 'Keonjhar',
  'BBL': 'Barbil',
  'SDG': 'Sundargarh',
  'DGH': 'Deogarh',
  'SNP': 'Sonepur',
  'NPD': 'Nuapada',
  'KLH': 'Kalahandi',
  'NBP': 'Nabarangpur',
  'BSP': 'Bilaspur',
  'DRG': 'Durg',
  'KRB': 'Korba',
  'RJN': 'Rajnandgaon',
  'JGD': 'Jagdalpur',
  'ABP': 'Ambikapur',
  'RGH': 'Raigarh',
  'DMT': 'Dhamtari',
  'BMT': 'Bemetara',
  'KBD': 'Kabirdham',
  'KWD': 'Kawardha',
  'JJG': 'Janjgir',
  'CMP': 'Champa',
  'SKT': 'Sakti',
  'KRY': 'Koriya',
  'SRJ': 'Surajpur',
  'KNK': 'Kanker',
  'KDG': 'Kondagaon',
  'NYP': 'Narayanpur',
  'DTW': 'Dantewada',
  'IXW': 'Jamshedpur',
  'JSR': 'Jamshedpur',
  'DBD': 'Dhanbad',
  'BKR': 'Bokaro',
  'HZB': 'Hazaribagh',
  'GRD': 'Giridih',
  'DGR': 'Deoghar',
  'DMK': 'Dumka',
  'SBG': 'Sahibganj',
  'PKR': 'Pakur',
  'GDD': 'Godda',
  'JMT': 'Jamtara',
  'LTH': 'Latehar',
  'PLM': 'Palamu',
  'DLT': 'Daltonganj',
  'GRW': 'Garhwa',
  'GML': 'Gumla',
  'LHD': 'Lohardaga',
  'SMD': 'Simdega',
  'KNT': 'Khunti',
  'RMG': 'Ramgarh',
  'PAT': 'Patna',
  'GAY': 'Gaya',
  'BGP': 'Bhagalpur',
  'MFP': 'Muzaffarpur',
  'DBG': 'Darbhanga',
  'PRN': 'Purnia',
  'ARA': 'Arrah',
  'BGS': 'Begusarai',
  'MNG': 'Munger',
  'SHS': 'Saharsa',
  'BET': 'Bettiah',
  'MOT': 'Motihari',
  'HJP': 'Hajipur',
  'SSR': 'Sasaram',
  'DHR': 'Dehri',
  'BXR': 'Buxar',
  'SWN': 'Siwan',
  'GPL': 'Gopalganj',
  'CPR': 'Chapra',
  'STM': 'Sitamarhi',
  'MDB': 'Madhubani',
  'SMS': 'Samastipur',
  'LKS': 'Lakhisarai',
  'SKP': 'Sheikhpura',
  'JMI': 'Jamui',
  'NLD': 'Nalanda',
  'BHS': 'Biharsharif',
  'NWD': 'Nawada',
  'JHB': 'Jehanabad',
  'ARW': 'Arwal',
  'ECM': 'East Champaran',
  'WCM': 'West Champaran',
  'SHR': 'Sheohar',
  'BNK': 'Banka',
  'SPL': 'Supaul',
  'ARR': 'Araria',
  'HW': 'Haridwar',
  'RKE': 'Roorkee',
  'RSK': 'Rishikesh',
  'HLD': 'Haldwani',
  'KGM': 'Kathgodam',
  'NTL': 'Nainital',
  'RDP': 'Rudrapur',
  'KSP': 'Kashipur',
  'PGT': 'Pantnagar',
  'PTH': 'Pithoragarh',
  'ALM': 'Almora',
  'BAG': 'Bageshwar',
  'CHM': 'Chamoli',
  'GPS': 'Gopeshwar',
  'UTK': 'Uttarkashi',
  'THR': 'Tehri',
  'KTD': 'Kotdwar',
  'RPT': 'Rudraprayag',
  'USN': 'Udham Singh Nagar'
};

export const expandMstcOffice = (officeCode: string): string => {
  if (!officeCode) return officeCode;
  const upper = officeCode.toUpperCase().trim();
  return MSTC_OFFICE_MAP[upper] || officeCode;
};

export function mapRawCategory(rawName: string): { category: string; subcategory: string } {
  if (!rawName) {
    return { category: 'Miscellaneous', subcategory: 'Others' };
  }

  // If it already has the clean pattern "Category | Subcategory", preserve it
  if (rawName.includes(' | ')) {
    const parts = rawName.split(' | ');
    return {
      category: parts[0].trim(),
      subcategory: parts[1]?.trim() || 'Others'
    };
  }

  const lower = rawName.toLowerCase();

  // 1. Metal
  if (
    lower.includes('metal') ||
    lower.includes('iron') ||
    lower.includes('steel') ||
    lower.includes('copper') ||
    lower.includes('brass') ||
    lower.includes('aluminium') ||
    lower.includes('lead') ||
    lower.includes('zinc') ||
    lower.includes('bronze') ||
    lower.includes('gold') ||
    lower.includes('silver') ||
    lower.includes('alloy') ||
    lower.includes('scrap')
  ) {
    let sub = 'Mixed metal scraps';
    if (lower.includes('iron') || lower.includes('steel')) sub = 'Iron and steel';
    else if (lower.includes('aluminium')) sub = 'Aluminium';
    else if (lower.includes('copper')) sub = 'Copper';
    else if (lower.includes('brass')) sub = 'Brass';
    return { category: 'Metal', subcategory: sub };
  }

  // 2. Transport Vehicles
  if (
    lower.includes('vehicle') ||
    lower.includes('car') ||
    lower.includes('truck') ||
    lower.includes('bus') ||
    lower.includes('auto') ||
    lower.includes('rickshaw') ||
    lower.includes('jeep') ||
    lower.includes('tractor') ||
    lower.includes('wheel') ||
    lower.includes('scooter') ||
    lower.includes('motorcycle') ||
    lower.includes('cycle') ||
    lower.includes('ship') ||
    lower.includes('vessel') ||
    lower.includes('boat') ||
    lower.includes('rail') ||
    lower.includes('wagon') ||
    lower.includes('locomotive')
  ) {
    let sub = 'Car';
    if (lower.includes('end of life') || lower.includes('elv')) sub = 'End of Life Vehicles';
    else if (lower.includes('ship') || lower.includes('vessel')) sub = 'Vessels/Ships';
    else if (lower.includes('special')) sub = 'Special Purpose Vehicle';
    return { category: 'Transport Vehicles', subcategory: sub };
  }

  // 3. Immovable Property
  if (
    lower.includes('building') ||
    lower.includes('land') ||
    lower.includes('plot') ||
    lower.includes('house') ||
    lower.includes('flat') ||
    lower.includes('property') ||
    lower.includes('residential') ||
    lower.includes('commercial') ||
    lower.includes('shed') ||
    lower.includes('godown') ||
    lower.includes('warehouse') ||
    lower.includes('office') ||
    lower.includes('shop') ||
    lower.includes('showroom') ||
    lower.includes('mall')
  ) {
    let sub = 'Plot/Land';
    if (lower.includes('residential') || lower.includes('house') || lower.includes('flat')) sub = 'Residential';
    else if (lower.includes('commercial') || lower.includes('shop') || lower.includes('office')) sub = 'Commercial';
    return { category: 'Immovable Property', subcategory: sub };
  }

  // 4. Electrical Items
  if (
    lower.includes('electrical') ||
    lower.includes('cable') ||
    lower.includes('wire') ||
    lower.includes('transformer') ||
    lower.includes('battery') ||
    lower.includes('ac ') ||
    lower.includes('air conditioner') ||
    lower.includes('generator') ||
    lower.includes('dg set') ||
    lower.includes('breaker') ||
    lower.includes('meter scrap') ||
    lower.includes('conductors')
  ) {
    let sub = 'Others';
    if (lower.includes('battery')) sub = 'Battery';
    else if (lower.includes('cable') || lower.includes('wire')) sub = 'Cables';
    else if (lower.includes('transformer')) sub = 'Transformer';
    else if (lower.includes('generator') || lower.includes('dg set')) sub = 'DG Sets / Generators';
    return { category: 'Electrical Items', subcategory: sub };
  }

  // 5. Electronics Items
  if (
    lower.includes('electronics') ||
    lower.includes('computer') ||
    lower.includes('laptop') ||
    lower.includes('mobile') ||
    lower.includes('phone') ||
    lower.includes('tablet') ||
    lower.includes('printer') ||
    lower.includes('peripheral') ||
    lower.includes('monitor') ||
    lower.includes('keyboard') ||
    lower.includes('mouse') ||
    lower.includes('server') ||
    lower.includes('compter')
  ) {
    return { category: 'Electronics Items', subcategory: 'Computers / Peripherals' };
  }

  // 6. Minerals
  if (
    lower.includes('mineral') ||
    lower.includes('ore') ||
    lower.includes('gypsum') ||
    lower.includes('stone') ||
    lower.includes('sand') ||
    lower.includes('gravel') ||
    lower.includes('manganese') ||
    lower.includes('ferro') ||
    lower.includes('block') ||
    lower.includes('coal') ||
    lower.includes('lignite') ||
    lower.includes('coke')
  ) {
    let sub = 'Minerals';
    if (lower.includes('coal')) sub = 'Coal';
    else if (lower.includes('sand')) sub = 'Sand block';
    return { category: 'Minerals', subcategory: sub };
  }

  // 7. Plant & Machinery
  if (
    lower.includes('machinery') ||
    lower.includes('machine') ||
    lower.includes('engine') ||
    lower.includes('compressor') ||
    lower.includes('pump') ||
    lower.includes('motor') ||
    lower.includes('turbine') ||
    lower.includes('boiler') ||
    lower.includes('furnace') ||
    lower.includes('crane') ||
    lower.includes('dismantling') ||
    lower.includes('plant')
  ) {
    let sub = 'Machinery items';
    if (lower.includes('engine')) sub = 'Engine Assemblies';
    else if (lower.includes('dismantling')) sub = 'Dismantling of buildings/plants';
    return { category: 'Plant/Machineries', subcategory: sub };
  }

  // 8. Forest Produce
  if (
    lower.includes('timber') ||
    lower.includes('wood') ||
    lower.includes('log') ||
    lower.includes('pole') ||
    lower.includes('billet') ||
    lower.includes('forest') ||
    lower.includes('bamboo') ||
    lower.includes('sandalwood')
  ) {
    return { category: 'Forest Produce', subcategory: 'Timber' };
  }

  // 9. Petroleum Products
  if (
    lower.includes('oil') ||
    lower.includes('petroleum') ||
    lower.includes('waste oil') ||
    lower.includes('lubricant') ||
    lower.includes('fuel')
  ) {
    return { category: 'Petroleum Products', subcategory: 'Used / waste oil' };
  }

  // 10. Container
  if (
    lower.includes('barrel') ||
    lower.includes('drum') ||
    lower.includes('can') ||
    lower.includes('tin') ||
    lower.includes('container')
  ) {
    return { category: 'Container', subcategory: 'Barrel/drum' };
  }

  // 11. Chemicals
  if (
    lower.includes('chemical') ||
    lower.includes('acid') ||
    lower.includes('solvent') ||
    lower.includes('paint') ||
    lower.includes('dye') ||
    lower.includes('pigment') ||
    lower.includes('catalyst') ||
    lower.includes('resin')
  ) {
    return { category: 'Chemicals', subcategory: 'Others' };
  }

  // 12. Agricultural Produce
  if (
    lower.includes('agricultural') ||
    lower.includes('paddy') ||
    lower.includes('wheat') ||
    lower.includes('rice') ||
    lower.includes('maize') ||
    lower.includes('barley') ||
    lower.includes('grain') ||
    lower.includes('pulse') ||
    lower.includes('cotton') ||
    lower.includes('seed') ||
    lower.includes('spice') ||
    lower.includes('cashew') ||
    lower.includes('coconut') ||
    lower.includes('arecanut')
  ) {
    return { category: 'Agricultural Produce', subcategory: 'Others' };
  }

  return { category: 'Miscellaneous', subcategory: 'Others' };
}

export const MstcSearchService = {
  /**
   * Client-side layman search fallback when Supabase RPC is not deployed.
   */
  async searchClientSide(
    query: string,
    filters?: { 
      category?: string; 
      categories?: string[];
      subcategory?: string; 
      subcategories?: string[];
      seller?: string; 
      sellers?: string[];
      location?: string; 
      locations?: string[];
      regionalOffice?: string;
      regionalOffices?: string[];
    }
  ): Promise<MstcSanitizedAuction[]> {
    try {
      let queryBuilder = supabase
        .from('mstc_auctions')
        .select('*')
        .eq('asset_status', 'completed');

      if (filters?.sellers && filters.sellers.length > 0) {
        queryBuilder = queryBuilder.in('seller_name', filters.sellers);
      } else if (filters?.seller) {
        queryBuilder = queryBuilder.eq('seller_name', filters.seller);
      }
      
      if (filters?.locations && filters.locations.length > 0) {
        queryBuilder = queryBuilder.in('location', filters.locations);
      } else if (filters?.location) {
        queryBuilder = queryBuilder.eq('location', filters.location);
      }

      if (filters?.regionalOffices && filters.regionalOffices.length > 0) {
        const orConditions = filters.regionalOffices.map(office => `mstc_auction_number.ilike.MSTC/${office}/%`).join(',');
        queryBuilder = queryBuilder.or(orConditions);
      } else if (filters?.regionalOffice) {
        queryBuilder = queryBuilder.ilike('mstc_auction_number', `MSTC/${filters.regionalOffice}/%`);
      }

      const { data, error } = await queryBuilder
        .order('opening_date', { ascending: false });

      if (error) throw error;
      if (!data) return [];

      // Map raw category names to clean Category | Subcategory structure
      let mapped = (data as MstcSanitizedAuction[]).map(item => {
        const { category, subcategory } = mapRawCategory(item.category_name);
        return {
          ...item,
          category_name: `${category} | ${subcategory}`
        };
      });

      // Filter by categories / subcategories arrays
      if (filters?.categories && filters.categories.length > 0) {
        const cats = filters.categories;
        mapped = mapped.filter(item => {
          const parts = item.category_name.split(' | ');
          return cats.includes(parts[0]);
        });
      } else if (filters?.category) {
        mapped = mapped.filter(item => {
          const parts = item.category_name.split(' | ');
          return parts[0] === filters.category;
        });
      }

      if (filters?.subcategories && filters.subcategories.length > 0) {
        const subcats = filters.subcategories;
        mapped = mapped.filter(item => {
          const parts = item.category_name.split(' | ');
          return subcats.includes(parts[1]);
        });
      } else if (filters?.subcategory) {
        mapped = mapped.filter(item => {
          const parts = item.category_name.split(' | ');
          return parts[1] === filters.subcategory;
        });
      }

      if (!query) {
        return mapped.slice(0, 200);
      }

      // Extract price constraint and clean query first
      const priceConstraint = parsePriceConstraint(query);
      const cleanedQuery = cleanQueryFromPriceConstraint(query);

      // Tokenize and normalize query (including compound expressions)
      const extractedTokensList = extractTokens(cleanedQuery);
      const rawTokens = filterCompoundComponents(extractedTokensList);

      if (rawTokens.length === 0) {
        return mapped.slice(0, 200);
      }

      // 1. Build Taxonomy dynamically from search data
      const { categoryKeywords, subcategoryKeywords } = buildTaxonomy(mapped);

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

      const scoredData = mapped.map(item => {
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
    filters?: { 
      category?: string; 
      categories?: string[];
      subcategory?: string; 
      subcategories?: string[];
      seller?: string; 
      sellers?: string[];
      location?: string; 
      locations?: string[];
      regionalOffice?: string;
      regionalOffices?: string[];
    }
  ): Promise<MstcSanitizedAuction[]> {
    try {
      return MstcSearchService.searchClientSide(query, filters);
    } catch (error) {
      console.warn('Catalog search failed:', error);
      return [];
    }
  },

  /**
   * Fetches unique filter options (State/Location, Category, Seller, Regional Office) from the database
   */
  async getMstcFilterOptions(): Promise<{
    categories: string[];
    subcategories: Record<string, string[]>;
    sellers: string[];
    locations: string[];
    regionalOffices: string[];
  }> {
    try {
      const { data, error } = await supabase
        .from('mstc_auctions')
        .select('category_name, seller_name, location, mstc_auction_number')
        .eq('asset_status', 'completed'); // Match filter dropdown choices with visible completed catalogs
      
      if (error) throw error;
      
      const categories = new Set<string>();
      const subcategoriesMap: Record<string, Set<string>> = {};
      const sellers = new Set<string>();
      const locations = new Set<string>();
      const regionalOffices = new Set<string>();
      
      data?.forEach(row => {
        if (row.category_name) {
          const { category, subcategory } = mapRawCategory(row.category_name);
          categories.add(category);
          if (subcategory) {
            if (!subcategoriesMap[category]) {
              subcategoriesMap[category] = new Set<string>();
            }
            subcategoriesMap[category].add(subcategory);
          }
        }
        if (row.seller_name) sellers.add(row.seller_name);
        if (row.location) locations.add(row.location);
        
        if (row.mstc_auction_number) {
          const parts = row.mstc_auction_number.split('/');
          if (parts.length > 1 && parts[0].toUpperCase() === 'MSTC') {
            regionalOffices.add(parts[1].trim());
          }
        }
      });

      const subcategories: Record<string, string[]> = {};
      for (const [cat, subSet] of Object.entries(subcategoriesMap)) {
        subcategories[cat] = Array.from(subSet).sort();
      }

      const sortedOffices = Array.from(regionalOffices).sort((a, b) => {
        const nameA = expandMstcOffice(a);
        const nameB = expandMstcOffice(b);
        return nameA.localeCompare(nameB);
      });
      
      return {
        categories: Array.from(categories).sort(),
        subcategories,
        sellers: Array.from(sellers).sort(),
        locations: Array.from(locations).sort(),
        regionalOffices: sortedOffices
      };
    } catch (error) {
      console.error('Failed to fetch MSTC filter options:', error);
      return { categories: [], subcategories: {}, sellers: [], locations: [], regionalOffices: [] };
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
      return ((data as MstcSanitizedAuction[]) || []).map(item => {
        const { category, subcategory } = mapRawCategory(item.category_name);
        return {
          ...item,
          category_name: `${category} | ${subcategory}`
        };
      });
    } catch (error) {
      console.error('Failed processing analytics baseline query maps:', error);
      return [];
    }
  }
};

