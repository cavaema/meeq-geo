// ============================================================================
// Script di Migrazione Diretta Utenti al Server Centrale
// ============================================================================
// Versione che crea direttamente nel database centrale (richiede accesso diretto)
// Esegui sul VPS: node migrate-users-direct.js
// ============================================================================

const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const https = require('https');

// Configurazione
const CENTRAL_DB_PATH = './central.db';
const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH || '/home/meeq/meeq/chat.db'; // Path database locale (da trasferire)

console.log('🚀 Migrazione Diretta Utenti');
console.log('============================');
console.log(`📁 Database centrale: ${CENTRAL_DB_PATH}`);
console.log(`📁 Database locale: ${LOCAL_DB_PATH}`);
console.log('');

// Apri database centrale
const centralDb = new sqlite3.Database(CENTRAL_DB_PATH, (err) => {
  if (err) {
    console.error('❌ Errore apertura database centrale:', err);
    process.exit(1);
  }
});

// Apri database locale
const localDb = new sqlite3.Database(LOCAL_DB_PATH, (err) => {
  if (err) {
    console.error('❌ Errore apertura database locale:', err);
    console.error('   Assicurati di aver trasferito chat.db sul VPS o modifica LOCAL_DB_PATH');
    centralDb.close();
    process.exit(1);
  }
});

// Recupera utenti locali
localDb.all('SELECT * FROM users ORDER BY id', (err, localUsers) => {
  if (err) {
    console.error('❌ Errore lettura utenti locali:', err);
    localDb.close();
    centralDb.close();
    process.exit(1);
  }

  if (!localUsers || localUsers.length === 0) {
    console.log('ℹ️ Nessun utente trovato nel database locale');
    localDb.close();
    centralDb.close();
    return;
  }

  console.log(`📊 Trovati ${localUsers.length} utenti da migrare`);
  console.log('');

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  // Migra ogni utente
  localUsers.forEach((user, index) => {
    console.log(`[${index + 1}/${localUsers.length}] ${user.email} (${user.nome} ${user.cognome})`);

    // Verifica se esiste già nel server centrale
    centralDb.get('SELECT * FROM users WHERE email = ?', [user.email], (err, existing) => {
      if (err) {
        console.log(`   ❌ Errore verifica: ${err.message}`);
        errors++;
        return;
      }

      if (existing) {
        console.log(`   ⏭️  Già esistente nel server centrale (ID: ${existing.id})`);
        skipped++;
        return;
      }

      // Crea utente nel server centrale
      centralDb.run(
        'INSERT INTO users (email, nome, cognome, gender, newsletter, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [user.email, user.nome, user.cognome, user.gender || 'other', user.newsletter || 0, user.created_at || new Date().toISOString()],
        function(err) {
          if (err) {
            console.log(`   ❌ Errore creazione: ${err.message}`);
            errors++;
            return;
          }

          console.log(`   ✅ Creato nel server centrale (ID: ${this.lastID})`);
          migrated++;

          // Se siamo all'ultimo utente, mostra statistiche
          if (index === localUsers.length - 1) {
            console.log('');
            console.log('==============================================');
            console.log('✅ Migrazione completata!');
            console.log(`   ✅ Migrati: ${migrated}`);
            console.log(`   ⏭️  Saltati: ${skipped}`);
            console.log(`   ❌ Errori: ${errors}`);
            console.log('');
            console.log('📝 Nota: Gli utenti sono stati creati nel server centrale.');
            console.log('   Ora devono fare login una volta per sincronizzare il central_user_id');
            console.log('   nel database locale.');
            
            localDb.close();
            centralDb.close();
          }
        }
      );
    });
  });
});

