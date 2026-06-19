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

export const getNumericPrice = (priceStr: string): number => {
  if (!priceStr) return 0;
  const cleanStr = priceStr.replace(/,/g, '');
  const match = cleanStr.match(/₹?\s*(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
};



import { getEstimatedMarketPrice } from './mstcHelpers';

export { getEstimatedMarketPrice };

export const calculateLotValue = (qty: string, unit: string, marketPrice: string): number => {
  const price = getNumericPrice(marketPrice);
  const qtyNum = getNumericQty(qty);
  // Simplify value calculation based on logic inside calculateTotalMarketValue
  let factor = 1;
  const isKgPrice = (marketPrice || '').toLowerCase().includes('/ kg');
  const isTonPrice = (marketPrice || '').toLowerCase().includes('/ ton');
  const isQuintalPrice = (marketPrice || '').toLowerCase().includes('/ quintal');
  const partUnit = (unit || '').toLowerCase().trim();

  const weightUnits = ['kg', 'kgs', 'kilogram', 'kilograms', 'mt', 'ton', 'tons', 'tonne', 'tonnes', 'quintal', 'quintals'];
  const isWeightUnit = weightUnits.some(w => partUnit.includes(w) || w.includes(partUnit));

  if (isWeightUnit) {
    if (isKgPrice) {
      if (partUnit === 'mt' || partUnit.includes('ton') || partUnit.includes('tonne')) factor = 1000;
    } else if (isTonPrice) {
      if (partUnit.includes('kg') || partUnit.includes('kilogram')) factor = 0.001;
      else if (partUnit === 'mt') factor = 1;
    } else if (isQuintalPrice) {
      if (partUnit === 'mt' || partUnit.includes('ton') || partUnit.includes('tonne')) factor = 10;
      else if (partUnit.includes('kg')) factor = 0.01;
    }
  } else {
    let itemWeightInKg = 10;
    if (isKgPrice) factor = itemWeightInKg;
    else if (isTonPrice) factor = itemWeightInKg / 1000;
    else if (isQuintalPrice) factor = itemWeightInKg / 100;
  }
  
  return price * qtyNum * factor;
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
      const priceMatch = cleanPrice.match(/(?:₹|Ôé╣)\s*(\d+)/);
      price = priceMatch ? parseInt(priceMatch[1], 10) : 0;
    }
    if (price <= 1) {
      priceStr = getEstimatedMarketPrice(lot.description || '', categoryName, lot.qty || '1', lot.unit || 'Nos');
      cleanPrice = priceStr.replace(/,/g, '');
      const priceMatch = cleanPrice.match(/(?:₹|Ôé╣)\s*(\d+)/);
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

      const weightUnits = ['kg', 'kgs', 'kilogram', 'kilograms', 'mt', 'ton', 'tons', 'tonne', 'tonnes', 'quintal', 'quintals'];
      const isWeightUnit = weightUnits.some(w => partUnit.includes(w) || w.includes(partUnit));

      if (isWeightUnit) {
        if (isKgPrice) {
          if (partUnit === 'mt' || partUnit.includes('ton') || partUnit.includes('tonne')) {
            factor = 1000;
          }
        } else if (isTonPrice) {
          if (partUnit.includes('kg') || partUnit.includes('kilogram')) {
            factor = 0.001;
          } else if (partUnit === 'mt') {
            factor = 1;
          }
        } else if (isQuintalPrice) {
          if (partUnit === 'mt' || partUnit.includes('ton') || partUnit.includes('tonne')) {
            factor = 10;
          } else if (partUnit.includes('kg')) {
            factor = 0.01;
          }
        }
      } else {
        // Count-based unit (Nos, Unit, Pcs, etc.) - apply weight-based factor fallback
        let itemWeightInKg = 10; // default 10 kg fallback
        const descLower = (lot.description || '').toLowerCase();
        
        const weightMatch = descLower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilogram|kilograms)\b/);
        if (weightMatch) {
          itemWeightInKg = parseFloat(weightMatch[1]);
        } else {
          if (descLower.includes('drum')) {
            if (descLower.includes('small') || descLower.includes('light')) {
              itemWeightInKg = 15;
            } else if (descLower.includes('210') || descLower.includes('55 gal') || descLower.includes('55-gal')) {
              itemWeightInKg = 200;
            } else {
              itemWeightInKg = 20;
            }
          } else if (descLower.includes('transformer') || descLower.includes('tf')) {
            itemWeightInKg = 500;
          } else if (descLower.includes('motor') || descLower.includes('generator') || descLower.includes('engine') || descLower.includes('pump')) {
            itemWeightInKg = 100;
          } else if (descLower.includes('battery') || descLower.includes('cell')) {
            itemWeightInKg = 15;
          } else if (descLower.includes('fan') || descLower.includes('ac') || descLower.includes('cooler') || descLower.includes('refrigerator')) {
            itemWeightInKg = 12;
          } else if (descLower.includes('chair') || descLower.includes('table') || descLower.includes('furniture') || descLower.includes('desk')) {
            itemWeightInKg = 8;
          } else if (descLower.includes('pipe') || descLower.includes('structure') || descLower.includes('angle') || descLower.includes('channel') || descLower.includes('beam') || descLower.includes('girder') || descLower.includes('rail')) {
            itemWeightInKg = 25;
          } else if (descLower.includes('cable') || descLower.includes('wire')) {
            itemWeightInKg = 2;
          } else if (descLower.includes('panel') || descLower.includes('cabinet') || descLower.includes('rack') || descLower.includes('switchboard')) {
            itemWeightInKg = 50;
          } else if (descLower.includes('vehicle') || descLower.includes('car') || descLower.includes('jeep') || descLower.includes('bolero') || descLower.includes('gypsy') || descLower.includes('omni')) {
            itemWeightInKg = 1200;
          } else if (descLower.includes('two wheeler') || descLower.includes('motorcycle') || descLower.includes('scooter') || descLower.includes('bike') || descLower.includes('bullet') || descLower.includes('splendor')) {
            itemWeightInKg = 100;
          } else if (descLower.includes('bus') || descLower.includes('truck') || descLower.includes('lorry')) {
            itemWeightInKg = 5000;
          } else if (descLower.includes('computer') || descLower.includes('laptop') || descLower.includes('printer') || descLower.includes('monitor')) {
            itemWeightInKg = 5;
          }
        }

        if (isKgPrice) {
          factor = itemWeightInKg;
        } else if (isTonPrice) {
          factor = itemWeightInKg / 1000;
        } else if (isQuintalPrice) {
          factor = itemWeightInKg / 100;
        }
      }

      total += price * partQty * factor;
    }
  }
  return Math.round(total);
};
