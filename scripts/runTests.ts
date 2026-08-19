import dotenv from 'dotenv';
import { startVitest } from 'vitest/node';

// Load environment variables before Vitest initializes
dotenv.config({ path: '.env.local' });
dotenv.config();

console.log('--- Initializing Environment ---');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'Loaded' : 'Missing');

async function main() {
  console.log('==================================================');
  console.log('RUNNING VALUATION & ROI ENGINE TEST SUITE');
  console.log('==================================================\n');

  const vitest = await startVitest('test', ['src/services/valuation/__tests__/roiEngine.test.ts'], {
    run: true,
    watch: false,
  });

  if (!vitest) {
    console.error('\n💥 Failed to start Vitest.');
    process.exit(1);
  }

  const hasFailures = vitest.state.getFiles().some(
    (f) => f.result?.state === 'fail'
  );

  await vitest.close();

  if (hasFailures) {
    console.log('\n❌ SOME TESTS FAILED.');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\n💥 TEST RUNNER CRASHED:', err);
  process.exit(1);
});
