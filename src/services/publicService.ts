import { supabase } from '../lib/supabase';
import type { ContactMessage, FaqItem, Announcement, NewsUpdate } from '../types/database.types';

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

export const MstcSearchService = {
  /**
   * High-speed catalog search engine filtering through clean, deduplicated snapshots
   */
  async searchMarketplaceCatalog(
    query: string,
    filters?: { category?: string; subcategory?: string; seller?: string; location?: string; regionalOffice?: string }
  ): Promise<MstcSanitizedAuction[]> {
    try {
      let queryBuilder = supabase
        .from('mstc_auctions')
        .select('*')
        .eq('asset_status', 'completed'); // Only show items that have ready, downloaded PDFs

      if (query) {
        queryBuilder = queryBuilder.or(`mstc_auction_number.ilike.%${query}%,seller_name.ilike.%${query}%,category_name.ilike.%${query}%`);
      }
      
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

      if (filters?.regionalOffice) {
        queryBuilder = queryBuilder.ilike('mstc_auction_number', `MSTC/${filters.regionalOffice}/%`);
      }

      const { data, error } = await queryBuilder
        .order('opening_date', { ascending: false })
        .limit(200); // Load up to 200 items for responsive viewing

      if (error) throw error;
      return (data as MstcSanitizedAuction[]) || [];
    } catch (error) {
      console.error('Failed to fetch filtered MSTC catalogs:', error);
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

