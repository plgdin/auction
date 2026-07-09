import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

async function test() {
  try {
    const { MstcSearchService } = await import('./src/services/publicService.ts');
    const result = await MstcSearchService.searchMarketplaceCatalog('', {});
    console.log('Result count:', result.count);
    console.log('Result data length:', result.data.length);
  } catch (e) {
    console.error('Error:', e);
  }
}

test();

