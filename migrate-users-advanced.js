// ============================================================================
// Script di Migrazione Avanzata Utenti al Server Centrale
// ============================================================================
// Versione avanzata che crea direttamente nel database centrale
// Richiede accesso diretto al database centrale (solo per migrazione iniziale)
// ============================================================================

const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const https = require('https');

// Configurazione
const CENTRAL_SERVER_URL = process.env.CENTRAL_SERVER_URL || 'http://localhost:3001';
const VENUE_API_KEY = process.env.VENUE_API_KEY || '';
const LOCAL_DB_PATH = './chat.db';
const CENTRAL_DB_PATH = process.env.CENTRAL_DB_PATH || '/opt/meeq-central/central.db';

if (!VENUE_API_KEY) {
  console.error('❌ VENUE_API_KEY non configurata!');
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Risposta non valida', fallback: true });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ error: error.message, fallback: true });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'Timeout', fallback: true });
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Migrazione usando API (metodo consigliato)
async function migrateViaAPI() {
  console.log('🚀 Migrazione Utenti via API');
  console.log('=============================');
  console.log(`📍 Server centrale: ${CENTRAL_SERVER_URL}`);
  console.log('');

  const localDb = new sqlite3.Database(LOCAL_DB_PATH, (err) => {
    if (err) {
      console.error('❌ Errore apertura database locale:', err);
      process.exit(1);
    }
  });

  localDb.all('SELECT * FROM users ORDER BY id', async (err, users) => {
    if (err) {
      console.error('❌ Errore lettura utenti:', err);
      localDb.close();
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.log('ℹ️ Nessun utente trovato');
      localDb.close();
      return;
    }

    console.log(`📊 Trovati ${users.length} utenti`);
    console.log('');

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`[${i + 1}/${users.length}] ${user.email}`);

      if (user.central_user_id) {
        console.log(`   ⏭️  Già migrato`);
        skipped++;
        continue;
      }

      // Verifica se esiste
      const checkResult = await callCentralServer('/api/central/check-email', 'POST', { email: user.email });
      
      if (checkResult.exists) {
        console.log(`   ⚠️  Già esistente nel server centrale`);
        skipped++;
        continue;
      }

      // Crea utente
      const createResult = await callCentralServer('/api/central/register', 'POST', {
        email: user.email,
        nome: user.nome,
        cognome: user.cognome,
        gender: user.gender || 'other',
        newsletter: user.newsletter || 0
      });

      if (createResult.fallback || createResult.error) {
        console.log(`   ❌ Errore: ${createResult.error || 'Server centrale non disponibile'}`);
        errors++;
        continue;
      }

      console.log(`   ✅ Creato nel server centrale`);
      migrated++;

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('');
    console.log('✅ Migrazione completata!');
    console.log(`   ✅ Migrati: ${migrated}`);
    console.log(`   ⏭️  Saltati: ${skipped}`);
    console.log(`   ❌ Errori: ${errors}`);
    console.log('');
    console.log('📝 Nota: Gli utenti dovranno fare login per ottenere il central_user_id');
    console.log('   e completare la sincronizzazione.');

    localDb.close();
  });
}

// Esegui
migrateViaAPI().catch(err => {
  console.error('❌ Errore:', err);
  process.exit(1);
});

