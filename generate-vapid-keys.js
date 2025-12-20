// Script per generare chiavi VAPID per notifiche push
// Esegui: node generate-vapid-keys.js

const webpush = require('web-push');

console.log('🔑 Generazione chiavi VAPID...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('✅ Chiavi generate:\n');
console.log('VAPID_PUBLIC_KEY:');
console.log(vapidKeys.publicKey);
console.log('\nVAPID_PRIVATE_KEY:');
console.log(vapidKeys.privateKey);
console.log('\n📝 Copia queste chiavi nel file server.js sostituendo quelle esistenti!');


