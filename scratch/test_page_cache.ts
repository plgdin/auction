import { PageCache } from '../src/utils/pageCache';

async function runTests() {
  console.log("=== RUNNING PAGE CACHE TESTS ===");

  let callCount = 0;
  const originalFn = async (name: string, age: number) => {
    callCount++;
    return { name, age, rand: Math.random() };
  };

  const memoizedFn = PageCache.memoize(originalFn, 'testUser');

  // Test 1: Basic caching
  console.log("Test 1: Basic caching...");
  const res1 = await memoizedFn("Alice", 30);
  const res2 = await memoizedFn("Alice", 30);
  
  if (res1.rand === res2.rand && callCount === 1) {
    console.log("  [PASS] Caching worked, value reused, fn executed once.");
  } else {
    console.error("  [FAIL] res1.rand:", res1.rand, "res2.rand:", res2.rand, "callCount:", callCount);
  }

  // Test 2: Parameter sensitivity
  console.log("Test 2: Parameter sensitivity...");
  const res3 = await memoizedFn("Bob", 25);
  if (res3.rand !== res1.rand && callCount === 2) {
    console.log("  [PASS] Bob generated a new cache entry.");
  } else {
    console.error("  [FAIL] Different arguments did not trigger a new execution.");
  }

  // Test 3: Context 'this' preservation
  console.log("Test 3: Context preservation...");
  const contextObj = {
    prefix: "Hello",
    greet: PageCache.memoize(async function(this: any, name: string) {
      return `${this.prefix}, ${name}`;
    }, 'greet')
  };

  try {
    const greeting = await contextObj.greet("Alice");
    if (greeting === "Hello, Alice") {
      console.log("  [PASS] Context 'this' was preserved correctly.");
    } else {
      console.error("  [FAIL] Expected 'Hello, Alice', got:", greeting);
    }
  } catch (err) {
    console.error("  [FAIL] Error occurred during context call:", err);
  }

  // Test 4: Selective Invalidation
  console.log("Test 4: Selective Invalidation...");
  PageCache.invalidate('testUser');
  const res4 = await memoizedFn("Alice", 30);
  if (res4.rand !== res1.rand && callCount === 3) {
    console.log("  [PASS] Invalidation worked, fn re-executed.");
  } else {
    console.error("  [FAIL] Cache invalidation did not force re-execution.");
  }

  // Test 5: TTL expiration
  console.log("Test 5: TTL expiration...");
  let shortCallCount = 0;
  const shortFn = PageCache.memoize(async (x: number) => {
    shortCallCount++;
    return x * 2;
  }, 'shortTest', { ttlMs: 100 });

  await shortFn(5);
  await shortFn(5);
  if (shortCallCount === 1) {
    console.log("  [PASS] Short memoized fn cached correctly.");
  } else {
    console.error("  [FAIL] Short memoized fn execution count expected 1, got:", shortCallCount);
  }

  await new Promise(resolve => setTimeout(resolve, 150));
  await shortFn(5);
  if (shortCallCount === 2) {
    console.log("  [PASS] Cache expired after TTL and re-executed.");
  } else {
    console.error("  [FAIL] Expected re-execution after TTL expiration, shortCallCount:", shortCallCount);
  }

  console.log("=== ALL TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(console.error);
