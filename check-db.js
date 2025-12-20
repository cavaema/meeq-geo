#!/usr/bin/env node

// Script per verificare la struttura del database
const sqlite3 = require('sqlite3').verbose();

console.log('🔍 Verifica Struttura Database\n');

const db = new sqlite3.Database('./chat.db', (err) => {
  if (err) {
    console.error('❌ Errore apertura database:', err);
    process.exit(1);
  }
  console.log('✅ Database aperto\n');
});

// Funzione per ottenere info su una tabella
function checkTable(tableName) {
  return new Promise((resolve, reject) => {
    console.log(`\n📋 Tabella: ${tableName}`);
    console.log('─'.repeat(50));
    
    db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
      if (err) {
        console.error(`❌ Errore lettura tabella ${tableName}:`, err);
        reject(err);
        return;
      }
      
      if (columns.length === 0) {
        console.log(`⚠️  Tabella ${tableName} NON ESISTE!`);
      } else {
        console.log('Colonne:');
        columns.forEach(col => {
          const nullable = col.notnull ? '❌ NOT NULL' : '✅ NULL';
          const pk = col.pk ? '🔑 PRIMARY KEY' : '';
          const def = col.dflt_value ? `DEFAULT ${col.dflt_value}` : '';
          console.log(`  - ${col.name} (${col.type}) ${nullable} ${pk} ${def}`.trim());
        });
      }
      
      // Conta righe
      db.get(`SELECT COUNT(*) as count FROM ${tableName}`, [], (err, result) => {
        if (err) {
          console.error(`❌ Errore conteggio ${tableName}:`, err);
        } else {
          console.log(`\n📊 Righe totali: ${result.count}`);
        }
        resolve();
      });
    });
  });
}

// Verifica tutte le tabelle
async function verifyAll() {
  try {
    await checkTable('users');
    await checkTable('pending_registrations');
    await checkTable('rooms');
    await checkTable('messages');
    await checkTable('conversations');
    
    console.log('\n' + '='.repeat(50));
    console.log('🎯 VERIFICA COMPLETATA\n');
    
    // Chiudi database
    db.close();
    
  } catch (err) {
    console.error('❌ Errore durante verifica:', err);
    db.close();
    process.exit(1);
  }
}

verifyAll();
