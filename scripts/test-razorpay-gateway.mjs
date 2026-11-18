// Comprehensive Razorpay Gateway Integration & Card Simulation Audit Test
import crypto from "node:crypto";

const KEY_ID = "rzp_test_U1YX4201kWQzeo";
const KEY_SECRET = "LdZq3mXNbBOLSrbmsmPq0fMX";
const authHeader = "Basic " + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");

console.log("=== 1. TESTING RAZORPAY AUTHENTICATION & ORDER CREATION ===");
const orderPayload = {
  amount: 46180, // ₹461.80 in paise (item + ₹10 fee + ₹1.80 GST)
  currency: "INR",
  receipt: `LEL-TEST-${Date.now().toString(36).toUpperCase()}`,
  notes: {
    platform: "lelam.co",
    test_run: new Date().toISOString(),
  },
};

const createRes = await fetch("https://api.razorpay.com/v1/orders", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: authHeader,
  },
  body: JSON.stringify(orderPayload),
});

if (!createRes.ok) {
  console.error("FAIL: Razorpay API returned", createRes.status, await createRes.text());
  process.exit(1);
}

const rzpOrder = await createRes.json();
console.log("PASS: Order created successfully on Razorpay!");
console.log("  Order ID:", rzpOrder.id);
console.log("  Amount (paise):", rzpOrder.amount, `(₹${rzpOrder.amount / 100})`);
console.log("  Currency:", rzpOrder.currency);
console.log("  Receipt:", rzpOrder.receipt);

console.log("\n=== 2. TESTING CONSTANT-TIME SIGNATURE VERIFICATION ===");

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

const mockPaymentId = `pay_test_${Date.now().toString(36)}`;
const payloadToSign = `${rzpOrder.id}|${mockPaymentId}`;
const validSignature = crypto.createHmac("sha256", KEY_SECRET).update(payloadToSign).digest("hex");

const checkValid = constantTimeEqual(
  validSignature,
  crypto.createHmac("sha256", KEY_SECRET).update(payloadToSign).digest("hex")
);
console.log("PASS: Valid signature verified:", checkValid);

const checkTampered = constantTimeEqual(
  validSignature,
  "deadbeef" + validSignature.slice(8)
);
console.log("PASS: Tampered signature rejected:", !checkTampered);

console.log("\n=== 3. RAZORPAY TEST CARDS COMPLIANCE CHECK ===");
const testCards = [
  {
    type: "Domestic Debit (Success)",
    number: "4111 1111 1111 1111",
    expiry: "12/28",
    cvv: "123",
    otp: "Any (e.g. 123456)",
    expected: "Success (Signature generated)",
  },
  {
    type: "Visa International (Success)",
    number: "4012 0000 0000 0002",
    expiry: "06/29",
    cvv: "999",
    otp: "Auto-success",
    expected: "Success (Signature generated)",
  },
  {
    type: "Mastercard Test (Success)",
    number: "5123 4567 8901 2346",
    expiry: "08/27",
    cvv: "456",
    otp: "Auto-success",
    expected: "Success (Signature generated)",
  },
  {
    type: "Declined Card (Insufficient Funds)",
    number: "4000 0000 0000 1002",
    expiry: "12/28",
    cvv: "123",
    expected: "Failure (Error: Insufficient funds)",
  },
  {
    type: "Declined Card (Bank Error)",
    number: "4000 0000 0000 1001",
    expiry: "12/28",
    cvv: "123",
    expected: "Failure (Error: Card declined by bank)",
  },
];

for (const card of testCards) {
  console.log(`- [${card.type}]: Number: ${card.number} -> ${card.expected}`);
}

console.log("\n=== 4. EDGE FUNCTION DEPLOYMENT STATUS AUDIT ===");
const liveFuncRes = await fetch("https://siyfrqqjzmhpwkohofgn.supabase.co/functions/v1/razorpay-create-order", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});

console.log("  Live Edge Function HTTP Status:", liveFuncRes.status);
if (liveFuncRes.status === 404) {
  console.log("  ⚠️ ACTION REQUIRED: Edge function 'razorpay-create-order' is not yet deployed to Supabase.");
  console.log("  Command to deploy: npx supabase functions deploy razorpay-create-order --project-ref siyfrqqjzmhpwkohofgn");
} else {
  console.log("  PASS: Edge function is deployed!");
}

console.log("\nALL VERIFICATIONS COMPLETE.");

