import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import readline from 'readline';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config();
puppeteer.use(StealthPlugin());

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("CRITICAL EXCEPTION: Background scraper is missing database environment keys.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const CATEGORY_MAP: Record<string, { category: string; subcategory: string }> = {
  // Agricultural Produce
  'cereals': { category: 'Agricultural Produce', subcategory: 'Cereals' },
  'maize': { category: 'Agricultural Produce', subcategory: 'Cereals / Maize' },
  'barley': { category: 'Agricultural Produce', subcategory: 'Cereals / Barley' },
  'bajra': { category: 'Agricultural Produce', subcategory: 'Cereals / Bajra' },
  'ragi': { category: 'Agricultural Produce', subcategory: 'Cereals / Ragi' },
  'jowar': { category: 'Agricultural Produce', subcategory: 'Cereals / Jowar' },
  'paddy': { category: 'Agricultural Produce', subcategory: 'Cereals / Paddy' },
  'wheat': { category: 'Agricultural Produce', subcategory: 'Cereals / Wheat' },
  'pulses': { category: 'Agricultural Produce', subcategory: 'Pulses' },
  'gram/chickpea': { category: 'Agricultural Produce', subcategory: 'Pulses / Gram' },
  'moong dal': { category: 'Agricultural Produce', subcategory: 'Pulses / Moong Dal' },
  'toor dal': { category: 'Agricultural Produce', subcategory: 'Pulses / Toor Dal' },
  'urad': { category: 'Agricultural Produce', subcategory: 'Pulses / Urad' },
  'oil seeds/oil': { category: 'Agricultural Produce', subcategory: 'Oil seeds/oil' },
  'mustard seed': { category: 'Agricultural Produce', subcategory: 'Oil seeds / Mustard' },
  'ground nut': { category: 'Agricultural Produce', subcategory: 'Oil seeds / Ground Nut' },
  'sesamum seed': { category: 'Agricultural Produce', subcategory: 'Oil seeds / Sesamum' },
  'soyabean': { category: 'Agricultural Produce', subcategory: 'Oil seeds / Soyabean' },
  'sunflower seed': { category: 'Agricultural Produce', subcategory: 'Oil seeds / Sunflower' },
  'copra': { category: 'Agricultural Produce', subcategory: 'Oil seeds / Copra' },
  'palm oil': { category: 'Agricultural Produce', subcategory: 'Oil seeds / Palm Oil' },
  'kernel oil': { category: 'Agricultural Produce', subcategory: 'Oil seeds / Kernel Oil' },
  'cotton': { category: 'Agricultural Produce', subcategory: 'Cotton' },
  'cotton bale': { category: 'Agricultural Produce', subcategory: 'Cotton / Cotton Bale' },
  'cotton seed': { category: 'Agricultural Produce', subcategory: 'Cotton / Cotton Seed' },
  'spices': { category: 'Agricultural Produce', subcategory: 'Spices' },
  'cardamom': { category: 'Agricultural Produce', subcategory: 'Spices / Cardamom' },
  'pepper': { category: 'Agricultural Produce', subcategory: 'Spices / Pepper' },
  'onion': { category: 'Agricultural Produce', subcategory: 'Spices / Onion' },
  'ginger': { category: 'Agricultural Produce', subcategory: 'Spices / Ginger' },
  'cashew': { category: 'Agricultural Produce', subcategory: 'Cashew' },
  'arecanut/betel nut': { category: 'Agricultural Produce', subcategory: 'Arecanut / Betel Nut' },
  'coconut': { category: 'Agricultural Produce', subcategory: 'Coconut' },

  // Aquatic Produce
  'fish': { category: 'Aquatic Produce', subcategory: 'Fish' },

  // Ash
  'fly ash': { category: 'Ash', subcategory: 'Fly ash' },
  'pond ash': { category: 'Ash', subcategory: 'Pond ash' },
  'bottom ash': { category: 'Ash', subcategory: 'Bottom ash' },

  // Chemicals
  'paints, dyes and pigments': { category: 'Chemicals', subcategory: 'Paints, dyes and pigments' },
  'spent catalyst': { category: 'Chemicals', subcategory: 'Spent catalyst' },
  'resins': { category: 'Chemicals', subcategory: 'Resins' },
  'acid': { category: 'Chemicals', subcategory: 'Acid' },

  // Coal
  'coal': { category: 'Coal', subcategory: 'Coal' },
  'coal linkage': { category: 'Coal', subcategory: 'Coal linkage' },
  'lignite': { category: 'Coal', subcategory: 'Lignite' },
  'coal by products': { category: 'Coal', subcategory: 'Coal by products' },
  'graphite fines': { category: 'Coal', subcategory: 'Coal by products / Graphite Fines' },
  'met coke dust/fines': { category: 'Coal', subcategory: 'Coal by products / Met Coke' },

  // Container
  'barrel/drum': { category: 'Container', subcategory: 'Barrel/drum' },
  'ms barrel/drum': { category: 'Container', subcategory: 'Barrel/drum / MS Barrel/Drum' },
  'plastic barrel/drum': { category: 'Container', subcategory: 'Barrel/drum / Plastic Barrel/Drum' },
  'can/tin': { category: 'Container', subcategory: 'Can/tin' },

  // Diamond
  'rough diamond': { category: 'Diamond', subcategory: 'Rough diamond' },
  'gem-individual': { category: 'Diamond', subcategory: 'Gem-individual' },
  'gem-packets': { category: 'Diamond', subcategory: 'Gem-packets' },
  'off colour-packets': { category: 'Diamond', subcategory: 'Off colour-packets' },
  'darkbrown-packets': { category: 'Diamond', subcategory: 'Darkbrown-packets' },

  // Electrical Items
  'air conditioner/ac plant': { category: 'Electrical Items', subcategory: 'Air conditioner / AC Plant' },
  'battery': { category: 'Electrical Items', subcategory: 'Battery' },
  'cables': { category: 'Electrical Items', subcategory: 'Cables' },
  'transformer': { category: 'Electrical Items', subcategory: 'Transformer' },
  'dg sets/generators': { category: 'Electrical Items', subcategory: 'DG Sets / Generators' },
  'conductors': { category: 'Electrical Items', subcategory: 'Conductors' },
  'aac': { category: 'Electrical Items', subcategory: 'Conductors / AAC' },
  'aaac': { category: 'Electrical Items', subcategory: 'Conductors / AAAC' },
  'acsr': { category: 'Electrical Items', subcategory: 'Conductors / ACSR' },
  'circuit breaker': { category: 'Electrical Items', subcategory: 'Circuit breaker' },
  'meter scrap': { category: 'Electrical Items', subcategory: 'Meter scrap' },
  'crgo scrap': { category: 'Electrical Items', subcategory: 'CRGO scrap' },

  // Electronics Items
  'computers/peripherals': { category: 'Electronics Items', subcategory: 'Computers / Peripherals' },
  'compters/peripherals': { category: 'Electronics Items', subcategory: 'Computers / Peripherals' },
  'mobile/tablet': { category: 'Electronics Items', subcategory: 'Mobile / Tablet' },

  // Forest Produce
  'timber': { category: 'Forest Produce', subcategory: 'Timber' },
  'poles': { category: 'Forest Produce', subcategory: 'Poles' },
  'billets': { category: 'Forest Produce', subcategory: 'Billets' },
  'ntfd': { category: 'Forest Produce', subcategory: 'NTFD' },
  'canes': { category: 'Forest Produce', subcategory: 'Canes' },
  'timber - teak': { category: 'Forest Produce', subcategory: 'Timber - Teak' },
  'timber - rosewood': { category: 'Forest Produce', subcategory: 'Timber - Rosewood' },
  'timber - others': { category: 'Forest Produce', subcategory: 'Timber - Others' },
  'timber cut sizes': { category: 'Forest Produce', subcategory: 'Timber Cut Sizes' },
  'sandal wood': { category: 'Forest Produce', subcategory: 'Sandal wood' },
  'red sander': { category: 'Forest Produce', subcategory: 'Red sander' },
  'sandalwood oil': { category: 'Forest Produce', subcategory: 'Sandalwood oil' },
  'poles- teak': { category: 'Forest Produce', subcategory: 'Poles - Teak' },
  'poles - others': { category: 'Forest Produce', subcategory: 'Poles - Others' },
  'pulpwood': { category: 'Forest Produce', subcategory: 'Pulpwood' },
  'firewood': { category: 'Forest Produce', subcategory: 'Firewood' },
  'tendu leaves': { category: 'Forest Produce', subcategory: 'Tendu leaves' },

  // Immovable Property
  'residential': { category: 'Immovable Property', subcategory: 'Residential' },
  'flat': { category: 'Immovable Property', subcategory: 'Residential / Flat' },
  'plot/land': { category: 'Immovable Property', subcategory: 'Residential / Plot/Land' },
  'independent house': { category: 'Immovable Property', subcategory: 'Residential / Independent House' },
  'commercial': { category: 'Immovable Property', subcategory: 'Commercial' },
  'shops': { category: 'Immovable Property', subcategory: 'Commercial / Shops' },
  'showroom': { category: 'Immovable Property', subcategory: 'Commercial / Showroom' },
  'office': { category: 'Immovable Property', subcategory: 'Commercial / Office' },
  'land/plot': { category: 'Immovable Property', subcategory: 'Commercial / Land/Plot' },
  'buildings': { category: 'Immovable Property', subcategory: 'Commercial / Buildings' },
  'malls': { category: 'Immovable Property', subcategory: 'Commercial / Malls' },
  'storage space': { category: 'Immovable Property', subcategory: 'Commercial / Storage Space' },
  'godowns': { category: 'Immovable Property', subcategory: 'Commercial / Godowns' },
  'hoardings': { category: 'Immovable Property', subcategory: 'Commercial / Hoardings' },
  'bus adda': { category: 'Immovable Property', subcategory: 'Commercial / Bus Adda' },
  'parking lot': { category: 'Immovable Property', subcategory: 'Commercial / Parking Lot' },
  'toilets/bathrooms/washrooms': { category: 'Immovable Property', subcategory: 'Commercial / Washrooms' },
  'agriculture': { category: 'Immovable Property', subcategory: 'Agriculture' },
  'farmhouse': { category: 'Immovable Property', subcategory: 'Agriculture / Farmhouse' },
  'industry': { category: 'Immovable Property', subcategory: 'Industry' },
  'building': { category: 'Immovable Property', subcategory: 'Industry / Building' },
  'warehouse': { category: 'Immovable Property', subcategory: 'Industry / Warehouse' },
  'industrial shed': { category: 'Immovable Property', subcategory: 'Industry / Industrial Shed' },
  'shed with plant and machinery': { category: 'Immovable Property', subcategory: 'Industry / Shed with Plant/Machinery' },

  // Liquor License Contracts
  'liquor shop license': { category: 'Liquor License Contracts', subcategory: 'Liquor shop license' },

  // Metal
  'iron and steel': { category: 'Metal', subcategory: 'Iron and steel' },
  'aluminium': { category: 'Metal', subcategory: 'Aluminium' },
  'brass': { category: 'Metal', subcategory: 'Brass' },
  'copper': { category: 'Metal', subcategory: 'Copper' },
  'lead': { category: 'Metal', subcategory: 'Lead' },
  'gold': { category: 'Metal', subcategory: 'Gold' },
  'platinum': { category: 'Metal', subcategory: 'Platinum' },
  'silver': { category: 'Metal', subcategory: 'Silver' },
  'zinc': { category: 'Metal', subcategory: 'Zinc' },
  'nickle': { category: 'Metal', subcategory: 'Nickel' },
  'gun metal/bronze': { category: 'Metal', subcategory: 'Gun metal / Bronze' },
  'other metals': { category: 'Metal', subcategory: 'Other metals' },
  'mixed metal scraps': { category: 'Metal', subcategory: 'Mixed metal scraps' },

  // Mine Block
  'mine block': { category: 'Mine Block', subcategory: 'Mine block' },
  'coal mine': { category: 'Mine Block', subcategory: 'Coal mine' },
  'iron ore mine': { category: 'Mine Block', subcategory: 'Iron ore mine' },
  'lime stone mine': { category: 'Mine Block', subcategory: 'Limestone mine' },
  'graphite mine': { category: 'Mine Block', subcategory: 'Graphite mine' },
  'gold mine': { category: 'Mine Block', subcategory: 'Gold mine' },
  'manganese ore mine': { category: 'Mine Block', subcategory: 'Manganese ore mine' },
  'diamond mine': { category: 'Mine Block', subcategory: 'Diamond mine' },
  'bauxite mine': { category: 'Mine Block', subcategory: 'Bauxite mine' },
  'copper ore mine': { category: 'Mine Block', subcategory: 'Copper ore mine' },
  'platinum ore mine': { category: 'Mine Block', subcategory: 'Platinum ore mine' },
  'sand block': { category: 'Mine Block', subcategory: 'Sand block' },
  'murram block': { category: 'Mine Block', subcategory: 'Murram block' },
  'rcc/ercc': { category: 'Mine Block', subcategory: 'RCC / ERCC' },
  'magnesite mine': { category: 'Mine Block', subcategory: 'Magnesite mine' },
  'decorative stone mine': { category: 'Mine Block', subcategory: 'Decorative stone mine' },
  'phosphorite mine': { category: 'Mine Block', subcategory: 'Phosphorite mine' },
  'basemetal mine': { category: 'Mine Block', subcategory: 'Basemetal mine' },
  'vanadium mine': { category: 'Mine Block', subcategory: 'Vanadium mine' },
  'iron ore & manganese ore mine': { category: 'Mine Block', subcategory: 'Iron & Manganese mine' },
  'gold and basemetal mine': { category: 'Mine Block', subcategory: 'Gold & Basemetal mine' },
  'graphite & vanadium mine': { category: 'Mine Block', subcategory: 'Graphite & Vanadium mine' },
  'flourite mine': { category: 'Mine Block', subcategory: 'Fluorite mine' },
  'siliceous earth mine': { category: 'Mine Block', subcategory: 'Siliceous earth mine' },
  'potash mine': { category: 'Mine Block', subcategory: 'Potash mine' },
  'rare earth elements mine': { category: 'Mine Block', subcategory: 'Rare earth elements mine' },
  'garnet mine': { category: 'Mine Block', subcategory: 'Garnet mine' },
  'copper lead zinc mine': { category: 'Mine Block', subcategory: 'Copper lead zinc mine' },
  'copper and associated gold mine': { category: 'Mine Block', subcategory: 'Copper & Gold mine' },
  'lead zinc mine': { category: 'Mine Block', subcategory: 'Lead zinc mine' },
  'emerald mine': { category: 'Mine Block', subcategory: 'Emerald mine' },
  'ordinary sand mine': { category: 'Mine Block', subcategory: 'Ordinary sand mine' },

  // Minerals
  'blue stone': { category: 'Minerals', subcategory: 'Blue stone' },
  'iron ore': { category: 'Minerals', subcategory: 'Iron ore' },
  'mixed - fines and lumps': { category: 'Minerals', subcategory: 'Iron ore / Mixed Fines & Lumps' },
  'manganese/ferro-manganese ore': { category: 'Minerals', subcategory: 'Manganese / Ferro-manganese' },
  'sand': { category: 'Minerals', subcategory: 'Sand' },
  'clay': { category: 'Minerals', subcategory: 'Clay' },
  'chrome ore': { category: 'Minerals', subcategory: 'Chrome ore' },
  'baryte': { category: 'Minerals', subcategory: 'Baryte' },
  'dolomite': { category: 'Minerals', subcategory: 'Dolomite' },
  'granite': { category: 'Minerals', subcategory: 'Granite' },
  'limestone': { category: 'Minerals', subcategory: 'Limestone' },
  'marble': { category: 'Minerals', subcategory: 'Marble' },
  'silica sand': { category: 'Minerals', subcategory: 'Silica sand' },
  'gypsum': { category: 'Minerals', subcategory: 'Gypsum' },
  'fluorspar': { category: 'Minerals', subcategory: 'Fluorspar' },
  'weathered/mixed stone': { category: 'Minerals', subcategory: 'Weathered / Mixed stone' },
  'inferior quality material': { category: 'Minerals', subcategory: 'Inferior quality material' },
  'm-sand': { category: 'Minerals', subcategory: 'M-sand' },
  'bauxite': { category: 'Minerals', subcategory: 'Bauxite' },
  'magnesite': { category: 'Minerals', subcategory: 'Magnesite' },
  'dunite': { category: 'Minerals', subcategory: 'Dunite' },
  'salt': { category: 'Minerals', subcategory: 'Salt' },
  'low graded/nala sand': { category: 'Minerals', subcategory: 'Low graded sand' },
  'primarily blue stone': { category: 'Minerals', subcategory: 'Blue stone' },
  'rock phosphate': { category: 'Minerals', subcategory: 'Rock phosphate' },

  // Miscellaneous
  'plastic': { category: 'Miscellaneous', subcategory: 'Plastic' },
  'leather': { category: 'Miscellaneous', subcategory: 'Leather' },
  'rubber': { category: 'Miscellaneous', subcategory: 'Rubber' },
  'building materials': { category: 'Miscellaneous', subcategory: 'Building materials' },
  'cenosphere': { category: 'Miscellaneous', subcategory: 'Cenosphere' },
  'dismantaling of buildings/plants': { category: 'Miscellaneous', subcategory: 'Dismantling of buildings/plants' },
  'furniture': { category: 'Miscellaneous', subcategory: 'Furniture' },
  'wooden items': { category: 'Miscellaneous', subcategory: 'Wooden items' },
  'scrips': { category: 'Miscellaneous', subcategory: 'Scrips' },
  'miscellaneous items': { category: 'Miscellaneous', subcategory: 'Miscellaneous items' },
  'fgd gypsum': { category: 'Miscellaneous', subcategory: 'FGD Gypsum' },
  'paper and related products': { category: 'Miscellaneous', subcategory: 'Paper & related products' },
  'paper': { category: 'Miscellaneous', subcategory: 'Paper & related products / Paper' },
  'board': { category: 'Miscellaneous', subcategory: 'Paper & related products / Board' },
  'cartoons': { category: 'Miscellaneous', subcategory: 'Paper & related products / Cartons' },
  'paper bricks': { category: 'Miscellaneous', subcategory: 'Paper & related products / Paper Bricks' },
  'others': { category: 'Miscellaneous', subcategory: 'Others' },
  'cloth/garments': { category: 'Miscellaneous', subcategory: 'Cloth / Garments' },
  'fabric/yarn/cloth': { category: 'Miscellaneous', subcategory: 'Cloth / Garments / Fabric' },
  'garbage/sweeping dust/broom waste': { category: 'Miscellaneous', subcategory: 'Garbage & Sweeping Waste' },
  'glass': { category: 'Miscellaneous', subcategory: 'Glass' },
  'medical': { category: 'Miscellaneous', subcategory: 'Medical' },
  'medical equipment': { category: 'Miscellaneous', subcategory: 'Medical / Medical Equipment' },
  'medical waste': { category: 'Miscellaneous', subcategory: 'Medical / Medical Waste' },
  'medical machinery': { category: 'Miscellaneous', subcategory: 'Medical / Medical Machinery' },
  'lab equipment': { category: 'Miscellaneous', subcategory: 'Medical / Lab Equipment' },
  'medicines': { category: 'Miscellaneous', subcategory: 'Medical / Medicines' },
  'human hair': { category: 'Miscellaneous', subcategory: 'Human hair' },
  'silk cocoons': { category: 'Miscellaneous', subcategory: 'Silk cocoons' },
  'fibre scrap or fiber glass scrap': { category: 'Miscellaneous', subcategory: 'Fiberglass scrap' },
  'footwear': { category: 'Miscellaneous', subcategory: 'Footwear' },
  'packing material': { category: 'Miscellaneous', subcategory: 'Packing material' },
  'gunny bags': { category: 'Miscellaneous', subcategory: 'Packing material / Gunny Bags' },
  'jute bags': { category: 'Miscellaneous', subcategory: 'Packing material / Jute Bags' },
  'corrugated box': { category: 'Miscellaneous', subcategory: 'Packing material / Corrugated Box' },
  'textile': { category: 'Miscellaneous', subcategory: 'Textile' },
  'jute items/jute waste': { category: 'Miscellaneous', subcategory: 'Textile / Jute items' },
  'cotton items/cotton waste': { category: 'Miscellaneous', subcategory: 'Textile / Cotton items' },
  'tents/tarpaulin': { category: 'Miscellaneous', subcategory: 'Textile / Tents & Tarpaulin' },
  'custom goods': { category: 'Miscellaneous', subcategory: 'Custom goods' },
  'unclaimed/uncleared cargo': { category: 'Miscellaneous', subcategory: 'Custom goods / Unclaimed Cargo' },
  'cfs containers': { category: 'Miscellaneous', subcategory: 'Custom goods / CFS Containers' },
  'safety equipment': { category: 'Miscellaneous', subcategory: 'Safety equipment' },
  'household and office items': { category: 'Miscellaneous', subcategory: 'Household & office items' },
  'artifacts': { category: 'Miscellaneous', subcategory: 'Artifacts' },
  'musical instruments': { category: 'Miscellaneous', subcategory: 'Musical instruments' },
  'tdr -transferrable development rights': { category: 'Miscellaneous', subcategory: 'TDR rights' },
  'omda': { category: 'Miscellaneous', subcategory: 'OMDA' },

  // Petroleum Products
  'pet coke': { category: 'Petroleum Products', subcategory: 'Pet coke' },
  'used/ waste oil': { category: 'Petroleum Products', subcategory: 'Used / waste oil' },
  'lubricants': { category: 'Petroleum Products', subcategory: 'Lubricants' },
  'rlng': { category: 'Petroleum Products', subcategory: 'RLNG' },
  'bitumen': { category: 'Petroleum Products', subcategory: 'Bitumen' },
  'wax': { category: 'Petroleum Products', subcategory: 'Wax' },

  // Plant/Machineries
  'plants': { category: 'Plant/Machineries', subcategory: 'Plants' },
  'machinery items': { category: 'Plant/Machineries', subcategory: 'Machinery items' },
  'aircrafts': { category: 'Plant/Machineries', subcategory: 'Aircrafts' },
  'crane/earth moving equipments': { category: 'Plant/Machineries', subcategory: 'Crane & Earth-moving' },
  'forklift': { category: 'Plant/Machineries', subcategory: 'Crane & Earth-moving / Forklift' },
  'surplus stores/ spares': { category: 'Plant/Machineries', subcategory: 'Surplus stores / Spares' },
  'engine assemblies/ vehicle comp.': { category: 'Plant/Machineries', subcategory: 'Engine Assemblies' },
  'tools & equipments': { category: 'Plant/Machineries', subcategory: 'Tools & equipment' },
  'spare parts': { category: 'Plant/Machineries', subcategory: 'Spare parts' },

  // Transport Vehicles
  'auto rikshaw': { category: 'Transport Vehicles', subcategory: 'Auto Rickshaw' },
  'two-wheller': { category: 'Transport Vehicles', subcategory: 'Two-wheeler' },
  'car': { category: 'Transport Vehicles', subcategory: 'Car' },
  'bus': { category: 'Transport Vehicles', subcategory: 'Bus' },
  'truck': { category: 'Transport Vehicles', subcategory: 'Truck' },
  'end of life vehicles': { category: 'Transport Vehicles', subcategory: 'End of Life Vehicles' },
  'cycles': { category: 'Transport Vehicles', subcategory: 'Cycles' },
  'e-rikshaw': { category: 'Transport Vehicles', subcategory: 'E-Rickshaw' },
  'spv - special purpose vehicle': { category: 'Transport Vehicles', subcategory: 'Special Purpose Vehicle' },

  // Vessels
  'ship': { category: 'Vessels', subcategory: 'Ship' },
  'boat': { category: 'Vessels', subcategory: 'Boat' },
  'tug': { category: 'Vessels', subcategory: 'Tug' },
  'barge': { category: 'Vessels', subcategory: 'Barge' },
  'dredger': { category: 'Vessels', subcategory: 'Dredger' }
};

const sortedKeys = Object.keys(CATEGORY_MAP).sort((a, b) => b.length - a.length);

function parseCategoryAndSubcategory(rawCellText: string): { category: string; subcategory: string } {
  const normalized = (rawCellText || '').toLowerCase().trim();
  
  if (normalized.includes(' | ')) {
    const parts = rawCellText.split(' | ');
    return { category: parts[0].trim(), subcategory: parts[1].trim() };
  }

  // 1. Search for known vocabulary keys
  for (const key of sortedKeys) {
    if (normalized.includes(key)) {
      return CATEGORY_MAP[key];
    }
  }

  // 2. Try cleaning up parts
  const cleanParts = normalized
    .replace(/\s+/g, ' ')
    .split(/,|\n|\/|&|and/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  for (const part of cleanParts) {
    for (const key of sortedKeys) {
      if (part.includes(key) || key.includes(part)) {
        return CATEGORY_MAP[key];
      }
    }
  }

  // Fallback
  return { category: 'Miscellaneous', subcategory: rawCellText || 'Others' };
}

interface DiscoveredRow {
  mstc_auction_number: string;
  seller_name: string;
  category_name: string;
  location: string;
  opening_date: string;
  closing_date: string;
  source_pdf_url: string;
  raw_materials_text: string;
  asset_status: string;
  retry_count: number;
  is_reauction: boolean;
  original_auction_number: string | null;
  parent_auction_id: string | null;
}

function waitForUserConfirmation(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function executeDiscoveryScraper() {
  console.log('[Cleanup] Checking for expired auctions...');
  try {
    const now = new Date().toISOString();
    
    // 1. Fetch expired auctions
    const { data: expiredAuctions, error: fetchError } = await supabase
      .from('mstc_auctions')
      .select('id, mstc_auction_number, closing_date, sanitized_document_path')
      .lt('closing_date', now);

    if (fetchError) {
      console.error('[Cleanup] Error fetching expired auctions:', fetchError.message);
    } else if (expiredAuctions && expiredAuctions.length > 0) {
      console.log(`[Cleanup] Found ${expiredAuctions.length} expired auctions. Logging and deleting...`);

      // 2. Insert audit logs for deleted auctions
      const logEntries = expiredAuctions.map(auc => ({
        action: 'mstc_auction_deleted',
        entity_type: 'mstc_auction',
        details: {
          mstc_auction_number: auc.mstc_auction_number,
          reason: 'expired',
          closing_date: auc.closing_date,
          sanitized_document_path: auc.sanitized_document_path
        }
      }));

      const { error: logError } = await supabase
        .from('audit_logs')
        .insert(logEntries);

      if (logError) {
        console.error('[Cleanup] Error writing audit logs for expired auctions:', logError.message);
      }

      // 3. Remove physical files from storage
      for (const auc of expiredAuctions) {
        if (auc.sanitized_document_path) {
          const cloudStorageLocation = `mstc-catalogs/${auc.id}.pdf`;
          const previewStorageLocation = `mstc-previews/${auc.id}.jpg`;
          
          const { error: storageDeleteError } = await supabase.storage
            .from('auction_documents')
            .remove([cloudStorageLocation, previewStorageLocation]);

          if (storageDeleteError) {
            console.warn(`[Cleanup] Failed to remove storage file ${cloudStorageLocation}:`, storageDeleteError.message);
          } else {
            console.log(`[Cleanup] Removed storage file: ${cloudStorageLocation}`);
          }
        }
      }

      // 4. Delete database records
      const idsToDelete = expiredAuctions.map(auc => auc.id);
      const { error: deleteError } = await supabase
        .from('mstc_auctions')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error('[Cleanup] Error deleting expired auctions:', deleteError.message);
      } else {
        console.log(`[Cleanup] Expired auctions cleanup complete. Removed ${expiredAuctions.length} database records.`);
      }
    } else {
      console.log('[Cleanup] No expired auctions found.');
    }
  } catch (err: any) {
    console.error('[Cleanup] Exception during expired auctions cleanup:', err.message);
  }

  console.log('[1/3] Launching interactive browser context...');
  console.log('------------------------------------------------------------');
  console.log('ACTION REQUIRED:');
  console.log('1. A Chrome browser window will open.');
  console.log('2. Select your filters, solve the CAPTCHA, and click "Search".');
  console.log('3. Once the search results page loads, return here and press [Enter].');
  console.log('------------------------------------------------------------');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  try {
    await page.goto('https://www.mstcecommerce.com/auctionhome/aucsearch/search.jsp', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for the user to press Enter in the terminal
    await waitForUserConfirmation('\nPress [Enter] here once the search results page has finished loading...\n');

    // Save session cookies to a local file for the background worker
    const cookies = await page.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    fs.writeFileSync('cookies.txt', cookieString, 'utf-8');
    console.log('Session cookies saved to cookies.txt for background worker.');

    console.log('[Diagnostics] Dumping page HTML to debug_page.html for inspection...');
    const mainHtml = await page.content();
    fs.writeFileSync('debug_page.html', `<!-- MAIN FRAME HTML -->\n${mainHtml}`);
    
    const frames = page.frames();
    console.log(`[Diagnostics] Found ${frames.length} frames/iframes on the page.`);
    for (let i = 0; i < frames.length; i++) {
      try {
        const frameHtml = await frames[i].content();
        fs.appendFileSync('debug_page.html', `\n\n<!-- FRAME ${i} HTML (URL: ${frames[i].url()}) -->\n${frameHtml}`);
      } catch (e: any) {
        console.warn(`Could not dump frame ${i}:`, e.message);
      }
    }
    console.log('[Diagnostics] HTML dump complete. Checking elements...');

    console.log('[2/3] Extracting structural rows from search results page...');

    const completeScrapedInventory: any[] = [];
    const framesToScrape = page.frames();

    for (const frame of framesToScrape) {
      try {
        const parsedBatch = await frame.evaluate(() => {
          const structuralRows: any[] = [];
          const links = Array.from(document.querySelectorAll('#finalAppendBody tr a'));
          
          const targetLinks = links.filter(a => {
            const onclick = a.getAttribute('onclick') || '';
            return onclick.includes('downloadCatalogue');
          });

          targetLinks.forEach((a) => {
            const onclickText = a.getAttribute('onclick') || '';
            const match = onclickText.match(/downloadCatalogue\((\d+)\)/);
            const aucId = match ? match[1] : '';
            if (!aucId) return;

            const row = a.closest('tr');
            let categoryName = 'Industrial / Commercial Scrap Lots';
            let dateStr = '';
            let durationStr = '';
            
            if (row) {
              const cells = Array.from(row.querySelectorAll('td'));
              const cellHTML = cells[1]?.innerHTML || '';
              categoryName = cellHTML
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/?[^>]+(>|$)/g, '\n')
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join(', ') || 'Industrial / Commercial Scrap Lots';
              dateStr = cells[3]?.textContent?.trim() || '';
              durationStr = cells[4]?.textContent?.trim() || '';
            }

            const firstLine = a.textContent?.split('\n')[0].trim() || '';
            const auctionNumber = firstLine.replace(/Download PDF/i, '').trim() || 'MSTC-' + aucId;
            
            const parts = auctionNumber.split('/');
            let sellerName = 'MSTC Seller';
            if (parts.length > 2) {
              const parsedSeller = parts[2].trim();
              if (parsedSeller) sellerName = parsedSeller;
            }

            structuralRows.push({
              aucId,
              mstc_auction_number: auctionNumber,
              seller_name: sellerName,
              category_name: categoryName,
              dateStr,
              durationStr
            });
          });

          return structuralRows;
        });

        if (parsedBatch && parsedBatch.length > 0) {
          completeScrapedInventory.push(...parsedBatch);
        }
      } catch (frameErr: any) {
        console.warn('Frame scanning warning:', frameErr.message);
      }
    }

    if (completeScrapedInventory.length === 0) {
      console.warn('Scraper parsed 0 items. Ingestion execution halted.');
      await browser.close();
      return;
    }

    console.log(`[3/3] Found ${completeScrapedInventory.length} items. Mapping and merging into database...`);

    const finalRows: DiscoveredRow[] = completeScrapedInventory.map(item => {
      const baselineTime = new Date();
      let opening_date = new Date(baselineTime.getTime() + 12 * 60 * 60 * 1000).toISOString();
      let closing_date = new Date(baselineTime.getTime() + 96 * 60 * 60 * 1000).toISOString();

      // Parse opening date (DD/MM/YYYY)
      if (item.dateStr) {
        const parts = item.dateStr.split('/');
        if (parts.length === 3) {
          opening_date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`).toISOString();
        }
      }

      // Parse closing date (DD/MM/YYYY HH:mm:ss)
      if (item.durationStr) {
        const parts = item.durationStr.split(' To ');
        const closingPart = parts[1] || parts[0];
        if (closingPart) {
          const dateAndTime = closingPart.split(' ');
          const dateComponents = dateAndTime[0]?.split('/');
          const timeComponents = dateAndTime[1];
          if (dateComponents && dateComponents.length === 3) {
            closing_date = new Date(`${dateComponents[2]}-${dateComponents[1]}-${dateComponents[0]}T${timeComponents || '18:00:00'}Z`).toISOString();
          }
        }
      }

      // Shorten the auction number to fit in character varying(100)
      let mstc_auction_number = item.mstc_auction_number;
      let location = 'India';
      const parts = mstc_auction_number.split('/');
      
      if (parts.length > 1) {
        const region = parts[1].toUpperCase().trim();
        const regionMap: Record<string, string> = {
          LKO: 'Uttar Pradesh',
          ERO: 'West Bengal',
          CDG: 'Punjab & Haryana',
          JPR: 'Rajasthan',
          BBR: 'Odisha',
          RNC: 'Jharkhand',
          SRO: 'Tamil Nadu',
          VZG: 'Andhra Pradesh',
          BPL: 'Madhya Pradesh',
          WRO: 'Maharashtra',
          BLR: 'Karnataka',
          TVC: 'Kerala',
          RPR: 'Chhattisgarh',
          VAD: 'Gujarat',
          NRO: 'Delhi & NCR',
          GHY: 'Assam & North East',
          HYD: 'Telangana'
        };
        location = regionMap[region] || region;
      }

      if (mstc_auction_number.length > 100) {
        const shortened = parts.map((p: string) => {
          if (p.length > 15) {
            return p.substring(0, 12) + '...';
          }
          return p;
        });
        mstc_auction_number = shortened.join('/').substring(0, 100);
      }

      const parsed = parseCategoryAndSubcategory(item.category_name);
      const category_name = `${parsed.category} | ${parsed.subcategory}`;

      return {
        mstc_auction_number,
        seller_name: item.seller_name.substring(0, 255),
        category_name: category_name.substring(0, 100),
        location,
        opening_date,
        closing_date,
        source_pdf_url: `https://www.mstcecommerce.com/auctionhome/mstc/auction_detailed_report_pdf.jsp?auc=${item.aucId}`,
        raw_materials_text: `Enterprise raw materials ledger managed by ${item.seller_name}. Distribution field index: ${category_name}. System Registry Tracking Node ID: ${mstc_auction_number}`,
        asset_status: 'pending',
        retry_count: 0,
        is_reauction: false,
        original_auction_number: null,
        parent_auction_id: null
      };
    });

    console.log("Analyzing batch for potential re-auctions...");
    for (const row of finalRows) {
      // 1. Query DB for potential older matching parent auction
      const { data: dbMatches, error: dbError } = await supabase
        .from('mstc_auctions')
        .select('id, mstc_auction_number, opening_date')
        .eq('seller_name', row.seller_name)
        .eq('location', row.location)
        .eq('category_name', row.category_name)
        .neq('mstc_auction_number', row.mstc_auction_number)
        .lt('opening_date', row.opening_date)
        .order('opening_date', { ascending: false });

      if (dbError) {
        console.error(`[Re-auction Check] Error querying DB for parent of ${row.mstc_auction_number}:`, dbError.message);
        continue;
      }

      let parent = dbMatches && dbMatches.length > 0 ? dbMatches[0] : null;

      // 2. Query within current batch for potential older matching parent auction
      for (const otherRow of finalRows) {
        if (
          otherRow.mstc_auction_number !== row.mstc_auction_number &&
          otherRow.seller_name === row.seller_name &&
          otherRow.location === row.location &&
          otherRow.category_name === row.category_name &&
          otherRow.opening_date < row.opening_date
        ) {
          if (!parent || new Date(otherRow.opening_date).getTime() > new Date(parent.opening_date).getTime()) {
            parent = {
              id: null as any,
              mstc_auction_number: otherRow.mstc_auction_number,
              opening_date: otherRow.opening_date
            };
          }
        }
      }

      if (parent) {
        row.is_reauction = true;
        row.original_auction_number = parent.mstc_auction_number;
        if (parent.id) {
          row.parent_auction_id = parent.id;
        }
      }
    }

    const { error: upsertError } = await supabase
      .from('mstc_auctions')
      .upsert(finalRows, { 
        onConflict: 'mstc_auction_number',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      console.error('Ingestion Pipeline Conflict Error:', upsertError.message);
      await browser.close();
      return;
    }

    // Resolve parent_auction_id references for re-auctions whose parents were in the same batch
    const reauctionsWithoutParentId = finalRows.filter(r => r.is_reauction && !r.parent_auction_id);
    if (reauctionsWithoutParentId.length > 0) {
      console.log(`Resolving parent IDs for ${reauctionsWithoutParentId.length} batch-internal re-auctions...`);
      const originalNumbers = reauctionsWithoutParentId.map(r => r.original_auction_number).filter(Boolean) as string[];
      if (originalNumbers.length > 0) {
        const { data: parentsData, error: parentsError } = await supabase
          .from('mstc_auctions')
          .select('id, mstc_auction_number')
          .in('mstc_auction_number', originalNumbers);

        if (!parentsError && parentsData) {
          const parentIdMap = new Map<string, string>();
          parentsData.forEach(p => parentIdMap.set(p.mstc_auction_number, p.id));

          for (const row of reauctionsWithoutParentId) {
            if (row.original_auction_number) {
              const pid = parentIdMap.get(row.original_auction_number);
              if (pid) {
                row.parent_auction_id = pid;
                await supabase
                  .from('mstc_auctions')
                  .update({ parent_auction_id: pid })
                  .eq('mstc_auction_number', row.mstc_auction_number);
              }
            }
          }
        }
      }
    }

    console.log(`Deduplicated data merge complete. Saved ${finalRows.length} records.`);
    console.log('Database records populated as pending. Please start the background worker (npx tsx assetWorker.ts) to upload documents.');

  } catch (error) {
    console.error('System fault caught during execution layer:', error);
  } finally {
    await browser.close();
  }
}

executeDiscoveryScraper();