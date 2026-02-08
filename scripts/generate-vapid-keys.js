/**
 * Generate VAPID keys for Web Push notifications
 *
 * Run this script once to generate your VAPID keys:
 * node scripts/generate-vapid-keys.js
 *
 * Then add the keys to your .env.local file:
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
 * VAPID_PRIVATE_KEY=<private key>
 * VAPID_EMAIL=mailto:your-email@example.com
 */

const webpush = require('web-push');

console.log('Generating VAPID keys...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('✅ VAPID keys generated successfully!\n');
console.log('Add these to your .env.local file:\n');
console.log('# Web Push VAPID Keys');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('VAPID_EMAIL=mailto:your-email@example.com');
console.log('\n');
console.log('Also add these to your Supabase Edge Function secrets:');
console.log(`supabase secrets set VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`supabase secrets set VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('supabase secrets set VAPID_EMAIL=mailto:your-email@example.com');
console.log('\n');
console.log('⚠️  Keep these keys secret and do not commit them to version control!');
