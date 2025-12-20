#!/usr/bin/env node

// Script per resettare completamente il database
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

console.log('🗑️  Reset Database Meeq\n');

// 1. Chiudi tutti i processi che potrebbero usare il DB
console.log('Step 1: Verifica processi...');

// 2. Cancella il database esistente
if (fs.existsSync('./chat.db')) {
  console.log('Step 2: Rimozione database esistente...');
  fs.unlinkSync('./chat.db');
  console.log('✅ Database cancellato');
} else {
  console.log('⚠️  Database non trovato (forse già cancellato)');
}

// 3. Crea nuovo database
console.log('\nStep 3: Creazione nuovo database...');
const db = new sqlite3.Database('./chat.db', (err) => {
  if (err) {
    console.error('❌ Errore creazione database:', err);
    process.exit(1);
  }
  console.log('✅ Database creato');
});

// 4. Crea tutte le tabelle
db.serialize(() => {
  console.log('\nStep 4: Creazione tabelle...');
  
  // Tabella users
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefono TEXT,
    tavolo TEXT,
    logged_in INTEGER DEFAULT 0,
    privacy_accepted INTEGER DEFAULT 0,
    newsletter_accepted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    last_activity DATETIME
  )`, (err) => {
    if (err) console.error('❌ Errore tabella users:', err);
    else console.log('✅ Tabella users creata');
  });

  // Tabella pending_registrations
  db.run(`CREATE TABLE pending_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    telefono TEXT,
    pin TEXT NOT NULL,
    privacy_accepted INTEGER DEFAULT 0,
    newsletter_accepted INTEGER DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('❌ Errore tabella pending_registrations:', err);
    else console.log('✅ Tabella pending_registrations creata');
  });

  // Tabella rooms
  db.run(`CREATE TABLE rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1
  )`, (err) => {
    if (err) console.error('❌ Errore tabella rooms:', err);
    else console.log('✅ Tabella rooms creata');
  });

  // Tabella messages
  db.run(`CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    conversation_id INTEGER,
    message TEXT NOT NULL,
    is_anonymous INTEGER DEFAULT 1,
    sender_revealed INTEGER DEFAULT 0,
    recipient_revealed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (recipient_id) REFERENCES users(id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  )`, (err) => {
    if (err) console.error('❌ Errore tabella messages:', err);
    else console.log('✅ Tabella messages creata');
  });

  // Tabella conversations
  db.run(`CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    user1_revealed INTEGER DEFAULT 0,
    user2_revealed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(id),
    FOREIGN KEY (user2_id) REFERENCES users(id)
  )`, (err) => {
    if (err) console.error('❌ Errore tabella conversations:', err);
    else console.log('✅ Tabella conversations creata');
  });

  // Inserisci i tavoli
  console.log('\nStep 5: Inserimento tavoli...');
  const rooms = [];
  for (let i = 1; i <= 30; i++) {
    rooms.push(`('tavolo-${i}', 'Tavolo ${i}', 'Tavolo numero ${i}', 1)`);
  }
  rooms.push(`('generale', 'Chat Generale', 'Chat pubblica per tutti', 1)`);
  
  db.run(`INSERT INTO rooms (id, name, description, is_active) VALUES ${rooms.join(', ')}`, (err) => {
    if (err) {
      console.error('❌ Errore inserimento tavoli:', err);
    } else {
      console.log('✅ 31 tavoli inseriti (tavolo-1 ... tavolo-30 + generale)');
    }
    
    // Chiudi database
    db.close((err) => {
      if (err) {
        console.error('❌ Errore chiusura database:', err);
      } else {
        console.log('\n🎉 DATABASE RESETTATO CON SUCCESSO!\n');
        console.log('Ora puoi riavviare il server con: node server.js');
      }
    });
  });
});
