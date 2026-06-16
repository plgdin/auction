export const getNumericQty = (qtyStr: string): number => {
  if (!qtyStr) return 1;
  const parts = qtyStr.split('+');
  let total = 0;
  for (const part of parts) {
    const clean = part.replace(/,/g, '').trim();
    const num = parseFloat(clean);
    if (!isNaN(num)) {
      total += num;
    }
  }
  return total > 0 ? total : 1;
};

const hasWord = (text: string, kw: string): boolean => {
  if (kw.includes(' ')) {
    return text.includes(kw);
  }
  const regex = new RegExp(`\\b${kw}(?:s|es)?\\b`, 'i');
  return regex.test(text);
};

export const getEstimatedMarketPrice = (description: string, categoryName: string = ''): string => {
  const desc = (description || '').toLowerCase();
  const cat = (categoryName || '').toLowerCase();

  const matches = (keywords: string[]) => {
    return keywords.some(kw => hasWord(desc, kw) || hasWord(cat, kw));
  };

  if (matches(['copper', 'cu'])) {
    return '₹780 / kg';
  }
  if (matches(['aluminum', 'aluminium', 'al'])) {
    return '₹235 / kg';
  }
  if (matches(['battery', 'batteries', 'vrla', 'lead acid'])) {
    return '₹120 / kg';
  }
  if (matches(['lead'])) {
    return '₹185 / kg';
  }
  if (matches(['brass'])) {
    return '₹480 / kg';
  }
  if (matches(['zinc'])) {
    return '₹220 / kg';
  }
  if (matches(['steel', 'iron', 'ferrous', 'pipe', 'angle', 'channel', 'structure', 'railway', 'ms scrap'])) {
    return '₹38,500 / Ton';
  }
  if (matches(['oil', 'lubricant', 'lubricating', 'waste oil', 'petroleum'])) {
    return '₹85 / Liter';
  }
  if (matches(['wheat'])) {
    return '₹2,450 / Quintal';
  }
  if (matches(['rice', 'paddy'])) {
    return '₹2,200 / Quintal';
  }
  if (matches(['coal', 'lignite'])) {
    return '₹8,400 / Ton';
  }
  if (matches(['sand', 'mine', 'stone', 'block'])) {
    return '₹4,500 / Ton';
  }
  if (matches(['cable', 'wire'])) {
    return '₹340 / kg';
  }
  if (matches(['computer', 'laptop', 'switch', 'motherboard', 'electronic', 'smps', 'panel', 'it equipment'])) {
    return '₹14,500 / Unit';
  }
  if (matches(['bus', 'buses', 'truck', 'rig', 'compressor', 'machinery', 'lorry', 'coach', 'forklift', 'dumper', 'tractor', 'loader', 'excavator'])) {
    return '₹3,50,000 / Unit';
  }
  if (matches(['car', 'jeep', 'armada', 'motorcycle', 'scooter', 'wheeler', 'vehicle', 'ambulance', 'sumo', 'indigo', 'bolero', 'gypsy', 'omni', 'enfield', 'bullet', 'bike', 'tempo', 'tonner', 'splendor', 'ct 100', 'discover', 'solo', 'jupiter', 'activa', 'boxer', 'qualis', 'etios', 'sunny', 'two-wheeler', 'two wheeler', 'four-wheeler', 'four wheeler', 'hero', 'tvs', 'bajaj', 'motocorp'])) {
    if (desc.includes('enfield') || desc.includes('bullet') || desc.includes('motorcycle') || desc.includes('bike') || desc.includes('scooter') || desc.includes('splendor') || desc.includes('ct 100') || desc.includes('discover') || desc.includes('solo') || desc.includes('jupiter') || desc.includes('activa') || desc.includes('boxer') || desc.includes('two-wheeler') || desc.includes('two wheeler') || desc.includes('hero') || desc.includes('tvs') || desc.includes('bajaj') || desc.includes('motocorp')) {
      return '₹45,000 / Unit';
    }
    return '₹1,50,000 / Unit';
  }
  if (matches(['flat', 'plot', 'land', 'building', 'shop', 'office space', 'showroom', 'immovable', 'residential', 'commercial space'])) {
    return '₹50,00,000 / Unit';
  }
  return '₹2,500 / Ton';
};

export const calculateTotalMarketValue = (items: any[], categoryName: string = ''): number => {
  if (!items || !Array.isArray(items)) return 0;
  let total = 0;
  for (const lot of items) {
    let priceStr = lot.marketPrice || '';
    let price = 0;
    let cleanPrice = '';
    if (priceStr) {
      cleanPrice = priceStr.replace(/,/g, '');
      const priceMatch = cleanPrice.match(/₹\s*(\d+)/);
      price = priceMatch ? parseInt(priceMatch[1], 10) : 0;
    }
    if (price <= 1) {
      priceStr = getEstimatedMarketPrice(lot.description || '', categoryName);
      cleanPrice = priceStr.replace(/,/g, '');
      const priceMatch = cleanPrice.match(/₹\s*(\d+)/);
      price = priceMatch ? parseInt(priceMatch[1], 10) : 0;
    }

    if (price <= 0) continue;

    const qtyStr = lot.qty || '1';
    const parts = qtyStr.split('+');

    for (const part of parts) {
      const cleanPart = part.replace(/,/g, '').trim();
      const partQty = parseFloat(cleanPart);
      if (isNaN(partQty) || partQty <= 0) continue;

      const unitMatch = cleanPart.match(/[\d\.]+\s*([a-zA-Z][a-zA-Z\.]*)/);
      const partUnit = (unitMatch ? unitMatch[1] : lot.unit || '').toLowerCase().trim();

      let factor = 1;
      const isKgPrice = cleanPrice.toLowerCase().includes('/ kg');
      const isTonPrice = cleanPrice.toLowerCase().includes('/ ton');
      const isQuintalPrice = cleanPrice.toLowerCase().includes('/ quintal');

      if (isKgPrice) {
        if (partUnit.includes('mt') || partUnit.includes('ton') || partUnit.includes('tonne')) {
          factor = 1000;
        }
      } else if (isTonPrice) {
        if (partUnit.includes('kg') || partUnit.includes('kgs') || partUnit.includes('kilogram')) {
          factor = 0.001;
        }
      } else if (isQuintalPrice) {
        if (partUnit.includes('mt') || partUnit.includes('ton') || partUnit.includes('tonne')) {
          factor = 10;
        } else if (partUnit.includes('kg') || partUnit.includes('kgs')) {
          factor = 0.01;
        }
      }

      total += price * partQty * factor;
    }
  }
  return Math.round(total);
};
