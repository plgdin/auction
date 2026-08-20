/**
 * Intelligent Semantic Image Resolver for GeM Bids & GeM Auctions
 * Accurately matches item titles and procurement specifications to high-quality, relevant category visuals.
 */

interface ImageMappingRule {
  keywords: string[];
  imageUrl: string;
}

const IMAGE_RULES: ImageMappingRule[] = [
  // 1. Food Preparation, Kitchen Machinery & Canteen Equipment
  {
    keywords: [
      'roti', 'chapati', 'kitchen', 'cooking', 'canteen', 'bakery', 'dough', 'kneader',
      'oven', 'refrigerator', 'freezer', 'mess', 'vessel', 'utensil', 'catering', 'flour',
      'grinder', 'blender', 'food warmer', 'cookware'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=75',
  },

  // 2. Whiteboards, Notice Boards & Display Systems
  {
    keywords: [
      'white board', 'whiteboard', 'green board', 'black board', 'notice board', 'display board',
      'chalkboard', 'pin board', 'soft board', 'bulletin board', 'podium', 'presentation board'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1577412647305-991150c7d163?w=600&auto=format&fit=crop&q=75',
  },

  // 3. Office & Institutional Furniture
  {
    keywords: [
      'chair', 'table', 'desk', 'furniture', 'almirah', 'cabinet', 'sofa', 'cupboard',
      'rack', 'shelving', 'bench', 'workstation', 'modular', 'storage unit', 'revolving chair',
      'executive chair', 'reception', 'bed', 'mattress'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&auto=format&fit=crop&q=75',
  },

  // 4. Maintenance, Repair, Overhauling & Facility Services
  {
    keywords: [
      'service', 'repair', 'overhauling', 'maintenance', 'amc', 'annual maintenance',
      'hiring', 'manpower', 'sanitation', 'security service', 'facility', 'housekeeping',
      'pest control', 'gardening', 'servicing', 'upkeep'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=75',
  },

  // 5. Vehicles, Fleet & Transportation
  {
    keywords: [
      'vehicle', 'car', 'truck', 'bus', 'ambulance', 'jeep', 'tractor', 'van',
      'automotive', 'tyre', 'tire', 'battery vehicle', 'scrap vehicle', 'auto',
      'motorcycle', 'scooter', 'tempo', 'trolley', 'crane', 'forklift'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600&auto=format&fit=crop&q=75',
  },

  // 6. IT Hardware, Computers & Peripherals
  {
    keywords: [
      'computer', 'laptop', 'desktop', 'server', 'printer', 'scanner', 'monitor',
      'ups', 'networking', 'switch', 'router', 'projector', 'display', 'cctv',
      'camera', 'hard disk', 'ssd', 'keyboard', 'mouse', 'software', 'antivirus',
      'toner', 'cartridge', 'multimedia projector'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=75',
  },

  // 7. Electrical, Power & Solar Engineering
  {
    keywords: [
      'cable', 'wire', 'transformer', 'generator', 'diesel generator', 'dg set',
      'solar', 'solar panel', 'photovoltaic', 'led', 'light', 'luminaire', 'bulb',
      'switchgear', 'inverter', 'substation', 'battery', 'pole', 'street light'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=600&auto=format&fit=crop&q=75',
  },

  // 8. Paint, Chemicals & Building Materials
  {
    keywords: [
      'paint', 'primer', 'enamel', 'bituminous', 'acid', 'chemical', 'cement',
      'construction', 'building', 'tiles', 'pipe', 'pipeline', 'valve', 'steel',
      'iron', 'barbed wire', 'fencing', 'gravel', 'sand', 'bricks', 'coating'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&auto=format&fit=crop&q=75',
  },

  // 9. Medical, Healthcare, Hospital & Surgical
  {
    keywords: [
      'medical', 'hospital', 'surgical', 'medicine', 'pharma', 'icu', 'ventilator',
      'mask', 'gloves', 'syringe', 'health', 'diagnostic', 'x-ray', 'wheelchair',
      'bandage', 'dressing', 'stretcher', 'dental', 'laboratory', 'pathology'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&auto=format&fit=crop&q=75',
  },

  // 10. Uniforms, Textiles & Safety Wear
  {
    keywords: [
      'uniform', 'cloth', 'textile', 'dress', 'boot', 'shoe', 'garment', 'towel',
      'linen', 'bedsheet', 'jacket', 'safety jacket', 'helmet', 'gloves', 'coverall'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&auto=format&fit=crop&q=75',
  },

  // 11. Machinery, Plant & Industrial Tools
  {
    keywords: [
      'machine', 'machinery', 'pump', 'motor', 'compressor', 'lathe', 'drill',
      'welding', 'boiler', 'press', 'industrial', 'plant', 'fabrication'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&auto=format&fit=crop&q=75',
  },

  // 12. Paper, Printing, Stationery & Books
  {
    keywords: [
      'paper', 'photocopy', 'stationery', 'book', 'register', 'diary', 'envelope',
      'printing', 'publication', 'forms', 'folder', 'file'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&auto=format&fit=crop&q=75',
  },

  // 13. Land, Real Estate & Civil Infrastructure
  {
    keywords: [
      'land', 'plot', 'building', 'commercial', 'residential', 'flat', 'office space',
      'property', 'estate', 'warehouse', 'shed', 'godown'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&auto=format&fit=crop&q=75',
  },
];

const DEFAULT_PROCUREMENT_IMAGE =
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=75';

/**
 * Returns a highly relevant, context-aware image URL for any GeM item based on title and category.
 */
export function getGemItemImage(title: string = '', category: string = ''): string {
  const text = `${title} ${category}`.toLowerCase();

  for (const rule of IMAGE_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        return rule.imageUrl;
      }
    }
  }

  return DEFAULT_PROCUREMENT_IMAGE;
}
