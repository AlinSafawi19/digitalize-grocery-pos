#!/usr/bin/env node

/**
 * Generate a secure random secret for APP_SECRET
 * Usage: node scripts/generate-secret.js
 */

const crypto = require('crypto');

// Generate a 64-character random hex string
const secret = crypto.randomBytes(32).toString('hex');

console.log('\n🔐 Generated APP_SECRET:');
console.log('='.repeat(64));
console.log(secret);
console.log('='.repeat(64));
console.log('\n📝 Add this to your .env file:');
console.log(`APP_SECRET=${secret}\n`);

