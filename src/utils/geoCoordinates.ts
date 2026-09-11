/**
 * Geographic coordinates database and Haversine distance calculator for Indian locations.
 * Covers states, union territories, major cities, and MSTC/GeM regional office locations.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Standard coordinates for Indian States and Union Territories (centroid / major hub)
 */
export const STATE_COORDINATES: Record<string, GeoPoint> = {
  'andhra pradesh': { lat: 15.9129, lng: 79.7400 },
  'arunachal pradesh': { lat: 27.0844, lng: 93.6053 },
  'assam': { lat: 26.2006, lng: 92.9376 },
  'bihar': { lat: 25.0961, lng: 85.3131 },
  'chhattisgarh': { lat: 21.2787, lng: 81.8661 },
  'goa': { lat: 15.2993, lng: 74.1240 },
  'gujarat': { lat: 22.2587, lng: 71.1924 },
  'haryana': { lat: 29.0588, lng: 76.0856 },
  'himachal pradesh': { lat: 31.1048, lng: 77.1734 },
  'jharkhand': { lat: 23.6102, lng: 85.2799 },
  'karnataka': { lat: 15.3173, lng: 75.7139 },
  'kerala': { lat: 10.8505, lng: 76.2711 },
  'madhya pradesh': { lat: 22.9734, lng: 78.6569 },
  'maharashtra': { lat: 19.7515, lng: 75.7139 },
  'manipur': { lat: 24.6637, lng: 93.9063 },
  'meghalaya': { lat: 25.4670, lng: 91.3662 },
  'mizoram': { lat: 23.1645, lng: 92.9376 },
  'nagaland': { lat: 26.1584, lng: 94.5624 },
  'odisha': { lat: 20.9517, lng: 85.0985 },
  'punjab': { lat: 31.1471, lng: 75.3412 },
  'rajasthan': { lat: 27.0238, lng: 74.2179 },
  'sikkim': { lat: 27.5330, lng: 88.5122 },
  'tamil nadu': { lat: 11.1271, lng: 78.6569 },
  'telangana': { lat: 18.1124, lng: 79.0193 },
  'tripura': { lat: 23.9408, lng: 91.9882 },
  'uttar pradesh': { lat: 26.8467, lng: 80.9462 },
  'uttarakhand': { lat: 30.0668, lng: 79.0193 },
  'west bengal': { lat: 22.9868, lng: 87.8550 },
  // UTs
  'delhi': { lat: 28.7041, lng: 77.1025 },
  'chandigarh': { lat: 30.7333, lng: 76.7794 },
  'jammu and kashmir': { lat: 33.7782, lng: 76.5762 },
  'ladakh': { lat: 34.1526, lng: 77.5771 },
  'puducherry': { lat: 11.9416, lng: 79.8083 },
  'pondicherry': { lat: 11.9416, lng: 79.8083 },
  'dadra and nagar haveli': { lat: 20.1809, lng: 73.0169 },
  'daman and diu': { lat: 20.4283, lng: 72.8397 },
  'andaman and nicobar': { lat: 11.7401, lng: 92.6586 },
  'lakshadweep': { lat: 10.5667, lng: 72.6417 },
};

/**
 * Standard coordinates for Tier-1, Tier-2, and major industrial cities in India
 */
export const CITY_COORDINATES: Record<string, GeoPoint> = {
  // Metro / Tier-1
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'bombay': { lat: 19.0760, lng: 72.8777 },
  'delhi': { lat: 28.7041, lng: 77.1025 },
  'new delhi': { lat: 28.6139, lng: 77.2090 },
  'ncr': { lat: 28.6139, lng: 77.2090 },
  'bengaluru': { lat: 12.9716, lng: 77.5946 },
  'bangalore': { lat: 12.9716, lng: 77.5946 },
  'hyderabad': { lat: 17.3850, lng: 78.4867 },
  'secunderabad': { lat: 17.4399, lng: 78.4983 },
  'ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'chennai': { lat: 13.0827, lng: 80.2707 },
  'madras': { lat: 13.0827, lng: 80.2707 },
  'kolkata': { lat: 22.5726, lng: 88.3639 },
  'calcutta': { lat: 22.5726, lng: 88.3639 },
  'pune': { lat: 18.5204, lng: 73.8567 },
  'poona': { lat: 18.5204, lng: 73.8567 },

  // Maharashtra
  'thane': { lat: 19.2183, lng: 72.9781 },
  'navi mumbai': { lat: 19.0330, lng: 73.0297 },
  'nagpur': { lat: 21.1458, lng: 79.0882 },
  'nashik': { lat: 19.9975, lng: 73.7898 },
  'aurangabad': { lat: 19.8762, lng: 75.3433 },
  'chhatrapati sambhajinagar': { lat: 19.8762, lng: 75.3433 },
  'solapur': { lat: 17.6599, lng: 75.9064 },
  'kolhapur': { lat: 16.7050, lng: 74.2433 },
  'amravati': { lat: 20.9374, lng: 77.7796 },
  'jalgaon': { lat: 21.0077, lng: 75.5626 },
  'nanded': { lat: 19.1383, lng: 77.3210 },
  'sangli': { lat: 16.8524, lng: 74.5815 },
  'malegaon': { lat: 20.5539, lng: 74.5288 },
  'akola': { lat: 20.7002, lng: 77.0082 },
  'latur': { lat: 18.4088, lng: 76.5604 },
  'dhule': { lat: 20.9042, lng: 74.7749 },
  'ahmednagar': { lat: 19.0952, lng: 74.7496 },
  'chandrapur': { lat: 19.9615, lng: 79.2961 },
  'parbhani': { lat: 19.2608, lng: 76.7748 },
  'panvel': { lat: 18.9894, lng: 73.1175 },

  // Gujarat
  'surat': { lat: 21.1702, lng: 72.8311 },
  'vadodara': { lat: 22.3072, lng: 73.1812 },
  'baroda': { lat: 22.3072, lng: 73.1812 },
  'rajkot': { lat: 22.3039, lng: 70.8022 },
  'bhavnagar': { lat: 21.7645, lng: 72.1519 },
  'jamnagar': { lat: 22.4707, lng: 70.0577 },
  'gandhinagar': { lat: 23.2156, lng: 72.6369 },
  'junagadh': { lat: 21.5222, lng: 70.4579 },
  'anand': { lat: 22.5645, lng: 72.9289 },
  'navsari': { lat: 20.9467, lng: 72.9520 },
  'morbi': { lat: 22.8120, lng: 70.8236 },
  'vapi': { lat: 20.3893, lng: 72.9106 },
  'ankleshwar': { lat: 21.6264, lng: 73.0034 },
  'bharuch': { lat: 21.7051, lng: 72.9959 },

  // Karnataka
  'mysore': { lat: 12.2958, lng: 76.6394 },
  'mysuru': { lat: 12.2958, lng: 76.6394 },
  'hubli': { lat: 15.3647, lng: 75.1240 },
  'dharwad': { lat: 15.4589, lng: 75.0078 },
  'mangaluru': { lat: 12.9141, lng: 74.8560 },
  'mangalore': { lat: 12.9141, lng: 74.8560 },
  'belagavi': { lat: 15.8497, lng: 74.4977 },
  'belgaum': { lat: 15.8497, lng: 74.4977 },
  'gulbarga': { lat: 17.3297, lng: 76.8343 },
  'kalaburagi': { lat: 17.3297, lng: 76.8343 },
  'davanagere': { lat: 14.4644, lng: 75.9218 },
  'ballari': { lat: 15.1394, lng: 76.9214 },
  'bellary': { lat: 15.1394, lng: 76.9214 },
  'shimoga': { lat: 13.9299, lng: 75.5681 },
  'shivamogga': { lat: 13.9299, lng: 75.5681 },
  'tumkur': { lat: 13.3409, lng: 77.1010 },
  'tumakuru': { lat: 13.3409, lng: 77.1010 },
  'udupi': { lat: 13.3409, lng: 74.7421 },

  // Tamil Nadu
  'coimbatore': { lat: 11.0168, lng: 76.9558 },
  'madurai': { lat: 9.9252, lng: 78.1198 },
  'tiruchirappalli': { lat: 10.7905, lng: 78.7047 },
  'trichy': { lat: 10.7905, lng: 78.7047 },
  'salem': { lat: 11.6643, lng: 78.1460 },
  'tiruppur': { lat: 11.1085, lng: 77.3411 },
  'erode': { lat: 11.3410, lng: 77.7172 },
  'vellore': { lat: 12.9165, lng: 79.1325 },
  'tirunelveli': { lat: 8.7139, lng: 77.7567 },
  'thoothukudi': { lat: 8.7642, lng: 78.1348 },
  'tuticorin': { lat: 8.7642, lng: 78.1348 },
  'dindigul': { lat: 10.3673, lng: 77.9803 },
  'thanjavur': { lat: 10.7870, lng: 79.1378 },
  'hosur': { lat: 12.7409, lng: 77.8253 },
  'nagercoil': { lat: 8.1833, lng: 77.4119 },
  'kanchipuram': { lat: 12.8342, lng: 79.7036 },

  // Kerala
  'kochi': { lat: 9.9312, lng: 76.2673 },
  'cochin': { lat: 9.9312, lng: 76.2673 },
  'ernakulam': { lat: 9.9816, lng: 76.2999 },
  'thiruvananthapuram': { lat: 8.5241, lng: 76.9366 },
  'trivandrum': { lat: 8.5241, lng: 76.9366 },
  'tvm': { lat: 8.5241, lng: 76.9366 },
  'kozhikode': { lat: 11.2588, lng: 75.7804 },
  'calicut': { lat: 11.2588, lng: 75.7804 },
  'thrissur': { lat: 10.5276, lng: 76.2144 },
  'kollam': { lat: 8.8932, lng: 76.6141 },
  'alappuzha': { lat: 9.4981, lng: 76.3388 },
  'kannur': { lat: 11.8745, lng: 75.3704 },
  'palakkad': { lat: 10.7867, lng: 76.6548 },
  'kottayam': { lat: 9.5916, lng: 76.5222 },
  'malappuram': { lat: 11.0510, lng: 76.0711 },

  // Andhra Pradesh & Telangana
  'visakhapatnam': { lat: 17.6868, lng: 83.2185 },
  'vizag': { lat: 17.6868, lng: 83.2185 },
  'vijayawada': { lat: 16.5062, lng: 80.6480 },
  'guntur': { lat: 16.3067, lng: 80.4365 },
  'nellore': { lat: 14.4426, lng: 79.9865 },
  'kurnool': { lat: 15.8281, lng: 78.0373 },
  'rajahmundry': { lat: 17.0005, lng: 81.8040 },
  'tirupati': { lat: 13.6288, lng: 79.4192 },
  'kakinada': { lat: 16.9891, lng: 82.2475 },
  'kadapa': { lat: 14.4673, lng: 78.8242 },
  'anantapur': { lat: 14.6819, lng: 77.6006 },
  'warangal': { lat: 17.9689, lng: 79.5941 },
  'nizamabad': { lat: 18.6725, lng: 78.0941 },
  'karimnagar': { lat: 18.4386, lng: 79.1288 },
  'khammam': { lat: 17.2473, lng: 80.1514 },

  // West Bengal & North East
  'howrah': { lat: 22.5958, lng: 88.2636 },
  'asansol': { lat: 23.6739, lng: 86.9524 },
  'siliguri': { lat: 26.7271, lng: 88.3953 },
  'durgapur': { lat: 23.5204, lng: 87.3119 },
  'bardhaman': { lat: 23.2324, lng: 87.8615 },
  'guwahati': { lat: 26.1445, lng: 91.7362 },
  'silchar': { lat: 24.8333, lng: 92.7789 },
  'dibrugarh': { lat: 27.4728, lng: 94.9120 },
  'jorhat': { lat: 26.7509, lng: 94.2037 },
  'shillong': { lat: 25.5788, lng: 91.8933 },
  'agartala': { lat: 23.8315, lng: 91.2868 },
  'imphal': { lat: 24.8170, lng: 93.9368 },
  'aizawl': { lat: 23.7271, lng: 92.7176 },
  'kohima': { lat: 25.6751, lng: 94.1086 },
  'gangtok': { lat: 27.3389, lng: 88.6065 },

  // Uttar Pradesh & Uttarakhand
  'lucknow': { lat: 26.8467, lng: 80.9462 },
  'kanpur': { lat: 26.4499, lng: 80.3319 },
  'ghaziabad': { lat: 28.6692, lng: 77.4538 },
  'noida': { lat: 28.5355, lng: 77.3910 },
  'greater noida': { lat: 28.4744, lng: 77.5040 },
  'agra': { lat: 27.1767, lng: 78.0081 },
  'meerut': { lat: 28.9845, lng: 77.7064 },
  'varanasi': { lat: 25.3176, lng: 82.9739 },
  'banaras': { lat: 25.3176, lng: 82.9739 },
  'prayagraj': { lat: 25.4358, lng: 81.8463 },
  'allahabad': { lat: 25.4358, lng: 81.8463 },
  'bareilly': { lat: 28.3670, lng: 79.4304 },
  'aligarh': { lat: 27.8974, lng: 78.0880 },
  'moradabad': { lat: 28.8386, lng: 78.7733 },
  'saharanpur': { lat: 29.9679, lng: 77.5510 },
  'gorakhpur': { lat: 26.7606, lng: 83.3732 },
  'firozabad': { lat: 27.1593, lng: 78.3957 },
  'jhansi': { lat: 25.4484, lng: 78.5685 },
  'mathura': { lat: 27.4924, lng: 77.6737 },
  'dehradun': { lat: 30.3165, lng: 78.0322 },
  'haridwar': { lat: 29.9457, lng: 78.1642 },
  'roorkee': { lat: 29.8543, lng: 77.8880 },
  'rishikesh': { lat: 30.0869, lng: 78.2676 },
  'haldwani': { lat: 29.2183, lng: 79.5130 },

  // Rajasthan
  'jaipur': { lat: 26.9124, lng: 75.7873 },
  'jodhpur': { lat: 26.2389, lng: 73.0243 },
  'kota': { lat: 25.2138, lng: 75.8648 },
  'bikaner': { lat: 28.0229, lng: 73.3119 },
  'ajmer': { lat: 26.4499, lng: 74.6399 },
  'udaipur': { lat: 24.5854, lng: 73.7125 },
  'bhilwara': { lat: 25.3216, lng: 74.6307 },
  'alwar': { lat: 27.5530, lng: 76.6346 },
  'sikar': { lat: 27.6094, lng: 75.1399 },
  'bharatpur': { lat: 27.2152, lng: 77.5030 },

  // Madhya Pradesh & Chhattisgarh
  'indore': { lat: 22.7196, lng: 75.8577 },
  'bhopal': { lat: 23.2599, lng: 77.4126 },
  'jabalpur': { lat: 23.1815, lng: 79.9864 },
  'gwalior': { lat: 26.2183, lng: 78.1828 },
  'ujjain': { lat: 23.1765, lng: 75.7885 },
  'sagar': { lat: 23.8388, lng: 78.7378 },
  'dewas': { lat: 22.9676, lng: 76.0534 },
  'satna': { lat: 24.6005, lng: 80.8322 },
  'ratlam': { lat: 23.3315, lng: 75.0367 },
  'rewa': { lat: 24.5362, lng: 81.3037 },
  'raipur': { lat: 21.2514, lng: 81.6296 },
  'bhilai': { lat: 21.2144, lng: 81.3805 },
  'durg': { lat: 21.1904, lng: 81.2849 },
  'bilaspur': { lat: 22.0797, lng: 82.1409 },
  'korba': { lat: 22.3595, lng: 82.7501 },

  // Punjab, Haryana, Himachal & J&K
  'ludhiana': { lat: 30.9010, lng: 75.8573 },
  'amritsar': { lat: 31.6340, lng: 74.8723 },
  'jalandhar': { lat: 31.3260, lng: 75.5762 },
  'patiala': { lat: 30.3398, lng: 76.3869 },
  'bathinda': { lat: 30.2110, lng: 74.9455 },
  'mohali': { lat: 30.7046, lng: 76.7179 },
  'faridabad': { lat: 28.4089, lng: 77.3178 },
  'gurugram': { lat: 28.4595, lng: 77.0266 },
  'gurgaon': { lat: 28.4595, lng: 77.0266 },
  'panipat': { lat: 29.3909, lng: 76.9635 },
  'ambala': { lat: 30.3782, lng: 76.7767 },
  'yamunanagar': { lat: 30.1290, lng: 77.2674 },
  'rohtak': { lat: 28.8955, lng: 76.6066 },
  'hisar': { lat: 29.1492, lng: 75.7217 },
  'karnal': { lat: 29.6857, lng: 76.9905 },
  'sonipat': { lat: 28.9931, lng: 77.0151 },
  'shimla': { lat: 31.1048, lng: 77.1734 },
  'dharamsala': { lat: 32.2190, lng: 76.3234 },
  'mandi': { lat: 31.5892, lng: 76.9182 },
  'srinagar': { lat: 34.0837, lng: 74.7973 },
  'jammu': { lat: 32.7266, lng: 74.8570 },

  // Bihar, Jharkhand & Odisha
  'patna': { lat: 25.5941, lng: 85.1376 },
  'gaya': { lat: 24.7914, lng: 85.0002 },
  'bhagalpur': { lat: 25.2425, lng: 86.9842 },
  'muzaffarpur': { lat: 26.1209, lng: 85.3647 },
  'darbhanga': { lat: 26.1542, lng: 85.8918 },
  'ranchi': { lat: 23.3441, lng: 85.3096 },
  'jamshedpur': { lat: 22.8046, lng: 86.2029 },
  'dhanbad': { lat: 23.7957, lng: 86.4304 },
  'bokaro': { lat: 23.6693, lng: 86.1511 },
  'deoghar': { lat: 24.4826, lng: 86.7001 },
  'bhubaneswar': { lat: 20.2961, lng: 85.8245 },
  'cuttack': { lat: 20.4625, lng: 85.8828 },
  'rourkela': { lat: 22.2604, lng: 84.8536 },
  'puri': { lat: 19.8135, lng: 85.8312 },
  'balasore': { lat: 21.4934, lng: 86.9135 },
  'sambalpur': { lat: 21.4669, lng: 83.9812 },
  'berhampur': { lat: 19.3150, lng: 84.7941 },
};

/**
 * MSTC Regional Office Codes to Coordinates
 */
export const MSTC_OFFICE_COORDINATES: Record<string, GeoPoint> = {
  'WRO': { lat: 19.0760, lng: 72.8777 }, // Mumbai
  'NRO': { lat: 28.6139, lng: 77.2090 }, // Delhi
  'ERO': { lat: 22.5726, lng: 88.3639 }, // Kolkata
  'CO':  { lat: 22.5726, lng: 88.3639 }, // Kolkata HO
  'SRO': { lat: 13.0827, lng: 80.2707 }, // Chennai
  'BLR': { lat: 12.9716, lng: 77.5946 }, // Bangalore
  'HYD': { lat: 17.3850, lng: 78.4867 }, // Hyderabad
  'BPL': { lat: 23.2599, lng: 77.4126 }, // Bhopal
  'BBR': { lat: 20.2961, lng: 85.8245 }, // Bhubaneswar
  'CDG': { lat: 30.7333, lng: 76.7794 }, // Chandigarh
  'JPR': { lat: 26.9124, lng: 75.7873 }, // Jaipur
  'LKO': { lat: 26.8467, lng: 80.9462 }, // Lucknow
  'PTN': { lat: 25.5941, lng: 85.1376 }, // Patna
  'GHY': { lat: 26.1445, lng: 91.7362 }, // Guwahati
  'VSP': { lat: 17.6868, lng: 83.2185 }, // Visakhapatnam
  'VAD': { lat: 22.3072, lng: 73.1812 }, // Vadodara
  'TVC': { lat: 8.5241, lng: 76.9366 },  // Trivandrum
};

/**
 * Calculates Haversine distance in kilometers between two latitude/longitude points.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // Rounded to 1 decimal place
}

/**
 * Resolves a text location (city, state, or office) to coordinates.
 */
export function resolveLocationTextToCoordinates(text?: string | null): GeoPoint | null {
  if (!text) return null;
  const clean = text.toLowerCase().trim().replace(/[,\-_./]/g, ' ').replace(/\s+/g, ' ');

  // 1. Direct city match
  if (CITY_COORDINATES[clean]) {
    return CITY_COORDINATES[clean];
  }

  // 2. Direct state match
  if (STATE_COORDINATES[clean]) {
    return STATE_COORDINATES[clean];
  }

  // 3. Check if text contains any city
  for (const [city, pt] of Object.entries(CITY_COORDINATES)) {
    // Word boundary check to avoid partial word mismatches
    const regex = new RegExp(`\\b${city}\\b`, 'i');
    if (regex.test(clean)) {
      return pt;
    }
  }

  // 4. Check if text contains any state
  for (const [state, pt] of Object.entries(STATE_COORDINATES)) {
    const regex = new RegExp(`\\b${state}\\b`, 'i');
    if (regex.test(clean)) {
      return pt;
    }
  }

  return null;
}

/**
 * Resolves coordinates for any auction item regardless of portal type:
 * - BaankNet (latitude, longitude, or city/state/address)
 * - MSTC (mstc_auction_number regional office, location, seller_name)
 * - GeM (location, city, state, full_address)
 * - Commercial (location, regional_office)
 */
export function getAuctionCoordinates(item: any): GeoPoint | null {
  if (!item) return null;

  // 1. Exact coordinates if available (e.g. BaankNet)
  const lat = typeof item.latitude === 'number' ? item.latitude : parseFloat(item.latitude);
  const lng = typeof item.longitude === 'number' ? item.longitude : parseFloat(item.longitude);
  if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    return { lat, lng };
  }

  // 2. Check raw_materials_text lotLocation / lotState if available (MSTC physical site)
  if (item.raw_materials_text) {
    try {
      const p = typeof item.raw_materials_text === 'string' ? JSON.parse(item.raw_materials_text) : item.raw_materials_text;
      if (p?.items?.[0]?.lotLocation) {
        const resolved = resolveLocationTextToCoordinates(p.items[0].lotLocation);
        if (resolved) return resolved;
      }
      if (p?.items?.[0]?.lotState) {
        const resolved = resolveLocationTextToCoordinates(p.items[0].lotState);
        if (resolved) return resolved;
      }
    } catch {}
  }

  // 3. Check city / district / location / state / full_address fields
  if (item.city) {
    const resolved = resolveLocationTextToCoordinates(item.city);
    if (resolved) return resolved;
  }

  if (item.district) {
    const resolved = resolveLocationTextToCoordinates(item.district);
    if (resolved) return resolved;
  }

  if (item.location) {
    const resolved = resolveLocationTextToCoordinates(item.location);
    if (resolved) return resolved;
  }

  if (item.state) {
    const resolved = resolveLocationTextToCoordinates(item.state);
    if (resolved) return resolved;
  }

  if (item.full_address) {
    const resolved = resolveLocationTextToCoordinates(item.full_address);
    if (resolved) return resolved;
  }

  // 4. Check seller name and auction number text for physical city names (e.g. "BPCL KOCHI REFINERY")
  const combinedText = `${item.seller_name || ''} ${item.mstc_auction_number || ''}`.toLowerCase();
  for (const [city, pt] of Object.entries(CITY_COORDINATES)) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(combinedText)) {
      return pt;
    }
  }

  // 5. Fallback: MSTC regional office code in auction number (e.g. MSTC/WRO/...)
  if (item.mstc_auction_number) {
    const parts = (item.mstc_auction_number as string).split('/');
    if (parts.length > 1) {
      const officeCode = parts[1].toUpperCase().trim();
      if (MSTC_OFFICE_COORDINATES[officeCode]) {
        return MSTC_OFFICE_COORDINATES[officeCode];
      }
    }
  }

  // 6. Fallback: Commercial / Other auctions regional_office
  if (item.regional_office) {
    const roUpper = String(item.regional_office).toUpperCase().trim();
    if (MSTC_OFFICE_COORDINATES[roUpper]) {
      return MSTC_OFFICE_COORDINATES[roUpper];
    }
    const resolvedRo = resolveLocationTextToCoordinates(item.regional_office);
    if (resolvedRo) return resolvedRo;
  }

  return null;
}

/**
 * Returns the distance in kilometers from user location to an auction, or null if auction location is unknown.
 */
export function getAuctionDistance(
  item: any,
  userLat: number,
  userLng: number
): number | null {
  const coords = getAuctionCoordinates(item);
  if (!coords) return null;
  return calculateDistanceKm(userLat, userLng, coords.lat, coords.lng);
}

/**
 * Finds all known cities, states, and MSTC regional offices within a given radius (km) of user coordinates.
 */
export function findLocationsWithinRadius(
  userLat: number,
  userLng: number,
  radiusKm: number = 200
): {
  cities: string[];
  states: string[];
  regionalOffices: string[];
} {
  const matchingCities: string[] = [];
  const matchingStates: string[] = [];
  const matchingOffices: string[] = [];

  for (const [city, pt] of Object.entries(CITY_COORDINATES)) {
    if (calculateDistanceKm(userLat, userLng, pt.lat, pt.lng) <= radiusKm) {
      matchingCities.push(city);
    }
  }

  for (const [state, pt] of Object.entries(STATE_COORDINATES)) {
    if (calculateDistanceKm(userLat, userLng, pt.lat, pt.lng) <= radiusKm) {
      matchingStates.push(state);
    }
  }

  for (const [office, pt] of Object.entries(MSTC_OFFICE_COORDINATES)) {
    if (calculateDistanceKm(userLat, userLng, pt.lat, pt.lng) <= radiusKm) {
      matchingOffices.push(office);
    }
  }

  return {
    cities: Array.from(new Set(matchingCities)),
    states: Array.from(new Set(matchingStates)),
    regionalOffices: Array.from(new Set(matchingOffices)),
  };
}

/**
 * Parses user search query to detect proximity search intent (e.g. "vehicles within 200km",
 * "properties within 156km", "scrap near me").
 * Automatically rounds raw km variations (e.g. 156km) to the nearest 100km.
 */
export function parseNearbyQuery(inputQuery: string): {
  isNearby: boolean;
  radius: number;
  cleanedQuery: string;
} {
  const q = (inputQuery || '').trim();
  if (!q) {
    return { isNearby: false, radius: 200, cleanedQuery: '' };
  }

  // Check for distance patterns: "within 200km", "under 156 km", "156km", "radius of 200 km", etc.
  const kmRegex = /(?:within|under|around|less\s+than|in\s+a|radius\s+of)?\s*(\d{1,4})\s*(?:km|kms|k\.m\.|kilometer|kilometers?)(?:\s*(?:radius|of\s+me|from\s+me|away|range))?/i;
  // Check for "near me", "nearby", etc.
  const nearMeRegex = /(?:near\s+me|nearby|close\s+to\s+me|around\s+me|in\s+my\s+area|in\s+my\s+location|using\s+my\s+location)/i;

  const kmMatch = q.match(kmRegex);
  const nearMeMatch = q.match(nearMeRegex);

  if (!kmMatch && !nearMeMatch) {
    return { isNearby: false, radius: 200, cleanedQuery: q };
  }

  let radius = 200;
  if (kmMatch && kmMatch[1]) {
    const rawKm = parseInt(kmMatch[1], 10);
    if (!isNaN(rawKm) && rawKm > 0) {
      // Round to nearest 100, min 100, max 1500 (or if explicitly <= 50, round to 50 or 100)
      const rounded = Math.round(rawKm / 100) * 100;
      radius = Math.min(Math.max(100, rounded), 1500);
    }
  }

  // Strip proximity tokens from search query
  let cleaned = q
    .replace(new RegExp(kmRegex.source, 'gi'), '')
    .replace(new RegExp(nearMeRegex.source, 'gi'), '')
    // Strip conversational query prefixes like "find me auctions", "show me", "get me", "search for"
    .replace(/^(?:find(?:\s+me)?|show(?:\s+me)?|search(?:\s+for)?|get(?:\s+me)?|look(?:\s+for)?)\s+/gi, '')
    // Strip standalone words "auctions", "catalogs", "tenders", "notices", "lots" if used generically
    .replace(/\b(?:auctions?|catalogs?|notices?|tenders?|lots?)\b/gi, '')
    // Clean up punctuation and whitespace
    .replace(/[^\w\s\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    isNearby: true,
    radius,
    cleanedQuery: cleaned,
  };
}

