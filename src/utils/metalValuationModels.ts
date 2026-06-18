export interface ModelMetadata {
  id: string;
  name: string;
  description: string;
  intercept: number;
  coefficients: Record<string, number>;
  grades: string[];
  regions: string[];
  features: string[];
  targetUnit: string;
  isPlaceholder?: boolean;
}

export interface MacroInputs {
  LME_Steel_Scrap_USD: number;
  USD_INR: number;
  Domestic_Iron_Ore_INR: number;
  Domestic_Coal_INR: number;
  Monsoon_Season: number; // 0 or 1
  Construction_Index: number;
}

// Current default macro values (as of June 2026)
export const DEFAULT_MACRO_INPUTS: MacroInputs = {
  LME_Steel_Scrap_USD: 425.0,
  USD_INR: 83.85,
  Domestic_Iron_Ore_INR: 5250.0,
  Domestic_Coal_INR: 9200.0,
  Monsoon_Season: 1, // June is monsoon season in India
  Construction_Index: 114.2
};

export const METALLIC_MODELS: Record<string, ModelMetadata> = {
  scrap_steel: {
    id: 'scrap_steel',
    name: 'Steel Scrap Regression Model',
    description: 'Trained on Indian scrap metal market prices (2021-2026). Predicts price for secondary melting scrap.',
    intercept: -25614.816409036306,
    coefficients: {
      'Grade_E2': 2001.1178278689015,
      'Grade_E3': 4483.559426229489,
      'Grade_E40': 5520.235655737746,
      'Grade_E5H': 6002.453893442639,
      'Grade_E6': -3087.8258196720863,
      'Grade_E8': 8404.44262295086,
      'Grade_EHRB': 3506.5993852459283,
      'Region_Delhi': -317.11782786886414,
      'Region_Kolkata': -998.544569672151,
      'Region_Mumbai': 187.90471311475295,
      'LME_Steel_Scrap_USD': 58.36535569680525,
      'USD_INR': 340.9336977703216,
      'Domestic_Iron_Ore_INR': 0.339909576834277,
      'Domestic_Coal_INR': 0.16903155974496317,
      'Monsoon_Season': 429.8259964690658,
      'Construction_Index': 85.69607291251492
    },
    grades: ['E1', 'E2', 'E3', 'E5H', 'E6', 'E8', 'E40', 'EHRB'],
    regions: ['Mumbai', 'Delhi', 'Chennai', 'Kolkata'],
    features: [
      'Grade',
      'Region',
      'LME_Steel_Scrap_USD',
      'USD_INR',
      'Domestic_Iron_Ore_INR',
      'Domestic_Coal_INR',
      'Monsoon_Season',
      'Construction_Index'
    ],
    targetUnit: 'Tons'
  },
  primary_steel: {
    id: 'primary_steel',
    name: 'Primary Steel Regression Model',
    description: 'Baseline model for structural steel, TMT bars, and steel billets based on primary ore and manufacturing index.',
    intercept: 12450.55,
    coefficients: {
      'Grade_Fe 500': 1500.0,
      'Grade_Fe 550': 2800.0,
      'Grade_Fe 600': 4200.0,
      'Grade_MS Billet': -1200.0,
      'Region_Delhi': -250.0,
      'Region_Kolkata': -600.0,
      'Region_Mumbai': 350.0,
      'LME_Steel_Scrap_USD': 42.5,
      'USD_INR': 210.3,
      'Domestic_Iron_Ore_INR': 1.85, // Stronger dependence on raw iron ore
      'Domestic_Coal_INR': 0.45,     // Higher energy dependence
      'Monsoon_Season': -250.0,     // Construction slowdown reduces primary demand
      'Construction_Index': 142.8    // Highly dependent on construction projects
    },
    grades: ['Fe 415', 'Fe 500', 'Fe 550', 'Fe 600', 'MS Billet'],
    regions: ['Mumbai', 'Delhi', 'Chennai', 'Kolkata'],
    features: [
      'Grade',
      'Region',
      'LME_Steel_Scrap_USD',
      'USD_INR',
      'Domestic_Iron_Ore_INR',
      'Domestic_Coal_INR',
      'Monsoon_Season',
      'Construction_Index'
    ],
    targetUnit: 'Tons',
    isPlaceholder: true
  },
  cars_vehicles: {
    id: 'cars_vehicles',
    name: 'Vehicle Salvage Regression Model',
    description: 'Baseline model predicting salvage value of end-of-life commercial and passenger vehicles based on metallic scrap yield.',
    intercept: 45000.0,
    coefficients: {
      'Grade_SUV': 15000.0,
      'Grade_Hatchback': -10000.0,
      'Grade_Commercial Truck': 95000.0,
      'Grade_Two Wheeler': -38000.0,
      'Region_Delhi': -800.0,
      'Region_Kolkata': -1500.0,
      'Region_Mumbai': 1200.0,
      'LME_Steel_Scrap_USD': 85.0, // Highly correlated to steel scrap weight
      'USD_INR': 420.0,
      'Domestic_Iron_Ore_INR': 0.15,
      'Domestic_Coal_INR': 0.08,
      'Monsoon_Season': 1500.0, // Higher accident/salvage rates in monsoon
      'Construction_Index': 120.0
    },
    grades: ['Sedan', 'SUV', 'Hatchback', 'Commercial Truck', 'Two Wheeler'],
    regions: ['Mumbai', 'Delhi', 'Chennai', 'Kolkata'],
    features: [
      'Grade',
      'Region',
      'LME_Steel_Scrap_USD',
      'USD_INR',
      'Domestic_Iron_Ore_INR',
      'Domestic_Coal_INR',
      'Monsoon_Season',
      'Construction_Index'
    ],
    targetUnit: 'Units',
    isPlaceholder: true
  },
  e_waste_electronics: {
    id: 'e_waste_electronics',
    name: 'E-Waste & Electronics Regression Model',
    description: 'Trained on Indian e-waste and electronics pricing dataset merged with commodity indices.',
    intercept: -3037.0274898273346,
    coefficients: {
      'Grade_DSLR Camera': 12488.644573352469,
      'Grade_Electric Scooter': 3927.276520123368,
      'Grade_Gaming Console': -5849.796135973533,
      'Grade_Laptop': -2348.721757703607,
      'Grade_Microwave': -10015.322929732867,
      'Grade_Refrigerator': 1937.63337852609,
      'Grade_Smartphone': -8305.677803449214,
      'Grade_Smartwatch': -11325.243092968409,
      'Grade_TV': 19953.56177301112,
      'Grade_Tablet': -8233.125267746862,
      'Grade_Washing Machine': -2149.9647449550516,
      'Region_Delhi': -434.93493509571636,
      'Region_Kolkata': -1186.3180819148106,
      'Region_Mumbai': 49.29377353390225,
      'LME_Steel_Scrap_USD': 28.923783781143623,
      'USD_INR': -131.6592009012477,
      'Domestic_Iron_Ore_INR': -0.1490383532504595,
      'Domestic_Coal_INR': 0.09229225747003511,
      'Monsoon_Season': 251.04701105915996,
      'Construction_Index': 152.80578734959914
    },
    grades: [
      'Air Conditioner',
      'Laptop',
      'Smartphone',
      'TV',
      'DSLR Camera',
      'Electric Scooter',
      'Washing Machine',
      'Tablet',
      'Microwave',
      'Smartwatch',
      'Gaming Console',
      'Refrigerator'
    ],
    regions: ['Mumbai', 'Delhi', 'Chennai', 'Kolkata'],
    features: [
      'Grade',
      'Region',
      'LME_Steel_Scrap_USD',
      'USD_INR',
      'Domestic_Iron_Ore_INR',
      'Domestic_Coal_INR',
      'Monsoon_Season',
      'Construction_Index'
    ],
    targetUnit: 'Units'
  }
};

/**
 * Predicts the price of a metal product based on regression coefficients
 */
export function predictPrice(
  modelId: string,
  grade: string,
  region: string,
  macro: MacroInputs,
  title?: string
): number {
  const model = METALLIC_MODELS[modelId] || METALLIC_MODELS.scrap_steel;
  
  let price = model.intercept;

  // Grade adjustment (if not reference grade - index 0)
  const gradeIndex = model.grades.indexOf(grade);
  if (gradeIndex > 0) {
    const gradeKey = `Grade_${grade}`;
    if (model.coefficients[gradeKey] !== undefined) {
      price += model.coefficients[gradeKey];
    }
  }

  // Region adjustment (if not reference region - index 2 'Chennai' for scrap/others)
  // Let's check model coefficients directly
  const regionKey = `Region_${region}`;
  if (model.coefficients[regionKey] !== undefined) {
    price += model.coefficients[regionKey];
  }

  // Numerical inputs
  price += (model.coefficients['LME_Steel_Scrap_USD'] || 0) * macro.LME_Steel_Scrap_USD;
  price += (model.coefficients['USD_INR'] || 0) * macro.USD_INR;
  price += (model.coefficients['Domestic_Iron_Ore_INR'] || 0) * macro.Domestic_Iron_Ore_INR;
  price += (model.coefficients['Domestic_Coal_INR'] || 0) * macro.Domestic_Coal_INR;
  price += (model.coefficients['Monsoon_Season'] || 0) * macro.Monsoon_Season;
  price += (model.coefficients['Construction_Index'] || 0) * macro.Construction_Index;

  // Apply negative remarks price adjustments if title/description is passed
  if (title) {
    const t = title.toLowerCase();
    let multiplier = 1.0;
    
    if (t.includes('unserviceable')) {
      multiplier = Math.min(multiplier, 0.10); // 90% reduction
    }
    if (t.includes('broken')) {
      multiplier = Math.min(multiplier, 0.15); // 85% reduction
    }
    if (t.includes('damaged')) {
      multiplier = Math.min(multiplier, 0.15); // 85% reduction
    }
    if (t.includes('deteriorated')) {
      multiplier = Math.min(multiplier, 0.15); // 85% reduction
    }
    if (t.includes('scrap') && modelId !== 'scrap_steel') {
      multiplier = Math.min(multiplier, 0.15); // 85% reduction
    }
    if (t.includes('waste') && modelId !== 'scrap_steel') {
      multiplier = Math.min(multiplier, 0.15); // 85% reduction
    }
    
    price = price * multiplier;
  }

  // Ensure predicted price is positive
  return Math.max(0, price);
}

/**
 * Automatically detects the best model based on auction title/category
 */
export function detectModelId(title: string): string {
  const t = title.toLowerCase();
  if (
    t.includes('e-waste') ||
    t.includes('ewaste') ||
    t.includes('motherboard') ||
    t.includes('printer') ||
    t.includes('monitor') ||
    t.includes('computer') ||
    t.includes('laptop') ||
    t.includes('smartphone') ||
    t.includes('tablet') ||
    t.includes('tv') ||
    t.includes('camera') ||
    t.includes('smartwatch') ||
    t.includes('console') ||
    t.includes('electronics')
  ) {
    return 'e_waste_electronics';
  }
  if (t.includes('vehicle') || t.includes('car') || t.includes('truck') || t.includes('bus') || t.includes('transport') || t.includes('auto')) {
    return 'cars_vehicles';
  }
  if (t.includes('scrap') || t.includes('waste') || t.includes('melting')) {
    return 'scrap_steel';
  }
  if (t.includes('steel') || t.includes('billet') || t.includes('tmt') || t.includes('iron') || t.includes('metal')) {
    return 'primary_steel';
  }
  return 'scrap_steel'; // Default metal model
}

/**
 * Detects the grade from the title if possible, or returns the first grade as default
 */
export function detectGrade(title: string, modelId: string): string {
  const model = METALLIC_MODELS[modelId] || METALLIC_MODELS.scrap_steel;
  const t = title.toUpperCase();
  
  for (const grade of model.grades) {
    if (t.includes(grade.toUpperCase())) {
      return grade;
    }
  }
  
  // Custom heuristics
  if (modelId === 'scrap_steel') {
    if (t.includes('HRB') || t.includes('REBAR')) return 'EHRB';
    if (t.includes('HEAVY')) return 'E3';
    if (t.includes('LIGHT')) return 'E6';
  } else if (modelId === 'cars_vehicles') {
    if (t.includes('SUV') || t.includes('FORTUNER') || t.includes('BREZZA')) return 'SUV';
    if (t.includes('TRUCK') || t.includes('LORRY') || t.includes('DUMPER')) return 'Commercial Truck';
    if (t.includes('BIKE') || t.includes('SCOOTER')) return 'Two Wheeler';
  } else if (modelId === 'primary_steel') {
    if (t.includes('500')) return 'Fe 500';
    if (t.includes('550')) return 'Fe 550';
    if (t.includes('600')) return 'Fe 600';
    if (t.includes('BILLET')) return 'MS Billet';
  } else if (modelId === 'e_waste_electronics') {
    if (t.includes('LAPTOP') || t.includes('COMPUTER')) return 'Laptop';
    if (t.includes('PHONE') || t.includes('MOBILE') || t.includes('SMARTPHONE')) return 'Smartphone';
    if (t.includes('TV') || t.includes('TELEVISION') || t.includes('LED')) return 'TV';
    if (t.includes('CAMERA') || t.includes('DSLR') || t.includes('NIKON') || t.includes('CANON') || t.includes('FUJIFILM')) return 'DSLR Camera';
    if (t.includes('SCOOTER') || t.includes('BIKE') || t.includes('ELECTRIC SCOOTER')) return 'Electric Scooter';
    if (t.includes('AC') || t.includes('CONDITIONER') || t.includes('AIR CONDITIONER')) return 'Air Conditioner';
    if (t.includes('WASHING') || t.includes('MACHINE')) return 'Washing Machine';
    if (t.includes('TABLET') || t.includes('PAD') || t.includes('IPAD')) return 'Tablet';
    if (t.includes('MICROWAVE') || t.includes('OVEN')) return 'Microwave';
    if (t.includes('WATCH') || t.includes('SMARTWATCH')) return 'Smartwatch';
    if (t.includes('CONSOLE') || t.includes('PLAYSTATION') || t.includes('XBOX') || t.includes('NINTENDO')) return 'Gaming Console';
    if (t.includes('FRIDGE') || t.includes('REFRIGERATOR')) return 'Refrigerator';
  }
  
  return model.grades[0]; // Default
}

/**
 * Detects region from location or title, defaults to first region
 */
export function detectRegion(location: string, title: string): string {
  const l = (location || '').toLowerCase();
  const t = title.toLowerCase();
  
  if (l.includes('mumbai') || l.includes('maharashtra') || t.includes('mumbai')) return 'Mumbai';
  if (l.includes('delhi') || l.includes('ncr') || t.includes('delhi')) return 'Delhi';
  if (l.includes('kolkata') || l.includes('calcutta') || l.includes('bengal') || t.includes('kolkata')) return 'Kolkata';
  if (l.includes('chennai') || l.includes('tamil') || l.includes('madras') || t.includes('chennai')) return 'Chennai';
  
  return 'Mumbai'; // Default
}
