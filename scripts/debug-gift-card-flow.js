#!/usr/bin/env node

/**
 * Debug Gift Card Flow
 * Helps identify where the gift card payment flow is failing
 */

const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('🔍 GIFT CARD FLOW DIAGNOSTIC');
console.log('========================================\n');

// 1. Check environment variables
console.log('📋 STEP 1: Checking Environment Variables');
console.log('─'.repeat(50));

const requiredEnvVars = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'DATABASE_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
];

let envMissing = [];
requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  const status = value ? '✅' : '❌';
  const displayValue = value 
    ? (value.length > 40 ? `${value.substring(0, 40)}...` : value)
    : 'NOT SET';
  console.log(`${status} ${envVar}: ${displayValue}`);
  if (!value) envMissing.push(envVar);
});

if (envMissing.length > 0) {
  console.log(`\n⚠️  Missing environment variables: ${envMissing.join(', ')}`);
}

// 2. Check Stripe webhook configuration
console.log('\n📋 STEP 2: Checking Stripe Webhook Configuration');
console.log('─'.repeat(50));
console.log(`✓ STRIPE_WEBHOOK_SECRET is set: ${!!process.env.STRIPE_WEBHOOK_SECRET}`);
console.log(`✓ STRIPE_SECRET_KEY is set: ${!!process.env.STRIPE_SECRET_KEY}`);

// 3. Check backend webhook endpoint
console.log('\n📋 STEP 3: Webhook Endpoint Information');
console.log('─'.repeat(50));
console.log('Expected webhook endpoint: POST /stripe_payment/webhook');
console.log(`Webhook secret configured: ${!!process.env.STRIPE_WEBHOOK_SECRET ? 'YES ✅' : 'NO ❌'}`);

// 4. Suggest next steps
console.log('\n📋 STEP 4: Next Steps to Verify Gift Card Payment');
console.log('─'.repeat(50));
console.log(`
1️⃣  Check Your Stripe Dashboard:
   • Go to https://dashboard.stripe.com/webhooks
   • Verify webhook endpoint is configured for: /stripe_payment/webhook
   • Check webhook event logs to see if payment.intent.succeeded events are being sent
   • Look for any failed webhook delivery attempts

2️⃣  Verify Payment is Completing:
   • Try purchasing a gift card
   • In Stripe Dashboard → Payments, look for the payment you just made
   • Confirm it shows "Succeeded"
   
3️⃣  Check Backend is Receiving Webhook:
   • Look for logs starting with "🔍 Payment success handler"
   • Should show "🎁 Gift Card Details:"
   • Then "🎁 Starting gift card creation workflow..."
   • Finally "✅ Gift card creation completed successfully"

4️⃣  If No Webhook Logs Appear:
   • Webhook URL might be wrong in Stripe dashboard
   • Try to manually trigger a test webhook from Stripe dashboard
   • Check firewall/networking - ensure webhook can reach your backend

5️⃣  Test Payment with Stripe Test Cards:
   • Use card: 4242 4242 4242 4242 (success)
   • Exp: Any future date (e.g., 12/25)
   • CVC: Any 3 digits (e.g., 123)
`);

// 5. Check database connection
console.log('📋 STEP 5: Database Configuration');
console.log('─'.repeat(50));
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const dbProtocol = dbUrl.split('://')[0];
  console.log(`✓ Database protocol: ${dbProtocol}`);
  console.log(`✓ Database configured: YES ✅`);
} else {
  console.log(`✗ DATABASE_URL not set: NO ❌`);
}

console.log('\n========================================');
console.log('✅ DIAGNOSTIC COMPLETE');
console.log('========================================\n');
console.log('If you still see no webhook logs after testing payment:');
console.log('1. Run: npm run start (to start backend)');
console.log('2. Try purchasing a gift card');
console.log('3. Share backend logs output');
console.log('4. Share Stripe webhook delivery logs from dashboard\n');
