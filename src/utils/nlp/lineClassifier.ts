/**
 * Lightweight custom Naive Bayes Classifier in pure TypeScript.
 * This runs safely in browser/Vite environments without native dependencies.
 */

type Category = 'INVENTORY' | 'TERMS' | 'GIBBERISH';

export class LineClassifier {
  private vocab: Set<string> = new Set();
  private categoryCounts: Record<Category, number> = { INVENTORY: 0, TERMS: 0, GIBBERISH: 0 };
  private wordCounts: Record<Category, Record<string, number>> = { INVENTORY: {}, TERMS: {}, GIBBERISH: {} };
  private totalDocs = 0;

  private tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 0);
  }

  train(text: string, category: Category) {
    const tokens = this.tokenize(text);
    this.categoryCounts[category]++;
    this.totalDocs++;
    
    for (const token of tokens) {
      this.vocab.add(token);
      this.wordCounts[category][token] = (this.wordCounts[category][token] || 0) + 1;
    }
  }

  classify(text: string): Category {
    const tokens = this.tokenize(text);
    if (tokens.length === 0) return 'GIBBERISH';

    let bestCategory: Category = 'INVENTORY';
    let maxScore = -Infinity;

    for (const cat of ['INVENTORY', 'TERMS', 'GIBBERISH'] as Category[]) {
      if (this.categoryCounts[cat] === 0) continue;

      // log( P(category) )
      let score = Math.log(this.categoryCounts[cat] / this.totalDocs);

      const totalWordsInCat = Object.values(this.wordCounts[cat]).reduce((a, b) => a + b, 0);
      const vocabSize = this.vocab.size;

      for (const token of tokens) {
        // Laplace smoothing
        const count = this.wordCounts[cat][token] || 0;
        const prob = (count + 1) / (totalWordsInCat + vocabSize);
        score += Math.log(prob);
      }

      if (score > maxScore) {
        maxScore = score;
        bestCategory = cat;
      }
    }

    return bestCategory;
  }
}

// Singleton instance pre-trained with basic examples
export const globalClassifier = new LineClassifier();

const inventoryExamples = [
  "Copper and Cu-Ni Pipes Sections Off cuts 8.0 MT",
  "Scrap Iron Angle and Channels 12 tons",
  "Unserviceable lead acid batteries 45 Nos",
  "Used commercial vehicle 1 Unit",
  "Aluminum cables wire scrap 500 Kgs",
  "Obsolete Machinery Parts 1 Lot",
  "E-Waste computer laptops 50 kg",
  "Steel pipes ms scrap 2 MT",
  "Brass scrap turnings 150 kg",
  "Heavy duty compressor unit 1 No",
  "200 Pair UG Cable Pieces 1*5 Mtrs Sojat City Main TE",
  "10 Pair UG Cable Pieces Chandawal",
  "400 Pair UG Cable Pieces Bagri Nagar"
];

const termsExamples = [
  "Guide for making payment to MSTC through e-Payment",
  "Rate The bid value shall be the basic price",
  "Applicable levies and duties during the pendency",
  "All materials are sold on an As-Is-Where-Is basis",
  "Successful bidder has to follow security rules",
  "Inspection of materials can be done during working hours",
  "EMD amount will be forfeited if payment is not made",
  "Taxes and duties are extra as applicable",
  "The seller reserves the right to withdraw any lot",
  "Delivery order will be issued after full payment"
];

const gibberishExamples = [
  "I ew wen Waa wna",
  "eid ae ame we",
  "sR22pos02 Rmn",
  "sri we wo sow woes ose om",
  "on wan woe own ee",
  "xqk zxm qqqq",
  "123 456 789 000",
  "BR2IP0R0A WG 2007 100840 35840"
];

for (const ex of inventoryExamples) globalClassifier.train(ex, 'INVENTORY');
for (const ex of termsExamples) globalClassifier.train(ex, 'TERMS');
for (const ex of gibberishExamples) globalClassifier.train(ex, 'GIBBERISH');

export function classifyLine(text: string): 'INVENTORY' | 'TERMS' | 'GIBBERISH' {
  // Simple heuristic overrides before ML
  if (text.length > 200) return 'TERMS'; // Very long sentences are usually T&C
  
  // High confidence terms words
  const lower = text.toLowerCase();
  if (lower.includes('gst') || lower.includes('bidder') || lower.includes('payment') || lower.includes('emd')) {
    if (!lower.includes('scrap') && !lower.includes('waste')) {
      return 'TERMS';
    }
  }

  return globalClassifier.classify(text);
}
