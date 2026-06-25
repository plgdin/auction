import { MstcSearchService } from './src/services/publicService.ts';

async function test() {
  try {
    const result = await MstcSearchService.searchMarketplaceCatalog('', {});
    console.log('Result count:', result.count);
    console.log('Result data length:', result.data.length);
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
