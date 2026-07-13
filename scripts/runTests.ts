import dotenv from 'dotenv';
// Load environment variables before any static imports execute
dotenv.config({ path: '.env.local' });
dotenv.config();

console.log('--- Initializing Environment ---');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'Loaded' : 'Missing');

async function main() {
  // Dynamically import the tests so the environment is loaded first
  const { runRoiEngineTests } = await import('../src/services/valuation/__tests__/roiEngine.test');

  console.log('==================================================');
  console.log('RUNNING VALUATION & ROI ENGINE TEST SUITE');
  console.log('==================================================\n');

  const success = await runRoiEngineTests();
  if (success) {
    console.log('\n✅ ALL TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.log('\n❌ SOME TESTS FAILED.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n💥 TEST RUNNER CRASHED:', err);
  process.exit(1);
});
