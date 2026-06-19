import metadata from '../lib/ml/scrap_model_metadata.json';
import { marketPriceService } from './marketPriceService';

export interface PredictorInputs {
  Grade: string;
  Region: string;
  LME_Steel_Scrap_USD: number;
  USD_INR: number;
  Domestic_Iron_Ore_INR: number;
  Domestic_Coal_INR: number;
  Monsoon_Season: number;
  Construction_Index: number;
}

export const ML_DEFAULT_INPUTS: PredictorInputs = {
  Grade: metadata.grades[0],
  Region: metadata.regions[0],
  LME_Steel_Scrap_USD: 425.0,
  USD_INR: 83.85,
  Domestic_Iron_Ore_INR: 5250.0,
  Domestic_Coal_INR: 9200.0,
  Monsoon_Season: 1, // June is monsoon
  Construction_Index: 114.2
};

export const mlPredictionService = {
  getMetadata() {
    return metadata;
  },

  predict(inputs: PredictorInputs): { price: number, breakdown: Record<string, number> } {
    const coefs = metadata.coefficients as Record<string, number>;
    let price = metadata.intercept;
    const breakdown: Record<string, number> = {
      'Base Intercept': metadata.intercept
    };

    // Grade
    const gradeKey = `Grade_${inputs.Grade}`;
    if (coefs[gradeKey] !== undefined) {
      price += coefs[gradeKey];
      breakdown[`Grade (${inputs.Grade})`] = coefs[gradeKey];
    }

    // Region
    const regionKey = `Region_${inputs.Region}`;
    if (coefs[regionKey] !== undefined) {
      price += coefs[regionKey];
      breakdown[`Region (${inputs.Region})`] = coefs[regionKey];
    }

    // Numerics
    const lmeImpact = (coefs['LME_Steel_Scrap_USD'] || 0) * inputs.LME_Steel_Scrap_USD;
    price += lmeImpact;
    breakdown['LME Steel Scrap'] = lmeImpact;

    const usdImpact = (coefs['USD_INR'] || 0) * inputs.USD_INR;
    price += usdImpact;
    breakdown['USD/INR FX'] = usdImpact;

    const ironImpact = (coefs['Domestic_Iron_Ore_INR'] || 0) * inputs.Domestic_Iron_Ore_INR;
    price += ironImpact;
    breakdown['Iron Ore'] = ironImpact;

    const coalImpact = (coefs['Domestic_Coal_INR'] || 0) * inputs.Domestic_Coal_INR;
    price += coalImpact;
    breakdown['Coal Energy'] = coalImpact;

    const monsoonImpact = (coefs['Monsoon_Season'] || 0) * inputs.Monsoon_Season;
    price += monsoonImpact;
    breakdown['Monsoon Season'] = monsoonImpact;

    const constructionImpact = (coefs['Construction_Index'] || 0) * inputs.Construction_Index;
    price += constructionImpact;
    breakdown['Construction Index'] = constructionImpact;

    return { 
      price: Math.max(0, price), 
      breakdown 
    };
  },

  /**
   * Compares the ML predicted price with the "Current Way" (database entered price)
   */
  async compareWithCurrentWay(inputs: PredictorInputs): Promise<{
    mlPrice: number;
    dbPrice: number | null;
    avgPrice: number;
  }> {
    const mlResult = this.predict(inputs);
    
    // The "current way" maps to the 'scrap_steel' or specific grade in the market prices DB.
    // Let's fetch the live database prices
    const prices = await marketPriceService.fetchCommodityPrices();
    
    // Map Grade to a commodity ID in our DB
    // e.g., if it's steel/iron
    const dbCommodity = prices.find(p => p.id === 'steel_iron_ferrous' || p.name.includes(inputs.Grade) || p.keywords?.includes(inputs.Grade.toLowerCase()));
    
    const dbPrice = dbCommodity ? dbCommodity.currentPrice * 1000 : null; // DB price is usually per kg, ML is per Ton!
    
    const avgPrice = dbPrice !== null ? (mlResult.price + dbPrice) / 2 : mlResult.price;
    
    return {
      mlPrice: mlResult.price,
      dbPrice: dbPrice,
      avgPrice: avgPrice
    };
  }
};
