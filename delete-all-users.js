// ============================================================================
// Script per Cancellare TUTTI gli Utenti dal Database Locale
// ============================================================================
// Esegui sul Raspberry Pi: node delete-all-users.js
// ============================================================================

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = './chat.db';

// Verifica che il database esista
if (!fs.existsSync(dbPath)) {
  console.error('❌ Database non trovato:', dbPath);
  process.exit(1);
}

// Crea backup
const backupPath = `./chat.db.backup-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}`;
console.log('📦 Creazione backup...');
fs.copyFileSync(dbPath, backupPath);
console.log(`✅ Backup creato: ${backupPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Errore connessione database:', err);
    process.exit(1);
  }
});

function runSQL(sql, description) {
  return new Promise((resolve, reject) => {
    db.run(sql, function(err) {
      if (err) {
        console.error(`❌ Errore ${description}:`, err.message);
        reject(err);
      } else {
        console.log(`✅ ${description} - ${this.changes} righe modificate`);
        resolve(this.changes);
      }
    });
  });
}

function countRows(table) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
      if (err) {
        // Se la tabella non esiste, restituisci 0
        if (err.message.includes('no such table')) {
          resolve(0);
        } else {
          reject(err);
        }
      } else {
        resolve(row.count);
      }
    });
  });
}

async function main() {
  console.log('🗑️  Cancellazione di TUTTI gli utenti dal database locale');
  console.log('==========================================================\n');

  try {
    // Conta utenti prima
    const usersBefore = await countRows('users');
    const pendingBefore = await countRows('pending_registrations');
    const messagesBefore = await countRows('messages');
    const conversationsBefore = await countRows('conversations');
    const blockedBefore = await countRows('blocked_users');
    const reportsBefore = await countRows('reports');
    const pushSubsBefore = await countRows('push_subscriptions');

    console.log('📊 Stato attuale:');
    console.log(`   - Utenti: ${usersBefore}`);
    console.log(`   - Pending registrations: ${pendingBefore}`);
    console.log(`   - Messaggi: ${messagesBefore}`);
    console.log(`   - Conversazioni: ${conversationsBefore}`);
    console.log(`   - Blocchi: ${blockedBefore}`);
    console.log(`   - Reports: ${reportsBefore}`);
    console.log(`   - Push subscriptions: ${pushSubsBefore}\n`);

    if (usersBefore === 0) {
      console.log('ℹ️  Nessun utente da cancellare');
      db.close();
      return;
    }

    console.log('🗑️  Cancellazione in corso...\n');

    // Cancella in ordine (rispettando foreign keys)
    await runSQL('DELETE FROM push_subscriptions', 'Cancellati push_subscriptions');
    await runSQL('DELETE FROM messages', 'Cancellati messages');
    await runSQL('DELETE FROM conversations', 'Cancellati conversations');
    await runSQL('DELETE FROM blocked_users', 'Cancellati blocked_users');
    await runSQL('DELETE FROM reports', 'Cancellati reports');
    await runSQL('DELETE FROM pending_registrations', 'Cancellati pending_registrations');
    await runSQL('DELETE FROM users', 'Cancellati users');

    // Vacuum per ottimizzare il database
    console.log('\n🔧 Ottimizzazione database (VACUUM)...');
    await new Promise((resolve, reject) => {
      db.run('VACUUM', (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Database ottimizzato');
          resolve();
        }
      });
    });

    // Verifica finale
    const usersAfter = await countRows('users');
    const pendingAfter = await countRows('pending_registrations');

    console.log('\n✅ Completato!');
    console.log(`   - Utenti rimanenti: ${usersAfter}`);
    console.log(`   - Pending registrations rimanenti: ${pendingAfter}`);

    if (usersAfter === 0) {
      console.log('\n🎉 Tutti gli utenti sono stati cancellati con successo!');
    }

  } catch (error) {
    console.error('\n❌ Errore durante la cancellazione:', error);
    console.error('⚠️  Il backup è disponibile in:', backupPath);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('⚠️  Errore chiusura database:', err);
      }
      process.exit(0);
    });
  }
}

main();

