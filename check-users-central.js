// Script per verificare utenti nel server centrale
// Esegui sul VPS: node check-users-central.js

const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./central.db', (err) => {
  if (err) {
    console.error('❌ Errore connessione database:', err);
    process.exit(1);
  }
});

console.log('🔍 Verifica Utenti nel Server Centrale');
console.log('======================================');
console.log('');

db.all('SELECT * FROM users ORDER BY created_at DESC', (err, users) => {
  if (err) {
    console.error('❌ Errore:', err);
    db.close();
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('⚠️ Nessun utente trovato nel database centrale');
  } else {
    console.log(`📊 Trovati ${users.length} utenti:`);
    console.log('');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   Nome: ${user.nome} ${user.cognome}`);
      console.log(`   Gender: ${user.gender}`);
      console.log(`   Bloccato: ${user.blocked ? 'Sì' : 'No'}`);
      console.log(`   Creato: ${user.created_at}`);
      console.log(`   Ultimo login: ${user.last_login || 'Mai'}`);
      console.log('');
    });
  }

  db.close();
});

