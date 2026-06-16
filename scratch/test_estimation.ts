import { getEstimatedMarketPrice as estUtils } from '../src/utils/valuationUtils';
import { getEstimatedMarketPrice as estHelpers } from '../src/utils/mstcHelpers';

console.log('utils for MS scrap:', estUtils('MS scrap', 'Metal | Iron and steel'));
console.log('helpers for MS scrap:', estHelpers('MS scrap', 'Metal | Iron and steel'));
console.log('utils for Iron drums small:', estUtils('Iron drums small', 'Metal | Iron and steel'));
console.log('helpers for Iron drums small:', estHelpers('Iron drums small', 'Metal | Iron and steel'));
console.log('utils for GI:', estUtils('GI', 'Metal | Iron and steel'));
console.log('helpers for GI:', estHelpers('GI', 'Metal | Iron and steel'));
