// ============================================================================
// Script di Migrazione Utenti al Server Centrale
// ============================================================================
// Migra tutti gli utenti esistenti dal database locale al server centrale
// Esegui: node migrate-users-to-central.js
// ============================================================================

const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const https = require('https');
const crypto = require('crypto');

// Configurazione (usa le stesse del server.js)
const CENTRAL_SERVER_URL = process.env.CENTRAL_SERVER_URL || 'http://128.140.84.82:3001';
const VENUE_API_KEY = process.env.VENUE_API_KEY || '4b0576016c331735fe476b0d65dec919e627aa503651c6517e6e6d16d72c6400';
const LOCAL_DB_PATH = './chat.db';

if (!VENUE_API_KEY) {
  console.error('❌ VENUE_API_KEY non configurata!');
  console.error('   Configura in server.js o usa: export VENUE_API_KEY="your-key"');
  process.exit(1);
}

// Funzione per chiamare il server centrale
function callCentralServer(endpoint, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const url = new URL(`${CENTRAL_SERVER_URL}${endpoint}`);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': VENUE_API_KEY
      },
      timeout: 10000
    };

    const protocol = url.protocol === 'https:' ? https : http;

    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (e) {
          resolve({ error: 'Risposta non valida', fallback: true });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`⚠️ Errore connessione: ${error.message}`);
      resolve({ error: error.message, fallback: true });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'Timeout', fallback: true });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Verifica se utente esiste nel server centrale
async function checkUserExists(email) {
  const result = await callCentralServer('/api/central/check-email', 'POST', { email });
  return result.exists === true;
}

// Crea utente nel server centrale (usa endpoint admin)
async function createUserInCentral(user, adminToken) {
  // Prima verifica se esiste
  const exists = await checkUserExists(user.email);
  if (exists) {
    return { exists: true, message: 'Utente già esistente nel server centrale' };
  }

  // Crea utente tramite endpoint admin (richiede token admin)
  if (!adminToken) {
    return { error: 'Token admin richiesto per creare utenti. Usa lo script migrate-users-direct.js invece.' };
  }

  const result = await callCentralServer('/api/central/admin/users/create', 'POST', {
    email: user.email,
    nome: user.nome,
    cognome: user.cognome,
    gender: user.gender || 'other',
    newsletter: user.newsletter || 0
  }, adminToken);

  if (result.fallback || result.error) {
    return { error: result.error || 'Errore creazione utente' };
  }

  return { success: true, message: 'Utente creato nel server centrale', userId: result.user?.id };
}

// Ottieni central_user_id dopo la creazione (richiede PIN, quindi usiamo un approccio diverso)
// In realtà, per migrare utenti esistenti, dobbiamo creare direttamente nel database centrale
// oppure usare un endpoint admin. Per ora, creiamo l'utente e poi lo verifichiamo.

// Funzione principale di migrazione
async function migrateUsers() {
  console.log('🚀 Inizio migrazione utenti al server centrale');
  console.log('==============================================');
  console.log(`📍 Server centrale: ${CENTRAL_SERVER_URL}`);
  console.log(`📁 Database locale: ${LOCAL_DB_PATH}`);
  console.log('');

  // Apri database locale
  const db = new sqlite3.Database(LOCAL_DB_PATH, (err) => {
    if (err) {
      console.error('❌ Errore apertura database locale:', err);
      process.exit(1);
    }
  });

  // Recupera tutti gli utenti locali
  db.all('SELECT * FROM users ORDER BY id', async (err, users) => {
    if (err) {
      console.error('❌ Errore lettura utenti:', err);
      db.close();
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.log('ℹ️ Nessun utente trovato nel database locale');
      db.close();
      return;
    }

    console.log(`📊 Trovati ${users.length} utenti da migrare`);
    console.log('');

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    // Migra ogni utente
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`[${i + 1}/${users.length}] Migrazione: ${user.email} (${user.nome} ${user.cognome})`);

      // Se ha già central_user_id, salta
      if (user.central_user_id) {
        console.log(`   ⏭️  Già migrato (central_user_id: ${user.central_user_id})`);
        skipped++;
        continue;
      }

      // Verifica se esiste nel server centrale
      const exists = await checkUserExists(user.email);
      
      if (exists) {
        console.log(`   ⚠️  Utente già esistente nel server centrale`);
        // Prova a recuperare l'ID (richiederebbe endpoint admin o verifica token)
        // Per ora, segna come da verificare manualmente
        skipped++;
        continue;
      }

      // Crea utente nel server centrale
      const result = await createUserInCentral(user);
      
      if (result.error) {
        console.log(`   ❌ Errore: ${result.error}`);
        errors++;
        continue;
      }

      if (result.exists) {
        console.log(`   ⚠️  ${result.message}`);
        skipped++;
        continue;
      }

      if (result.success) {
        console.log(`   ✅ ${result.message}`);
        migrated++;
        
        // Nota: Non possiamo ottenere il central_user_id senza PIN
        // L'utente dovrà fare login una volta per sincronizzare completamente
        // Per ora, segniamo che è stato creato nel server centrale
      }

      // Pausa per non sovraccaricare il server
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('');
    console.log('==============================================');
    console.log('✅ Migrazione completata!');
    console.log(`   ✅ Migrati: ${migrated}`);
    console.log(`   ⏭️  Saltati: ${skipped}`);
    console.log(`   ❌ Errori: ${errors}`);
    console.log('');
    console.log('📝 Nota: Gli utenti migrati dovranno fare login una volta');
    console.log('   per completare la sincronizzazione (ottenere central_user_id)');
    console.log('');

    db.close();
  });
}

// Esegui migrazione
migrateUsers().catch(err => {
  console.error('❌ Errore durante migrazione:', err);
  process.exit(1);
});

