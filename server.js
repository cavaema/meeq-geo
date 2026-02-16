// ============================================================================
// MEEQ-GEO - Fork con landing venue (menù + Gioca MEEQ) e geolocalizzazione
// ============================================================================
// - MOD 1: Gender selection con badge colorati
// - MOD 2: Campo distinctive_sign opzionale
// - MOD 3: Messaggi visibili prima dell'accettazione
// - MOD 4: Separazione rivelazione tavolo/nome
// - MOD 5: Sistema segnalazione utenti
// - MOD 6: Backup automatico 30 giorni
// - MOD 7: Reset giornaliero 4 AM
// ============================================================================

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');
const { exec } = require('child_process');
const webpush = require('web-push');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = 'meeq-secret-key-2024-super-secure';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'meeq2024';

// 🆕 CONFIGURAZIONE SERVER CENTRALE
// Modifica questi valori con l'URL del tuo server centrale e la tua API Key
const CENTRAL_SERVER_URL = process.env.CENTRAL_SERVER_URL || 'http://128.140.84.82:3001';
const VENUE_API_KEY = process.env.VENUE_API_KEY || '4b0576016c331735fe476b0d65dec919e627aa503651c6517e6e6d16d72c6400'; // API Key del locale (da configurare)
const USE_CENTRAL_SERVER = process.env.USE_CENTRAL_SERVER !== 'false'; // Default: true

// 🆕 CONFIGURAZIONE VAPID KEYS PER NOTIFICHE PUSH
// Chiavi generate con: node generate-vapid-keys.js
const VAPID_PUBLIC_KEY = 'BFEBC0Geojr89LuTpo-bym8XOP2Pkzo7FEgAp6H6qa-QGtLSWNAJ6WTtnvbtAT2QQip_FmpBy2p1AB6Ih4tlS64';
const VAPID_PRIVATE_KEY = 'q4ACxacYopkNX91Ag8gje5Fbc1hk6SB-TxzisvGThwg';

// Configura web-push
webpush.setVapidDetails(
  'mailto:info@meeq.it',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Middleware
app.use(express.json());

// ============================================================================
// CORS (per PWA centrale)
// ============================================================================
// Esempio:
// PWA_ALLOWED_ORIGINS="https://app.meeq.it,https://staging-app.meeq.it"
const PWA_ALLOWED_ORIGINS = (process.env.PWA_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    // Requests server-to-server o same-origin (no Origin header)
    if (!origin) return cb(null, true);

    // Allowlist esplicita (consigliato)
    if (PWA_ALLOWED_ORIGINS.length > 0) {
      return PWA_ALLOWED_ORIGINS.includes(origin) ? cb(null, true) : cb(null, false);
    }

    // Default sicuro: permetti solo lo stesso origin (es. uso diretto via browser sul Raspberry)
    // Se vuoi abilitarlo per la PWA centrale, imposta PWA_ALLOWED_ORIGINS.
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
// Preflight handler globale (Express 5 + cors: evita problemi di route pattern per OPTIONS)
app.use((req, res, next) => {
  if (req.method !== 'OPTIONS') return next();
  return cors(corsOptions)(req, res, () => res.sendStatus(204));
});

// ============================================================================
// VENUE / LANDING - Multi-locale (gestione venues nel DB)
// ============================================================================
function normalizeSlug(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// API venue per ID o slug
app.get('/api/venue/:venueId', (req, res) => {
  const venueId = (req.params.venueId || '').trim();
  const bySlug = isNaN(parseInt(venueId, 10));
  const fetchVenue = (cb) => {
    if (bySlug) {
      db.all('SELECT * FROM venues WHERE active = 1', [], (err, rows) => {
        if (err) return cb(err, null);
        const exact = (rows || []).find(r => r.slug === venueId);
        if (exact) return cb(null, exact);
        const decoded = (() => { try { return decodeURIComponent(venueId); } catch (_) { return venueId; } })();
        const norm = normalizeSlug(decoded);
        if (!norm) return cb(null, null);
        const match = (rows || []).find(r => normalizeSlug(r.slug) === norm || normalizeSlug(r.name) === norm);
        return cb(null, match || null);
      });
    } else {
      db.get('SELECT * FROM venues WHERE id = ? AND active = 1', [venueId], (err, v) => cb(err, v));
    }
  };
  fetchVenue((err, v) => {
    if (err) return res.status(500).json({ error: 'Errore database' });
    if (!v) return res.status(404).json({ error: 'Locale non trovato' });
    const geo = (v.latitude != null && v.longitude != null) ? {
      latitude: parseFloat(v.latitude),
      longitude: parseFloat(v.longitude),
      radius_meters: parseInt(v.radius_meters, 10) || 80
    } : null;
    res.json({
      id: v.id,
      name: v.name,
      logo_url: v.logo_url || '',
      menu_url: v.menu_url || '',
      geo
    });
  });
});

// API lista venues (pubblica, per pagina selezione)
app.get('/api/venues', (req, res) => {
  db.all('SELECT id, name, slug FROM venues WHERE active = 1 ORDER BY name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Errore database' });
    res.json(rows || []);
  });
});

// Landing per venue specifico: /venue/:id oppure /l/:slug
app.get('/venue/:venueId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});
app.get('/l/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Root: lista locali (per chi arriva senza QR)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'venues-list.html'));
});

// App MEEQ (richiede ?venue=ID nell'URL)
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static('public'));

// ============================================================================
// PUBLIC HEALTHCHECK (utile per PWA centrale / monitor)
// ============================================================================
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'meeq-geo',
    time: new Date().toISOString()
  });
});

// ============================================================================
// CONFIGURAZIONE EMAIL
// ============================================================================
const transporter = nodemailer.createTransport({
  host: 'authsmtp.securemail.pro',
  port: 587,
  secure: false,
  auth: {
    user: 'info@meeq.it',
    pass: 'Flw25mq!'
  }
});

// Serve admin.html alla root /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ============================================================================
// DATABASE
// ============================================================================
const db = new sqlite3.Database('./chat.db', (err) => {
  if (err) {
    console.error('Errore connessione database:', err);
  } else {
    console.log('✅ Database connesso');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    // Tabella venues (multi-locale)
    db.run(`
      CREATE TABLE IF NOT EXISTS venues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        logo_url TEXT,
        menu_url TEXT,
        latitude REAL,
        longitude REAL,
        radius_meters INTEGER DEFAULT 80,
        central_api_key TEXT,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crea default venue da env se la tabella è vuota
    db.get('SELECT COUNT(*) as c FROM venues', [], (err, row) => {
      if (!err && row && row.c === 0) {
        const name = process.env.VENUE_NAME || 'Il nostro locale';
        const slug = (name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'default').slice(0, 50);
        db.run(
          `INSERT INTO venues (name, slug, logo_url, menu_url, latitude, longitude, radius_meters, central_api_key) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            slug,
            process.env.VENUE_LOGO_URL || '',
            process.env.VENUE_MENU_URL || '',
            parseFloat(process.env.VENUE_LATITUDE) || null,
            parseFloat(process.env.VENUE_LONGITUDE) || null,
            parseInt(process.env.VENUE_RADIUS_METERS, 10) || 80,
            process.env.VENUE_API_KEY || ''
          ],
          (e) => { if (!e) console.log('✅ Creato venue default da .env'); }
        );
      }
    });

    // Tabella users con gender e distinctive_sign
    // 🆕 MODIFICATO: ora contiene anche central_user_id per sincronizzazione
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venue_id INTEGER DEFAULT 1,
        central_user_id INTEGER,
        email TEXT NOT NULL,
        nome TEXT NOT NULL,
        cognome TEXT NOT NULL,
        gender TEXT DEFAULT 'other',
        distinctive_sign TEXT,
        tavolo TEXT,
        logged_in INTEGER DEFAULT 0,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        newsletter INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced_at DATETIME  -- 🆕 Data ultima sincronizzazione con server centrale
      )
    `);

    // 🆕 Aggiungi colonna central_user_id se non esiste (migration)
    db.run(`ALTER TABLE users ADD COLUMN central_user_id INTEGER`, (err) => {
      // Ignora errore se colonna già esiste
    });
    db.run(`ALTER TABLE users ADD COLUMN synced_at DATETIME`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN venue_id INTEGER DEFAULT 1`, () => {});
    // UNIQUE su (venue_id, email) invece che solo email - stesso utente può essere in venue diversi
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_venue_email ON users(venue_id, email)`, () => {});

    db.run(`
      CREATE TABLE IF NOT EXISTS pending_registrations (
        email TEXT PRIMARY KEY,
        venue_id INTEGER DEFAULT 1,
        nome TEXT NOT NULL,
        cognome TEXT NOT NULL,
        gender TEXT DEFAULT 'other',
        distinctive_sign TEXT,
        pin TEXT NOT NULL,
        newsletter INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`ALTER TABLE pending_registrations ADD COLUMN venue_id INTEGER DEFAULT 1`, () => {});

    db.run(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        venue_id INTEGER DEFAULT 1,
        name TEXT NOT NULL,
        description TEXT
      )
    `);
    db.run(`ALTER TABLE rooms ADD COLUMN venue_id INTEGER DEFAULT 1`, () => {});

    // Tabella messages
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        recipient_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id),
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (recipient_id) REFERENCES users(id)
      )
    `);

    // Tabella conversations con separazione rivelazione tavolo/nome
    db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user1_id INTEGER NOT NULL,
        user2_id INTEGER NOT NULL,
        initiator_id INTEGER,
        status TEXT DEFAULT 'pending',
        user1_revealed INTEGER DEFAULT 0,
        user2_revealed INTEGER DEFAULT 0,
        user1_table_revealed INTEGER DEFAULT 0,
        user2_table_revealed INTEGER DEFAULT 0,
        user1_name_revealed INTEGER DEFAULT 0,
        user2_name_revealed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user1_id) REFERENCES users(id),
        FOREIGN KEY (user2_id) REFERENCES users(id),
        FOREIGN KEY (initiator_id) REFERENCES users(id)
      )
    `);

    // 🆕 Aggiungi initiator_id se non esiste (migrazione)
    db.all("PRAGMA table_info(conversations)", (err, columns) => {
      if (err) {
        console.error('Errore verifica colonne:', err);
        return;
      }

      // Verifica se initiator_id esiste già
      const hasInitiatorId = columns && columns.some(col => col.name === 'initiator_id');

      if (!hasInitiatorId) {
        db.run(`ALTER TABLE conversations ADD COLUMN initiator_id INTEGER`, (alterErr) => {
          if (alterErr) {
            console.error('Errore aggiunta initiator_id:', alterErr);
          } else {
            console.log('✅ Colonna initiator_id aggiunta alla tabella conversations');
            // Popola initiator_id per le conversazioni esistenti (user1_id è sempre chi inizia)
            db.run('UPDATE conversations SET initiator_id = user1_id WHERE initiator_id IS NULL', (updateErr) => {
              if (updateErr) {
                console.error('Errore aggiornamento initiator_id esistenti:', updateErr);
              } else {
                console.log('✅ initiator_id popolato per conversazioni esistenti');
              }
            });
          }
        });
      } else {
        console.log('✅ Colonna initiator_id già presente');
        // 🆕 Popola initiator_id per le conversazioni esistenti che non ce l'hanno
        db.run('UPDATE conversations SET initiator_id = user1_id WHERE initiator_id IS NULL', (updateErr) => {
          if (updateErr) {
            console.error('Errore aggiornamento initiator_id esistenti:', updateErr);
          } else {
            console.log('✅ initiator_id verificato/aggiornato per conversazioni esistenti');
          }
        });
      }
    });

    // Tabella reports (segnalazioni)
    db.run(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER NOT NULL,
        reported_user_id INTEGER NOT NULL,
        conversation_id INTEGER,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        reviewed_at DATETIME,
        reviewed_by TEXT,
        notes TEXT,
        FOREIGN KEY (reporter_id) REFERENCES users(id),
        FOREIGN KEY (reported_user_id) REFERENCES users(id),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      )
    `);

    // 🆕 Tabella per blocchi temporanei (reset giornaliero alle 4 AM)
    db.run(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        blocked_user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reason TEXT DEFAULT 'rejected_conversation',
        UNIQUE(user_id, blocked_user_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (blocked_user_id) REFERENCES users(id)
      )
    `);

    // Crea 30 tavoli
    const createTablesStmt = db.prepare('INSERT OR IGNORE INTO rooms (id, name, description) VALUES (?, ?, ?)');
    for (let i = 1; i <= 30; i++) {
      createTablesStmt.run(`tavolo-${i}`, `Tavolo ${i}`, `Tavolo numero ${i}`);
    }
    createTablesStmt.finalize();

    console.log('✅ Tabelle database inizializzate');
  });
}

// ============================================================================
// SISTEMA BACKUP AUTOMATICO (30 GIORNI)
// ============================================================================
const BACKUP_DIR = path.join(__dirname, 'backups');

// Crea cartella backup se non esiste
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log('📁 Cartella backup creata:', BACKUP_DIR);
}

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFile = path.join(BACKUP_DIR, `chat-${timestamp}.db`);
  const backupGz = `${backupFile}.gz`;

  return new Promise((resolve, reject) => {
    // Copia database
    fs.copyFile('./chat.db', backupFile, (err) => {
      if (err) {
        console.error('❌ Errore creazione backup:', err);
        return reject(err);
      }

      // Comprimi con gzip
      exec(`gzip "${backupFile}"`, (error) => {
        if (error) {
          console.error('❌ Errore compressione backup:', error);
          return reject(error);
        }

        console.log(`✅ Backup creato: ${backupGz}`);

        // Pulizia backup vecchi (> 30 giorni)
        cleanOldBackups();
        resolve(backupGz);
      });
    });
  });
}

function cleanOldBackups() {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  fs.readdir(BACKUP_DIR, (err, files) => {
    if (err) return;

    files.forEach(file => {
      const filePath = path.join(BACKUP_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;

        if (stats.mtimeMs < thirtyDaysAgo) {
          fs.unlink(filePath, (err) => {
            if (!err) {
              console.log(`🗑️ Backup vecchio eliminato: ${file}`);
            }
          });
        }
      });
    });
  });
}

// ============================================================================
// RESET GIORNALIERO 4 AM
// ============================================================================
function resetDaily() {
  console.log('🔄 Inizio reset giornaliero...');

  // 1. Crea backup PRIMA del reset
  createBackup()
    .then(() => {
      console.log('✅ Backup pre-reset completato');

      // 2. Cancella messaggi e conversazioni
      db.run('DELETE FROM messages', (err) => {
        if (err) console.error('Errore cancellazione messaggi:', err);
        else console.log('✅ Messaggi cancellati');
      });

      db.run('DELETE FROM conversations', (err) => {
        if (err) console.error('Errore cancellazione conversazioni:', err);
        else console.log('✅ Conversazioni cancellate');
      });

      // 🆕 3. Cancella blocchi temporanei
      db.run('DELETE FROM blocked_users', (err) => {
        if (err) console.error('Errore cancellazione blocchi:', err);
        else console.log('✅ Blocchi utenti cancellati');
      });

      // 4. Logout tutti gli utenti
      db.run('UPDATE users SET logged_in = 0, tavolo = NULL', (err) => {
        if (err) console.error('Errore logout utenti:', err);
        else console.log('✅ Tutti gli utenti scollegati');
      });

      // 5. Ottimizza database
      db.run('VACUUM', (err) => {
        if (err) console.error('Errore VACUUM:', err);
        else console.log('✅ Database ottimizzato');
      });

      console.log('✅ Reset giornaliero completato');
    })
    .catch(err => {
      console.error('❌ Errore durante backup pre-reset:', err);
    });
}

// Schedula reset alle 4:00 AM ogni giorno
schedule.scheduleJob('0 4 * * *', resetDaily);
console.log('⏰ Reset giornaliero schedulato per le 4:00 AM');

// ============================================================================
// 🆕 SINCRONIZZAZIONE GIORNALIERA UTENTI CON SERVER CENTRALE
// ============================================================================
async function syncUsersWithCentral() {
  if (!USE_CENTRAL_SERVER || !VENUE_API_KEY) {
    console.log('⚠️ Sincronizzazione saltata: server centrale non configurato');
    return;
  }

  console.log('🔄 Inizio sincronizzazione utenti con server centrale...');

  // Recupera tutti gli utenti locali che hanno central_user_id
  db.all('SELECT * FROM users WHERE central_user_id IS NOT NULL', async (err, localUsers) => {
    if (err) {
      console.error('❌ Errore recupero utenti locali:', err);
      return;
    }

    console.log(`📊 Trovati ${localUsers.length} utenti da sincronizzare`);

    // Per ogni utente, verifica se esiste ancora nel server centrale
    // e aggiorna i dati se necessario
    for (const localUser of localUsers) {
      try {
        // Verifica token con server centrale (se disponibile)
        // In alternativa, potremmo avere un endpoint per recuperare dati utente
        // Per ora, aggiorniamo solo la data di sincronizzazione
        db.run(
          'UPDATE users SET synced_at = CURRENT_TIMESTAMP WHERE id = ?',
          [localUser.id]
        );
      } catch (error) {
        console.error(`❌ Errore sincronizzazione utente ${localUser.id}:`, error);
      }
    }

    console.log('✅ Sincronizzazione utenti completata');
  });
}

// Schedula sincronizzazione alle 3:00 AM ogni giorno (prima del reset)
schedule.scheduleJob('0 3 * * *', syncUsersWithCentral);
console.log('⏰ Sincronizzazione utenti schedulata per le 3:00 AM');

// ============================================================================
// MIDDLEWARE AUTENTICAZIONE
// ============================================================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token mancante' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token non valido' });
    }
    req.user = user;

    // Aggiorna last_activity automaticamente ad ogni richiesta autenticata
    if (user.userId) {
      db.run(
        'UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?',
        [user.userId],
        (err) => {
          if (err) console.error('Errore aggiornamento last_activity:', err);
        }
      );
    }

    next();
  });
}

function authenticateAdminJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token admin mancante' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded.isAdmin) {
      return res.status(403).json({ error: 'Accesso negato' });
    }
    req.admin = decoded;
    next();
  });
}

// Middleware aggiornamento last_activity
function updateActivity(req, res, next) {
  if (req.user && req.user.userId) {
    db.run(
      'UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?',
      [req.user.userId],
      (err) => {
        if (err) console.error('Errore aggiornamento last_activity:', err);
      }
    );
  }
  next();
}

// ============================================================================
// LOGOUT AUTOMATICO PER INATTIVITÀ (10 MINUTI)
// ============================================================================
function checkInactiveUsers() {
  const query = `
    UPDATE users 
    SET logged_in = 0, tavolo = NULL 
    WHERE logged_in = 1 
      AND (datetime(last_activity, '+10 minutes') < datetime('now') 
           OR last_activity < datetime('now', '-10 minutes'))
  `;

  db.run(query, [], function (err) {
    if (err) {
      console.error('❌ Errore controllo utenti inattivi:', err);
    } else if (this.changes > 0) {
      console.log(`🔌 Logout automatico: ${this.changes} utente/i disconnessi per inattività (>10 min)`);
    }
  });
}

// Controlla ogni minuto gli utenti inattivi
setInterval(checkInactiveUsers, 60 * 1000); // 60 secondi
console.log('⏰ Sistema logout automatico attivo: controllo ogni minuto (timeout 10 minuti)');

// ============================================================================
// FUNZIONI UTILITY
// ============================================================================
function generatePIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// 🆕 FUNZIONI HELPER PER SERVER CENTRALE
// ============================================================================

const https = require('https');
const http = require('http');

// Recupera API key del venue (per multi-locale)
function getVenueApiKeyAsync(venueId) {
  return new Promise((resolve) => {
    if (!venueId) return resolve(VENUE_API_KEY || '');
    db.get('SELECT central_api_key FROM venues WHERE id = ? AND active = 1', [venueId], (err, row) => {
      resolve((!err && row && row.central_api_key) ? row.central_api_key : (VENUE_API_KEY || ''));
    });
  });
}

// Funzione helper per chiamare il server centrale (apiKey opzionale: usa quella del venue)
async function callCentralServer(endpoint, method = 'GET', body = null, apiKey = null) {
  const key = apiKey || VENUE_API_KEY;
  if (!USE_CENTRAL_SERVER || !key) {
    return { error: 'Server centrale non configurato', fallback: true };
  }

  return new Promise((resolve) => {
    const url = new URL(`${CENTRAL_SERVER_URL}${endpoint}`);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key
      },
      timeout: 5000 // 5 secondi timeout
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
          resolve({ error: 'Risposta non valida dal server centrale', fallback: true });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`⚠️ Errore connessione server centrale (${endpoint}):`, error.message);
      resolve({ error: error.message, fallback: true });
    });

    req.on('timeout', () => {
      req.destroy();
      console.error(`⚠️ Timeout connessione server centrale (${endpoint})`);
      resolve({ error: 'Timeout', fallback: true });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Verifica token con server centrale
async function verifyTokenWithCentral(token) {
  const result = await callCentralServer('/api/central/verify-token', 'POST', { token });

  if (result.fallback || result.error) {
    return null; // Fallback a verifica locale
  }

  return result.valid ? result.user : null;
}

// 🆕 Heartbeat verso centrale (aggiorna mapping IP → venue)
async function sendVenueHeartbeatToCentral() {
  if (!USE_CENTRAL_SERVER || !VENUE_API_KEY) {
    console.log('⚠️ Heartbeat saltato: server centrale non configurato');
    return;
  }
  try {
    const payload = {
      apiBaseUrl: process.env.LOCAL_API_BASE_URL || null
    };
    console.log(`📡 Invio heartbeat al centrale: ${CENTRAL_SERVER_URL}/api/central/venues/heartbeat`);
    const result = await callCentralServer('/api/central/venues/heartbeat', 'POST', payload);

    if (result.fallback) {
      console.error('❌ Heartbeat fallito (fallback):', result.error || 'Errore sconosciuto');
    } else if (result.success) {
      const ip = result.last_public_ip || result.ip || 'n/a';
      const venueId = result.venue_id || result.venueId || 'n/a';
      console.log(`✅ Heartbeat venue inviato al centrale (venue_id: ${venueId}, ip: ${ip})`);
    } else {
      console.error('❌ Heartbeat fallito:', result);
    }
  } catch (e) {
    console.error('❌ Errore heartbeat:', e.message);
    // non bloccare: best-effort
  }
}

// Salva/aggiorna utente in cache locale (per venue)
function saveUserToLocalCache(centralUser, distinctiveSign = null, venueId = 1) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE venue_id = ? AND central_user_id = ?', [venueId, centralUser.id], (err, existing) => {
      if (err) {
        return reject(err);
      }

      if (existing) {
        // Aggiorna utente esistente
        db.run(
          `UPDATE users SET 
            email = ?, nome = ?, cognome = ?, gender = ?, newsletter = ?, 
            synced_at = CURRENT_TIMESTAMP
            ${distinctiveSign !== null ? ', distinctive_sign = ?' : ''}
           WHERE venue_id = ? AND central_user_id = ?`,
          distinctiveSign !== null
            ? [centralUser.email, centralUser.nome, centralUser.cognome, centralUser.gender, centralUser.newsletter, distinctiveSign, venueId, centralUser.id]
            : [centralUser.email, centralUser.nome, centralUser.cognome, centralUser.gender, centralUser.newsletter, venueId, centralUser.id],
          function (updateErr) {
            if (updateErr) {
              return reject(updateErr);
            }
            resolve(existing.id); // Ritorna ID locale
          }
        );
      } else {
        db.get('SELECT * FROM users WHERE venue_id = ? AND email = ?', [venueId, centralUser.email], (err, emailUser) => {
          if (err) {
            return reject(err);
          }

          if (emailUser) {
            // Aggiorna con central_user_id (migration da sistema vecchio)
            db.run(
              `UPDATE users SET 
                central_user_id = ?, nome = ?, cognome = ?, gender = ?, newsletter = ?,
                synced_at = CURRENT_TIMESTAMP
                ${distinctiveSign !== null ? ', distinctive_sign = ?' : ''}
               WHERE id = ?`,
              distinctiveSign !== null
                ? [centralUser.id, centralUser.nome, centralUser.cognome, centralUser.gender, centralUser.newsletter, distinctiveSign, emailUser.id]
                : [centralUser.id, centralUser.nome, centralUser.cognome, centralUser.gender, centralUser.newsletter, emailUser.id],
              function (updateErr) {
                if (updateErr) {
                  return reject(updateErr);
                }
                console.log(`✅ Utente migrato: ${emailUser.email} → central_user_id: ${centralUser.id}`);
                resolve(emailUser.id);
              }
            );
          } else {
            db.run(
              `INSERT INTO users (venue_id, central_user_id, email, nome, cognome, gender, newsletter, distinctive_sign, synced_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
              [venueId, centralUser.id, centralUser.email, centralUser.nome, centralUser.cognome, centralUser.gender, centralUser.newsletter, distinctiveSign],
              function (insertErr) {
                if (insertErr) {
                  return reject(insertErr);
                }
                resolve(this.lastID);
              }
            );
          }
        });
      }
    });
  });
}

// Avvia heartbeat periodico (mantiene aggiornato mapping IP → venue per risoluzione da PWA centrale)
setTimeout(() => {
  sendVenueHeartbeatToCentral();
  setInterval(sendVenueHeartbeatToCentral, 10 * 60 * 1000); // ogni 10 minuti
}, 15 * 1000);

async function sendPINEmail(email, pin, nome) {
  const mailOptions = {
    from: 'Meeq <info@meeq.it>',
    to: email,
    subject: 'Il tuo PIN per accedere a Meeq',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 36px;">Meeq</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Connetti. Scopri. Gioca.</p>
        </div>
        <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333;">Ciao ${nome}!</p>
          <p style="font-size: 16px; color: #333;">Il tuo PIN per accedere a Meeq è:</p>
          <div style="background: white; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: bold; color: #E91E8C; letter-spacing: 5px;">${pin}</span>
          </div>
          <p style="font-size: 14px; color: #666;">Questo PIN è valido per 24 ore.</p>
          <p style="font-size: 14px; color: #666;">Se non hai richiesto questo PIN, ignora questa email.</p>
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; border-radius: 5px;">
            <p style="font-size: 14px; color: #856404; margin: 0;">
              <strong>⚠️ IMPORTANTE:</strong> Se non vedi questa email nella tua casella principale, 
              <strong>controlla anche la cartella SPAM/POSTA INDESIDERATA</strong>.
            </p>
          </div>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
}

async function sendReportEmail(reportData) {
  const mailOptions = {
    from: 'Meeq System <info@meeq.it>',
    to: 'info@meeq.it',
    subject: `⚠️ Nuova Segnalazione Utente - ID ${reportData.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #dc3545; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">⚠️ Nuova Segnalazione</h1>
        </div>
        <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Dettagli Segnalazione</h2>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p style="margin: 5px 0;"><strong>ID Segnalazione:</strong> ${reportData.id}</p>
            <p style="margin: 5px 0;"><strong>Data:</strong> ${new Date(reportData.created_at).toLocaleString('it-IT')}</p>
            <p style="margin: 5px 0;"><strong>ID Conversazione:</strong> ${reportData.conversation_id || 'N/A'}</p>
          </div>

          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="color: #E91E8C; margin-top: 0;">Utente Segnalante</h3>
            <p style="margin: 5px 0;"><strong>ID:</strong> ${reportData.reporter_id}</p>
            <p style="margin: 5px 0;"><strong>Nome:</strong> ${reportData.reporter_name}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${reportData.reporter_email}</p>
          </div>

          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="color: #dc3545; margin-top: 0;">Utente Segnalato</h3>
            <p style="margin: 5px 0;"><strong>ID:</strong> ${reportData.reported_user_id}</p>
            <p style="margin: 5px 0;"><strong>Nome:</strong> ${reportData.reported_user_name}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${reportData.reported_user_email}</p>
            <p style="margin: 5px 0;"><strong>Tavolo:</strong> ${reportData.reported_user_table || 'N/A'}</p>
          </div>

          ${reportData.reason ? `
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="color: #333; margin-top: 0;">Motivo</h3>
            <p style="margin: 0; color: #666;">${reportData.reason}</p>
          </div>
          ` : ''}

          <div style="text-align: center; margin-top: 20px;">
            <a href="http://172.16.0.10:3000/admin" 
               style="display: inline-block; background: #E91E8C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Vai al Pannello Admin
            </a>
          </div>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
}

// ============================================================================
// API ENDPOINTS - AUTENTICAZIONE
// ============================================================================

// Check email
app.post('/api/check-email', async (req, res) => {
  const { email, venue_id } = req.body;
  const vid = venue_id || 1;

  if (!email) {
    return res.status(400).json({ error: 'Email richiesta' });
  }

  const apiKey = await getVenueApiKeyAsync(vid);
  if (USE_CENTRAL_SERVER && apiKey) {
    try {
      const result = await callCentralServer('/api/central/check-email', 'POST', { email }, apiKey);

      if (!result.fallback && !result.error) {
        // Server centrale risponde correttamente
        return res.json(result);
      }
      // Se fallback, continua con logica locale
      console.log('⚠️ Server centrale non disponibile, uso fallback locale');
    } catch (error) {
      console.error('Errore chiamata server centrale:', error);
      // Continua con fallback locale
    }
  }

  // Fallback: cerca utente esistente in cache locale (per questo venue)
  db.get('SELECT * FROM users WHERE venue_id = ? AND email = ?', [vid, email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Errore database' });
    }

    if (user) {
      // Utente esiste in cache locale - genera nuovo PIN
      const pin = generatePIN();

      db.run('DELETE FROM pending_registrations WHERE email = ?', [email]);
      db.run(
        'INSERT OR REPLACE INTO pending_registrations (email, venue_id, nome, cognome, gender, distinctive_sign, pin, newsletter, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [user.email, vid, user.nome, user.cognome, user.gender, user.distinctive_sign, pin, user.newsletter, new Date().toISOString()],
        (err) => {
          if (err) {
            console.error('Errore creazione pending registration:', err);
            return res.status(500).json({ error: 'Errore server' });
          }

          // Invia PIN via email
          sendPINEmail(email, pin, user.nome)
            .then(() => {
              console.log(`📧 PIN inviato a ${email} (fallback locale)`);
              res.json({ exists: true, requiresRegistration: false });
            })
            .catch(error => {
              console.error('Errore invio email:', error);
              res.status(500).json({ error: 'Errore invio email' });
            });
        }
      );
    } else {
      // Utente non esiste
      res.json({ exists: false, requiresRegistration: true });
    }
  });
});

// Register
app.post('/api/register', async (req, res) => {
  const { email, nome, cognome, gender, distinctive_sign, newsletter, venue_id } = req.body;
  const vid = venue_id || 1;

  if (!email || !nome || !cognome || !gender) {
    return res.status(400).json({ error: 'Dati incompleti' });
  }

  const apiKey = await getVenueApiKeyAsync(vid);
  if (USE_CENTRAL_SERVER && apiKey) {
    try {
      const result = await callCentralServer('/api/central/register', 'POST', {
        email, nome, cognome, gender, newsletter
      }, apiKey);

      if (!result.fallback && !result.error) {
        // Server centrale risponde correttamente
        return res.json(result);
      }
      // Se fallback, continua con logica locale
      console.log('⚠️ Server centrale non disponibile, uso fallback locale');
    } catch (error) {
      console.error('Errore chiamata server centrale:', error);
      // Continua con fallback locale
    }
  }

  // Fallback: verifica se email già esiste in cache locale (per questo venue)
  db.get('SELECT * FROM users WHERE venue_id = ? AND email = ?', [vid, email], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Errore database' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Email già registrata' });
    }

    // Genera PIN
    const pin = generatePIN();

    // Rimuovi vecchie pending registrations
    db.run('DELETE FROM pending_registrations WHERE email = ?', [email]);

    db.run(
      'INSERT OR REPLACE INTO pending_registrations (email, venue_id, nome, cognome, gender, distinctive_sign, pin, newsletter) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [email, vid, nome, cognome, gender, distinctive_sign || null, pin, newsletter ? 1 : 0],
      (err) => {
        if (err) {
          console.error('Errore inserimento pending registration:', err);
          return res.status(500).json({ error: 'Errore registrazione' });
        }

        // Invia PIN via email
        sendPINEmail(email, pin, nome)
          .then(() => {
            console.log(`📧 PIN registrazione inviato a ${email} (fallback locale)`);
            res.json({ success: true, message: 'PIN inviato via email' });
          })
          .catch(error => {
            console.error('Errore invio email:', error);
            res.status(500).json({ error: 'Errore invio email' });
          });
      }
    );
  });
});

// Verify PIN
app.post('/api/verify-pin', async (req, res) => {
  const { email, pin, distinctive_sign, distinctiveSign, venue_id, tavolo, latitude, longitude } = req.body;
  const vid = venue_id || 1;

  // Geo check: se il locale ha coordinate e il client invia lat/lng, verifica che l'utente sia nel raggio
  if (latitude != null && longitude != null) {
    db.get('SELECT latitude, longitude, radius_meters FROM venues WHERE id = ? AND active = 1', [vid], (err, v) => {
      if (!err && v && v.latitude != null && v.longitude != null) {
        const dist = haversineMeters(parseFloat(v.latitude), parseFloat(v.longitude), parseFloat(latitude), parseFloat(longitude));
        const radius = parseInt(v.radius_meters, 10) || 80;
        if (dist > radius) {
          return res.status(403).json({ error: 'Devi essere dentro il locale per accedere. Posizione fuori dal raggio.' });
        }
      }
      proceedVerifyPin();
    });
  } else {
    proceedVerifyPin();
  }

  async function proceedVerifyPin() {
    const normalizedDistinctiveSign =
    (typeof distinctiveSign === 'string' ? distinctiveSign.trim() : distinctiveSign) ||
    (typeof distinctive_sign === 'string' ? distinctive_sign.trim() : distinctive_sign) ||
    null;

  if (!email || !pin) {
    return res.status(400).json({ error: 'Email e PIN richiesti' });
  }

  const apiKey = await getVenueApiKeyAsync(vid);
  if (USE_CENTRAL_SERVER && apiKey) {
    try {
      const result = await callCentralServer('/api/central/verify-pin', 'POST', { email, pin }, apiKey);

      if (!result.fallback && !result.error && result.success) {
        // Server centrale ha verificato correttamente il PIN
        const centralUser = result.user;
        const centralToken = result.token;
        const refreshToken = result.refreshToken;

        try {
          const localUserId = await saveUserToLocalCache(centralUser, normalizedDistinctiveSign, vid);
          const normalizedTavolo = (tavolo && String(tavolo).trim()) ? (String(tavolo).toLowerCase().startsWith('tavolo') ? String(tavolo).trim() : 'tavolo-' + String(tavolo).trim()) : null;
          if (normalizedTavolo) {
            db.run('UPDATE users SET tavolo = ? WHERE id = ?', [normalizedTavolo, localUserId]);
          }

          // Aggiorna stato login locale
          if (normalizedDistinctiveSign !== null) {
            db.run(
              'UPDATE users SET logged_in = 1, last_activity = CURRENT_TIMESTAMP, distinctive_sign = ? WHERE id = ?',
              [normalizedDistinctiveSign, localUserId]
            );
          } else {
            db.run(
              'UPDATE users SET logged_in = 1, last_activity = CURRENT_TIMESTAMP WHERE id = ?',
              [localUserId]
            );
          }

          const localToken = jwt.sign(
            { userId: localUserId, email: centralUser.email, centralUserId: centralUser.id, venueId: vid },
            JWT_SECRET,
            { expiresIn: '48h' }
          );

          // Recupera dati utente locale completo
          db.get('SELECT * FROM users WHERE id = ?', [localUserId], (err, localUser) => {
            if (err) {
              return res.status(500).json({ error: 'Errore database' });
            }

            console.log(`✅ Login utente: ${centralUser.nome} ${centralUser.cognome} (central ID: ${centralUser.id}, local ID: ${localUserId})`);

            res.json({
              success: true,
              token: localToken,
              centralToken: centralToken,
              refreshToken: refreshToken,
              venueId: vid,
              user: {
                id: localUserId,
                centralUserId: centralUser.id,
                email: centralUser.email,
                nome: centralUser.nome,
                cognome: centralUser.cognome,
                gender: centralUser.gender,
                distinctive_sign: normalizedDistinctiveSign || localUser?.distinctive_sign || null,
                tavolo: normalizedTavolo || localUser?.tavolo || null
              }
            });
          });
        } catch (cacheError) {
          console.error('Errore salvataggio cache locale:', cacheError);
          return res.status(500).json({ error: 'Errore salvataggio cache' });
        }
      } else {
        // Fallback: continua con logica locale
        console.log('⚠️ Server centrale non disponibile o PIN non valido, uso fallback locale');
      }
    } catch (error) {
      console.error('Errore chiamata server centrale:', error);
      // Continua con fallback locale
    }
  }

  db.get(
    'SELECT * FROM pending_registrations WHERE email = ? AND pin = ?',
    [email, pin],
    (err, pending) => {
      if (err) {
        return res.status(500).json({ error: 'Errore database' });
      }

      if (!pending) {
        return res.status(400).json({ error: 'PIN non valido' });
      }

      // Verifica scadenza (24 ore)
      const createdAt = new Date(pending.created_at);
      const now = new Date();
      const diffHours = (now - createdAt) / (1000 * 60 * 60);

      if (diffHours > 24) {
        db.run('DELETE FROM pending_registrations WHERE email = ?', [email]);
        return res.status(400).json({ error: 'PIN scaduto' });
      }

      // Aggiorna distinctive_sign se fornito
      const finalDistinctiveSign = normalizedDistinctiveSign || pending.distinctive_sign;

      const pvid = pending.venue_id || vid;
      db.get('SELECT * FROM users WHERE venue_id = ? AND email = ?', [pvid, email], (err, existingUser) => {
        if (err) {
          return res.status(500).json({ error: 'Errore database' });
        }

        if (existingUser) {
          // Login utente esistente (fallback locale)
          const normTavolo = (tavolo && String(tavolo).trim()) ? (String(tavolo).toLowerCase().startsWith('tavolo') ? String(tavolo).trim() : 'tavolo-' + String(tavolo).trim()) : null;
          const updateFields = ['logged_in = 1', 'last_activity = CURRENT_TIMESTAMP'];
          const updateVals = [];
          if (finalDistinctiveSign) { updateFields.push('distinctive_sign = ?'); updateVals.push(finalDistinctiveSign); }
          if (normTavolo) { updateFields.push('tavolo = ?'); updateVals.push(normTavolo); }
          updateVals.push(existingUser.id);
          db.run(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, updateVals);

          const token = jwt.sign(
            { userId: existingUser.id, email: existingUser.email, venueId: pvid },
            JWT_SECRET,
            { expiresIn: '48h' }
          );

          // Cancella pending registration
          db.run('DELETE FROM pending_registrations WHERE email = ?', [email]);

          console.log(`✅ Login utente esistente (fallback locale): ${existingUser.nome} ${existingUser.cognome}`);

          res.json({
            success: true,
            token,
            venueId: pvid,
            user: {
              id: existingUser.id,
              email: existingUser.email,
              nome: existingUser.nome,
              cognome: existingUser.cognome,
              gender: existingUser.gender,
              distinctive_sign: finalDistinctiveSign || existingUser.distinctive_sign,
              tavolo: normTavolo || existingUser.tavolo
            }
          });
        } else {
          const normTavoloNew = (tavolo && String(tavolo).trim()) ? (String(tavolo).toLowerCase().startsWith('tavolo') ? String(tavolo).trim() : 'tavolo-' + String(tavolo).trim()) : null;
          db.run(
            'INSERT INTO users (venue_id, email, nome, cognome, gender, distinctive_sign, newsletter, tavolo, logged_in, last_activity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)',
            [pvid, pending.email, pending.nome, pending.cognome, pending.gender, finalDistinctiveSign, pending.newsletter || 0, normTavoloNew],
            function (err) {
              if (err) {
                console.error('Errore creazione utente:', err);
                return res.status(500).json({ error: 'Errore creazione account' });
              }

              const newUserId = this.lastID;

              const token = jwt.sign(
                { userId: newUserId, email: pending.email, venueId: pvid },
                JWT_SECRET,
                { expiresIn: '48h' }
              );
              db.run('DELETE FROM pending_registrations WHERE email = ?', [email]);
              console.log(`✅ Nuovo utente registrato (fallback locale): ${pending.nome} ${pending.cognome}`);
              res.json({
                success: true,
                token,
                venueId: pvid,
                user: {
                  id: newUserId,
                  email: pending.email,
                  nome: pending.nome,
                  cognome: pending.cognome,
                  gender: pending.gender,
                  distinctive_sign: finalDistinctiveSign,
                  tavolo: normTavoloNew
                }
              });
            }
          );
        }
      });
    }
  );
  }
});

// ============================================================================
// API ENDPOINTS - UTENTE
// ============================================================================

// 🆕 Login automatico con token centrale
app.post('/api/auto-login', async (req, res) => {
  const { centralToken, venue_id } = req.body;
  const vid = venue_id ? parseInt(venue_id, 10) : 1;

  console.log('🔍 [AUTO-LOGIN] Richiesta ricevuta:', {
    hasToken: !!centralToken,
    tokenLength: centralToken?.length || 0,
    headers: {
      origin: req.headers.origin,
      'user-agent': req.headers['user-agent']?.substring(0, 50)
    }
  });

  if (!centralToken) {
    console.log('❌ [AUTO-LOGIN] Token centrale mancante');
    return res.status(400).json({ error: 'Token centrale richiesto' });
  }

  // Verifica token con server centrale
  if (USE_CENTRAL_SERVER && VENUE_API_KEY) {
    try {
      console.log('🔍 [AUTO-LOGIN] Verifica token con server centrale...');
      const centralResult = await callCentralServer('/api/central/verify-token', 'POST', { token: centralToken });
      console.log('🔍 [AUTO-LOGIN] Risposta server centrale:', {
        valid: centralResult.valid,
        hasUser: !!centralResult.user,
        error: centralResult.error,
        fallback: centralResult.fallback
      });

      if (!centralResult.fallback && !centralResult.error && centralResult.valid) {
        const centralUser = centralResult.user;

        // Salva/aggiorna utente in cache locale (per il venue richiesto)
        try {
          const localUserId = await saveUserToLocalCache(centralUser, null, vid);

          // Aggiorna stato login locale
          db.run(
            'UPDATE users SET logged_in = 1, last_activity = CURRENT_TIMESTAMP WHERE id = ?',
            [localUserId]
          );

          // Genera token JWT locale
          const localToken = jwt.sign(
            { userId: localUserId, email: centralUser.email, centralUserId: centralUser.id },
            JWT_SECRET,
            { expiresIn: '48h' }
          );

          // Recupera dati utente locale completo
          db.get('SELECT * FROM users WHERE id = ?', [localUserId], (err, localUser) => {
            if (err) {
              return res.status(500).json({ error: 'Errore database' });
            }

            console.log(`✅ [AUTO-LOGIN] Login completato: ${centralUser.nome} ${centralUser.cognome} (central ID: ${centralUser.id}, local ID: ${localUserId})`);

            console.log('📤 [AUTO-LOGIN] Invio risposta:', {
              success: true,
              hasToken: !!localToken,
              userId: localUserId
            });

            res.json({
              success: true,
              token: localToken,
              user: {
                id: localUserId,
                centralUserId: centralUser.id,
                venueId: localUser?.venue_id ?? 1,
                email: centralUser.email,
                nome: centralUser.nome,
                cognome: centralUser.cognome,
                gender: centralUser.gender,
                distinctive_sign: localUser?.distinctive_sign || null,
                tavolo: localUser?.tavolo || null
              }
            });
          });
        } catch (cacheError) {
          console.error('❌ [AUTO-LOGIN] Errore salvataggio cache locale:', cacheError);
          return res.status(500).json({ error: 'Errore salvataggio cache' });
        }
      } else {
        console.log('❌ [AUTO-LOGIN] Token centrale non valido');
        return res.status(401).json({ error: 'Token centrale non valido' });
      }
    } catch (error) {
      console.error('❌ [AUTO-LOGIN] Errore verifica token centrale:', error);
      return res.status(500).json({ error: 'Errore verifica token' });
    }
  } else {
    console.log('❌ [AUTO-LOGIN] Server centrale non configurato', {
      USE_CENTRAL_SERVER,
      hasVenueApiKey: !!VENUE_API_KEY
    });
    return res.status(503).json({ error: 'Server centrale non configurato' });
  }
});

// 🆕 Refresh sessione (usa refresh token centrale per ottenere nuovo centralToken e rigenerare token locale)
app.post('/api/refresh-session', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token richiesto' });
  }

  if (!USE_CENTRAL_SERVER || !VENUE_API_KEY) {
    return res.status(503).json({ error: 'Server centrale non configurato', fallback: true });
  }

  try {
    // 1) Ottieni un nuovo access token dal server centrale
    const refreshResult = await callCentralServer('/api/central/refresh-token', 'POST', { refreshToken });

    if (refreshResult.fallback || refreshResult.error || !refreshResult.success || !refreshResult.token) {
      return res.status(401).json({ error: refreshResult.error || 'Impossibile aggiornare la sessione' });
    }

    const newCentralToken = refreshResult.token;

    // 2) Recupera dati utente dal nuovo token (richiede API key venue)
    const centralResult = await callCentralServer('/api/central/verify-token', 'POST', { token: newCentralToken });

    if (centralResult.fallback || centralResult.error || !centralResult.valid || !centralResult.user) {
      return res.status(401).json({ error: 'Token centrale non valido dopo refresh' });
    }

    const centralUser = centralResult.user;

    // 3) Salva/aggiorna utente in cache locale
    const localUserId = await saveUserToLocalCache(centralUser, null);

    db.run(
      'UPDATE users SET logged_in = 1, last_activity = CURRENT_TIMESTAMP WHERE id = ?',
      [localUserId]
    );

    // 4) Genera nuovo token locale
    const localToken = jwt.sign(
      { userId: localUserId, email: centralUser.email, centralUserId: centralUser.id },
      JWT_SECRET,
      { expiresIn: '48h' }
    );

    db.get('SELECT * FROM users WHERE id = ?', [localUserId], (err, localUser) => {
      if (err) {
        return res.status(500).json({ error: 'Errore database' });
      }

      console.log(`✅ Refresh session: ${centralUser.nome} ${centralUser.cognome} (central ID: ${centralUser.id}, local ID: ${localUserId})`);

      res.json({
        success: true,
        token: localToken,
        centralToken: newCentralToken,
        refreshToken: refreshToken, // non ruotato dal centrale (keep)
        user: {
          id: localUserId,
          centralUserId: centralUser.id,
          email: centralUser.email,
          nome: centralUser.nome,
          cognome: centralUser.cognome,
          gender: centralUser.gender,
          distinctive_sign: localUser?.distinctive_sign || null,
          tavolo: localUser?.tavolo || null
        }
      });
    });
  } catch (error) {
    console.error('Errore refresh session:', error);
    return res.status(500).json({ error: 'Errore refresh session' });
  }
});

// Verifica token
// 🆕 Verifica token e sincronizza stato utente
app.get('/api/verify-token', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  // Verifica se l'utente è ancora loggato nel database
  db.get(
    'SELECT id, email, nome, cognome, tavolo, logged_in, last_activity FROM users WHERE id = ?',
    [userId],
    (err, user) => {
      if (err) {
        console.error('Errore verifica utente:', err);
        return res.status(500).json({ error: 'Errore database' });
      }

      if (!user) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      // 🆕 Se l'utente è stato disconnesso ma rientra entro 10 minuti, ripristina sessione
      const lastActivity = new Date(user.last_activity);
      const now = new Date();
      const minutesSinceActivity = (now - lastActivity) / (1000 * 60);

      if (user.logged_in === 0 && minutesSinceActivity < 10) {
        // Ripristina sessione se rientra entro 10 minuti
        db.run(
          'UPDATE users SET logged_in = 1, last_activity = datetime("now", "localtime") WHERE id = ?',
          [userId],
          (updateErr) => {
            if (updateErr) {
              console.error('Errore ripristino sessione:', updateErr);
            } else {
              console.log(`✅ Sessione ripristinata per utente ID: ${userId}`);
            }
          }
        );
        user.logged_in = 1;
      }

      // Se l'utente non è loggato e sono passati più di 10 minuti, token non valido
      if (user.logged_in === 0 && minutesSinceActivity >= 10) {
        return res.status(401).json({ error: 'Sessione scaduta' });
      }

      // Ritorna dati utente sincronizzati
      res.json({
        valid: true,
        userId: user.id,
        user: {
          id: user.id,
          email: user.email,
          nome: user.nome,
          cognome: user.cognome,
          tavolo: user.tavolo
        }
      });
    }
  );
});

// 🆕 Heartbeat - mantiene la sessione attiva (chiamato periodicamente dal client)
app.get('/api/heartbeat', authenticateToken, (req, res) => {
  // last_activity viene già aggiornato dal middleware authenticateToken
  res.json({
    success: true,
    message: 'Sessione attiva',
    timestamp: new Date().toISOString()
  });
});

// 🆕 Aggiorna segno distintivo (usato dal prompt "solo segno distintivo" in ingresso)
app.post('/api/distinctive-sign', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { distinctiveSign, distinctive_sign } = req.body || {};

  let value =
    (typeof distinctiveSign === 'string' ? distinctiveSign.trim() : distinctiveSign) ||
    (typeof distinctive_sign === 'string' ? distinctive_sign.trim() : distinctive_sign) ||
    null;

  if (value === '') value = null;
  if (value !== null && typeof value !== 'string') {
    return res.status(400).json({ error: 'Segno distintivo non valido' });
  }

  db.run(
    'UPDATE users SET distinctive_sign = ?, last_activity = CURRENT_TIMESTAMP WHERE id = ?',
    [value, userId],
    function (err) {
      if (err) {
        console.error('Errore aggiornamento distinctive_sign:', err);
        return res.status(500).json({ error: 'Errore database' });
      }
      res.json({ success: true, distinctive_sign: value });
    }
  );
});

// Seleziona tavolo
app.post('/api/select-table', authenticateToken, (req, res) => {
  const { tavolo } = req.body;
  const userId = req.user.userId;

  if (!tavolo) {
    return res.status(400).json({ error: 'Tavolo non specificato' });
  }

  db.run(
    'UPDATE users SET tavolo = ?, last_activity = CURRENT_TIMESTAMP WHERE id = ?',
    [tavolo, userId],
    function (err) {
      if (err) {
        console.error('Errore selezione tavolo:', err);
        return res.status(500).json({ error: 'Errore database' });
      }

      console.log(`🪑 Utente ${userId} assegnato a ${tavolo}`);
      res.json({ success: true, tavolo });
    }
  );
});

// Aggiorna tavolo
app.post('/api/update-table', authenticateToken, (req, res) => {
  const { tavolo } = req.body;
  const userId = req.user.userId;

  if (!tavolo) {
    return res.status(400).json({ error: 'Tavolo non specificato' });
  }

  db.run(
    'UPDATE users SET tavolo = ?, last_activity = CURRENT_TIMESTAMP WHERE id = ?',
    [tavolo, userId],
    function (err) {
      if (err) {
        console.error('Errore aggiornamento tavolo:', err);
        return res.status(500).json({ error: 'Errore database' });
      }

      console.log(`🔄 Utente ${userId} spostato a ${tavolo}`);
      res.json({ success: true, tavolo });
    }
  );
});

// Logout
app.post('/api/logout', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  console.log(`🚪 Logout richiesto per utente ID: ${userId}`);

  db.run(
    'UPDATE users SET logged_in = 0, tavolo = NULL, last_activity = datetime("now", "-1 hour") WHERE id = ?',
    [userId],
    function (err) {
      if (err) {
        console.error('❌ Errore logout:', err);
        return res.status(500).json({ error: 'Errore server' });
      }

      if (this.changes === 0) {
        console.warn(`⚠️ Logout: nessun utente trovato con ID ${userId}`);
      } else {
        console.log(`✅ Utente disconnesso: ID ${userId} (changes: ${this.changes})`);
      }

      res.json({ message: 'Logout effettuato' });
    }
  );
});

// ============================================================================
// NOTIFICHE PUSH
// ============================================================================

// 🆕 Ottieni VAPID public key
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// 🆕 Registra subscription push
app.post('/api/push/subscribe', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { subscription } = req.body;

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'Subscription non valida' });
  }

  // Salva o aggiorna subscription nel database
  db.run(
    `INSERT OR REPLACE INTO push_subscriptions 
     (user_id, endpoint, p256dh, auth, updated_at) 
     VALUES (?, ?, ?, ?, datetime("now", "localtime"))`,
    [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth],
    function (err) {
      if (err) {
        console.error('❌ Errore salvataggio subscription:', err);
        return res.status(500).json({ error: 'Errore salvataggio subscription' });
      }

      console.log(`✅ Push subscription registrata per utente ID: ${userId}`);
      res.json({ success: true, message: 'Subscription registrata' });
    }
  );
});

// 🆕 Rimuovi subscription push
app.post('/api/push/unsubscribe', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint richiesto' });
  }

  db.run(
    'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
    [userId, endpoint],
    function (err) {
      if (err) {
        console.error('❌ Errore rimozione subscription:', err);
        return res.status(500).json({ error: 'Errore rimozione subscription' });
      }

      console.log(`✅ Push subscription rimossa per utente ID: ${userId}`);
      res.json({ success: true, message: 'Subscription rimossa' });
    }
  );
});

// 🆕 Funzione helper per inviare notifica push a un utente
function sendPushNotification(userId, title, body, data = {}) {
  // Recupera tutte le subscription dell'utente
  db.all(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
    [userId],
    (err, subscriptions) => {
      if (err) {
        console.error('❌ Errore recupero subscriptions:', err);
        return;
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log(`⚠️ Nessuna subscription trovata per utente ID: ${userId}`);
        return;
      }

      // Invia notifica a tutte le subscription dell'utente
      const promises = subscriptions.map(sub => {
        const subscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        const payload = JSON.stringify({
          title: title,
          body: body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'meeq-message',
          data: data
        });

        return webpush.sendNotification(subscription, payload)
          .then(() => {
            console.log(`✅ Notifica inviata a utente ID: ${userId}`);
          })
          .catch((error) => {
            console.error(`❌ Errore invio notifica a utente ID: ${userId}:`, error);

            // Se la subscription non è più valida, rimuovila
            if (error.statusCode === 410 || error.statusCode === 404) {
              db.run(
                'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
                [userId, sub.endpoint],
                (deleteErr) => {
                  if (deleteErr) {
                    console.error('❌ Errore rimozione subscription invalida:', deleteErr);
                  } else {
                    console.log(`✅ Subscription invalida rimossa per utente ID: ${userId}`);
                  }
                }
              );
            }
          });
      });

      Promise.allSettled(promises);
    }
  );
}

// ============================================================================
// API ENDPOINTS - TAVOLI E UTENTI
// ============================================================================

// Lista tavoli attivi (con utenti online)
app.get('/api/tables/active', authenticateToken, (req, res) => {
  const query = `
    SELECT 
      r.id as room_id,
      r.name as room_name,
      r.description,
      GROUP_CONCAT(u.id) as user_ids,
      GROUP_CONCAT(u.nome) as user_names,
      GROUP_CONCAT(u.gender) as user_genders,
      GROUP_CONCAT(u.distinctive_sign) as user_signs,
      COUNT(CASE WHEN u.id IS NOT NULL THEN 1 END) as user_count
    FROM rooms r
    LEFT JOIN users u ON u.tavolo = r.id 
      AND u.logged_in = 1 
      AND u.id != ?
      AND datetime(u.last_activity, '+30 minutes') > datetime('now')
    GROUP BY r.id, r.name, r.description
    HAVING user_count > 0
    ORDER BY user_count DESC, r.name
  `;

  db.all(query, [req.user.userId], (err, rows) => {
    if (err) {
      console.error('Errore query tavoli attivi:', err);
      return res.status(500).json({ error: 'Errore database' });
    }

    const tables = rows.map(row => {
      const ids = row.user_ids ? row.user_ids.split(',') : [];
      const names = row.user_names ? row.user_names.split(',') : [];
      const genders = row.user_genders ? row.user_genders.split(',') : [];
      const signs = row.user_signs ? row.user_signs.split(',') : [];

      return {
        id: row.room_id,
        name: row.room_name,
        description: row.description,
        userCount: row.user_count,
        users: ids.map((id, index) => ({
          id: parseInt(id),
          nome: names[index],
          gender: genders[index] || 'other',
          distinctive_sign: signs[index] || null
        }))
      };
    });

    res.json(tables);
  });
});

// 🆕 Lista utenti (per un tavolo specifico o tutti gli utenti online)
app.get('/api/users', authenticateToken, (req, res) => {
  const { tableId } = req.query;
  const currentUserId = req.user.userId;

  let query = `
    SELECT 
      u.id,
      u.nome,
      u.cognome,
      u.gender,
      u.distinctive_sign,
      u.tavolo,
      u.last_activity
    FROM users u
    WHERE u.logged_in = 1
      AND u.id != ?
      AND datetime(u.last_activity, '+30 minutes') > datetime('now')
  `;

  const params = [currentUserId];

  if (tableId) {
    query += ' AND u.tavolo = ?';
    params.push(tableId);
  }

  query += ' ORDER BY u.last_activity DESC';

  db.all(query, params, (err, users) => {
    if (err) {
      console.error('Errore query utenti:', err);
      return res.status(500).json({ error: 'Errore database' });
    }

    const formattedUsers = users.map(user => ({
      id: user.id,
      nome: user.nome,
      cognome: user.cognome,
      gender: user.gender,
      distinctive_sign: user.distinctive_sign,
      tavolo: user.tavolo,
      lastActivity: user.last_activity
    }));

    res.json(formattedUsers);
  });
});

// 🆕 Lista utenti di un tavolo specifico (formato alternativo per compatibilità frontend)
app.get('/api/table/:tableId/users', authenticateToken, (req, res) => {
  const { tableId } = req.params;
  const currentUserId = req.user.userId;

  const query = `
    SELECT 
      u.id,
      u.nome,
      u.cognome,
      u.gender,
      u.distinctive_sign,
      u.tavolo,
      u.last_activity
    FROM users u
    WHERE u.logged_in = 1
      AND u.id != ?
      AND u.tavolo = ?
      AND datetime(u.last_activity, '+30 minutes') > datetime('now')
    ORDER BY u.last_activity DESC
  `;

  db.all(query, [currentUserId, tableId], (err, users) => {
    if (err) {
      console.error('Errore query utenti tavolo:', err);
      return res.status(500).json({ error: 'Errore database' });
    }

    const formattedUsers = users.map(user => ({
      id: user.id,
      nome: user.nome,
      cognome: user.cognome,
      gender: user.gender,
      distinctive_sign: user.distinctive_sign,
      tavolo: user.tavolo,
      lastActivity: user.last_activity
    }));

    res.json(formattedUsers);
  });
});

// ============================================================================
// API ENDPOINTS - CONVERSAZIONI
// ============================================================================

// Lista conversazioni dell'utente
app.get('/api/conversations', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  const query = `
    SELECT 
      c.id,
      c.status,
      c.user1_id,
      c.user2_id,
      c.initiator_id,
      c.user1_revealed,
      c.user2_revealed,
      c.user1_table_revealed,
      c.user2_table_revealed,
      c.user1_name_revealed,
      c.user2_name_revealed,
      c.created_at,
      c.updated_at,
      u1.nome as user1_nome,
      u1.cognome as user1_cognome,
      u1.gender as user1_gender,
      u1.distinctive_sign as user1_sign,
      u1.tavolo as user1_tavolo,
      u2.nome as user2_nome,
      u2.cognome as user2_cognome,
      u2.gender as user2_gender,
      u2.distinctive_sign as user2_sign,
      u2.tavolo as user2_tavolo,
      (SELECT COUNT(*) FROM messages m 
       WHERE m.conversation_id = c.id 
       AND m.recipient_id = ?
       AND m.is_read = 0) as unread_count,
      (SELECT COUNT(*) FROM messages m 
       WHERE m.conversation_id = c.id) as message_count
    FROM conversations c
    LEFT JOIN users u1 ON c.user1_id = u1.id
    LEFT JOIN users u2 ON c.user2_id = u2.id
    WHERE c.user1_id = ? OR c.user2_id = ?
    ORDER BY c.updated_at DESC
  `;

  db.all(query, [userId, userId, userId], (err, conversations) => {
    if (err) {
      console.error('Errore recupero conversazioni:', err);
      return res.status(500).json({ error: 'Errore database' });
    }

    // ✅ Ritorna sempre un array, anche se vuoto
    if (!conversations || conversations.length === 0) {
      return res.json([]);
    }

    const formattedConversations = conversations.map(conv => {
      const isUser1 = conv.user1_id === userId;
      const otherUser = isUser1 ? {
        id: conv.user2_id,
        nome: conv.user2_nome,
        cognome: conv.user2_cognome,
        gender: conv.user2_gender,
        distinctive_sign: conv.user2_sign,
        tavolo: conv.user2_tavolo
      } : {
        id: conv.user1_id,
        nome: conv.user1_nome,
        cognome: conv.user1_cognome,
        gender: conv.user1_gender,
        distinctive_sign: conv.user1_sign,
        tavolo: conv.user1_tavolo
      };

      const myRevealed = isUser1 ? {
        name: conv.user1_name_revealed === 1,
        table: conv.user1_table_revealed === 1
      } : {
        name: conv.user2_name_revealed === 1,
        table: conv.user2_table_revealed === 1
      };

      const theirRevealed = isUser1 ? {
        name: conv.user2_name_revealed === 1,
        table: conv.user2_table_revealed === 1
      } : {
        name: conv.user1_name_revealed === 1,
        table: conv.user1_table_revealed === 1
      };

      return {
        id: conv.id,
        status: conv.status,
        user1_id: conv.user1_id,
        user2_id: conv.user2_id,
        initiator_id: conv.initiator_id,
        user1_name_revealed: conv.user1_name_revealed === 1,
        user2_name_revealed: conv.user2_name_revealed === 1,
        user1_table_revealed: conv.user1_table_revealed === 1,
        user2_table_revealed: conv.user2_table_revealed === 1,
        otherUser: otherUser,
        myRevealed: myRevealed,
        theirRevealed: theirRevealed,
        unreadCount: conv.unread_count || 0,
        messageCount: conv.message_count || 0,
        created_at: conv.created_at,
        updated_at: conv.updated_at
      };
    });

    res.json(formattedConversations);
  });
});

// 🆕 Dettagli conversazione singola
app.get('/api/conversations/:conversationId', authenticateToken, (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.userId;

  const query = `
    SELECT 
      c.id,
      c.status,
      c.user1_id,
      c.user2_id,
      c.initiator_id,
      c.user1_revealed,
      c.user2_revealed,
      c.user1_table_revealed,
      c.user2_table_revealed,
      c.user1_name_revealed,
      c.user2_name_revealed,
      c.created_at,
      c.updated_at,
      u1.nome as user1_nome,
      u1.cognome as user1_cognome,
      u1.gender as user1_gender,
      u1.distinctive_sign as user1_sign,
      u1.tavolo as user1_tavolo,
      u2.nome as user2_nome,
      u2.cognome as user2_cognome,
      u2.gender as user2_gender,
      u2.distinctive_sign as user2_sign,
      u2.tavolo as user2_tavolo
    FROM conversations c
    LEFT JOIN users u1 ON c.user1_id = u1.id
    LEFT JOIN users u2 ON c.user2_id = u2.id
    WHERE c.id = ? AND (c.user1_id = ? OR c.user2_id = ?)
  `;

  db.get(query, [conversationId, userId, userId], (err, conv) => {
    if (err) {
      console.error('Errore recupero conversazione:', err);
      return res.status(500).json({ error: 'Errore database' });
    }

    if (!conv) {
      return res.status(404).json({ error: 'Conversazione non trovata' });
    }

    const isUser1 = conv.user1_id === userId;
    const otherUser = isUser1 ? {
      id: conv.user2_id,
      nome: conv.user2_nome,
      cognome: conv.user2_cognome,
      gender: conv.user2_gender,
      distinctive_sign: conv.user2_sign,
      tavolo: conv.user2_tavolo
    } : {
      id: conv.user1_id,
      nome: conv.user1_nome,
      cognome: conv.user1_cognome,
      gender: conv.user1_gender,
      distinctive_sign: conv.user1_sign,
      tavolo: conv.user1_tavolo
    };

    const myRevealed = isUser1 ? {
      name: conv.user1_name_revealed === 1,
      table: conv.user1_table_revealed === 1
    } : {
      name: conv.user2_name_revealed === 1,
      table: conv.user2_table_revealed === 1
    };

    const theirRevealed = isUser1 ? {
      name: conv.user2_name_revealed === 1,
      table: conv.user2_table_revealed === 1
    } : {
      name: conv.user1_name_revealed === 1,
      table: conv.user1_table_revealed === 1
    };

    res.json({
      conversation: {
        id: conv.id,
        status: conv.status,
        user1_id: conv.user1_id,
        user2_id: conv.user2_id,
        user1_name: conv.user1_nome,
        user1_table: conv.user1_tavolo,
        user1_gender: conv.user1_gender,
        user1_distinctive_sign: conv.user1_sign,
        user1_name_revealed: conv.user1_name_revealed === 1,
        user1_table_revealed: conv.user1_table_revealed === 1,
        user2_name: conv.user2_nome,
        user2_table: conv.user2_tavolo,
        user2_gender: conv.user2_gender,
        user2_distinctive_sign: conv.user2_sign,
        user2_name_revealed: conv.user2_name_revealed === 1,
        user2_table_revealed: conv.user2_table_revealed === 1,
        otherUser: otherUser,
        myRevealed: myRevealed,
        theirRevealed: theirRevealed,
        created_at: conv.created_at,
        updated_at: conv.updated_at
      }
    });
  });
});

// Crea nuova conversazione
app.post('/api/conversations', authenticateToken, (req, res) => {
  const { recipientId } = req.body;
  const userId = req.user.userId;

  if (!recipientId) {
    return res.status(400).json({ error: 'ID destinatario richiesto' });
  }

  if (recipientId === userId) {
    return res.status(400).json({ error: 'Non puoi chattare con te stesso' });
  }

  // 🆕 CONTROLLA SE C'È UN BLOCCO ATTIVO
  db.get(
    `SELECT * FROM blocked_users 
     WHERE (user_id = ? AND blocked_user_id = ?) 
        OR (user_id = ? AND blocked_user_id = ?)`,
    [userId, recipientId, recipientId, userId],
    (err, block) => {
      if (err) {
        console.error('Errore controllo blocco:', err);
        return res.status(500).json({ error: 'Errore database' });
      }

      if (block) {
        console.log(`🚫 Tentativo conversazione bloccato: User ${userId} con User ${recipientId}`);
        return res.status(403).json({
          error: 'Impossibile avviare conversazione',
          message: 'Questo utente ha rifiutato la tua richiesta di conversazione. Potrai riprovare dopo il reset giornaliero.'
        });
      }

      // Verifica se esiste già una conversazione
      db.get(
        `SELECT * FROM conversations 
         WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)`,
        [userId, recipientId, recipientId, userId],
        (err, existingConv) => {
          if (err) {
            console.error('Errore verifica conversazione:', err);
            return res.status(500).json({ error: 'Errore database' });
          }

          if (existingConv) {
            // Conversazione esiste già
            return res.json({
              success: true,
              conversationId: existingConv.id,
              status: existingConv.status,
              message: 'Conversazione già esistente'
            });
          }

          // Crea nuova conversazione
          // 🆕 user1_id è sempre chi inizia, quindi initiator_id = userId
          db.run(
            'INSERT INTO conversations (user1_id, user2_id, initiator_id, status) VALUES (?, ?, ?, ?)',
            [userId, recipientId, userId, 'pending'],
            function (err) {
              if (err) {
                console.error('Errore creazione conversazione:', err);
                return res.status(500).json({ error: 'Errore creazione conversazione' });
              }

              const newConvId = this.lastID;
              console.log(`💬 Nuova conversazione creata: ${newConvId} (${userId} → ${recipientId}, initiator_id: ${userId})`);

              res.json({
                success: true,
                conversationId: newConvId,
                status: 'pending'
              });
            }
          );
        }
      );
    }
  );
});

// Messaggi di una conversazione
app.get('/api/conversations/:conversationId/messages', authenticateToken, (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.userId;

  // Verifica che l'utente faccia parte della conversazione
  db.get(
    'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
    [conversationId, userId, userId],
    (err, conversation) => {
      if (err) {
        return res.status(500).json({ error: 'Errore database' });
      }

      if (!conversation) {
        return res.status(404).json({ error: 'Conversazione non trovata' });
      }

      // Recupera messaggi
      const query = `
        SELECT 
          m.id,
          m.message,
          m.sender_id,
          m.recipient_id,
          m.is_read,
          m.created_at
        FROM messages m
        WHERE m.conversation_id = ?
        ORDER BY m.created_at ASC
      `;

      db.all(query, [conversationId], (err, messages) => {
        if (err) {
          console.error('Errore recupero messaggi:', err);
          return res.status(500).json({ error: 'Errore database' });
        }

        // 🆕 FIX BADGE: Marca come letti quando APRI la conversazione (non quando invii)
        db.run(
          'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0',
          [conversationId, userId],
          (err) => {
            if (err) console.error('Errore mark-read:', err);
          }
        );

        const formattedMessages = messages.map(msg => ({
          id: msg.id,
          message: msg.message,
          senderId: msg.sender_id,
          recipientId: msg.recipient_id,
          isMine: msg.sender_id === userId,
          isRead: msg.is_read === 1,
          createdAt: msg.created_at
        }));

        res.json({ messages: formattedMessages });
      });
    }
  );
});

// Invia messaggio
app.post('/api/conversations/:conversationId/messages', authenticateToken, (req, res) => {
  const { conversationId } = req.params;
  const { message } = req.body;
  const userId = req.user.userId;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Messaggio vuoto' });
  }

  // Verifica conversazione
  db.get(
    'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
    [conversationId, userId, userId],
    (err, conversation) => {
      if (err) {
        return res.status(500).json({ error: 'Errore database' });
      }

      if (!conversation) {
        return res.status(404).json({ error: 'Conversazione non trovata' });
      }

      // Determina destinatario
      const recipientId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;

      // Inserisci messaggio
      db.run(
        'INSERT INTO messages (conversation_id, sender_id, recipient_id, message, is_read, created_at) VALUES (?, ?, ?, ?, 0, datetime("now", "localtime"))',
        [conversationId, userId, recipientId, message.trim()],
        function (err) {
          if (err) {
            console.error('Errore invio messaggio:', err);
            return res.status(500).json({ error: 'Errore invio messaggio' });
          }

          // Aggiorna timestamp conversazione
          db.run(
            'UPDATE conversations SET updated_at = datetime("now", "localtime") WHERE id = ?',
            [conversationId]
          );

          console.log(`📨 Messaggio inviato: Conv ${conversationId}, User ${userId} → ${recipientId}`);

          // 🆕 Invia notifica push al destinatario
          db.get('SELECT nome FROM users WHERE id = ?', [userId], (err, sender) => {
            if (!err && sender) {
              const senderName = sender.nome || 'Qualcuno';
              sendPushNotification(
                recipientId,
                'Nuovo messaggio',
                `${senderName}: ${message.trim().substring(0, 50)}${message.trim().length > 50 ? '...' : ''}`,
                {
                  conversationId: conversationId,
                  senderId: userId,
                  type: 'new_message'
                }
              );
            }
          });

          res.json({
            success: true,
            messageId: this.lastID,
            message: 'Messaggio inviato'
          });
        }
      );
    }
  );
});

// Accetta conversazione
app.post('/api/conversations/:conversationId/accept', authenticateToken, (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.userId;

  db.get(
    'SELECT * FROM conversations WHERE id = ? AND user2_id = ?',
    [conversationId, userId],
    (err, conversation) => {
      if (err) {
        return res.status(500).json({ error: 'Errore database' });
      }

      if (!conversation) {
        return res.status(404).json({ error: 'Conversazione non trovata o non autorizzato' });
      }

      if (conversation.status !== 'pending') {
        return res.status(400).json({ error: 'Conversazione già gestita' });
      }

      db.run(
        'UPDATE conversations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['accepted', conversationId],
        (err) => {
          if (err) {
            console.error('Errore accettazione conversazione:', err);
            return res.status(500).json({ error: 'Errore database' });
          }

          console.log(`✅ Conversazione ${conversationId} accettata da user ${userId}`);

          // 🆕 PROBLEMA 2: Ritorna conversazione completa aggiornata
          const query = `
            SELECT 
              c.id,
              c.status,
              c.user1_id,
              c.user2_id,
      c.initiator_id,
              c.user1_revealed,
              c.user2_revealed,
              c.user1_table_revealed,
              c.user2_table_revealed,
              c.user1_name_revealed,
              c.user2_name_revealed,
              c.created_at,
              c.updated_at,
              u1.nome as user1_nome,
              u1.cognome as user1_cognome,
              u1.gender as user1_gender,
              u1.distinctive_sign as user1_sign,
              u1.tavolo as user1_tavolo,
              u2.nome as user2_nome,
              u2.cognome as user2_cognome,
              u2.gender as user2_gender,
              u2.distinctive_sign as user2_sign,
              u2.tavolo as user2_tavolo
            FROM conversations c
            LEFT JOIN users u1 ON c.user1_id = u1.id
            LEFT JOIN users u2 ON c.user2_id = u2.id
            WHERE c.id = ?
          `;

          db.get(query, [conversationId], (err, conv) => {
            if (err) {
              console.error('Errore recupero conversazione dopo accept:', err);
              return res.status(500).json({ error: 'Errore database' });
            }

            const isUser1 = conv.user1_id === userId;
            const otherUser = isUser1 ? {
              id: conv.user2_id,
              nome: conv.user2_nome,
              cognome: conv.user2_cognome,
              gender: conv.user2_gender,
              distinctive_sign: conv.user2_sign,
              tavolo: conv.user2_tavolo
            } : {
              id: conv.user1_id,
              nome: conv.user1_nome,
              cognome: conv.user1_cognome,
              gender: conv.user1_gender,
              distinctive_sign: conv.user1_sign,
              tavolo: conv.user1_tavolo
            };

            const myRevealed = isUser1 ? {
              name: conv.user1_name_revealed === 1,
              table: conv.user1_table_revealed === 1
            } : {
              name: conv.user2_name_revealed === 1,
              table: conv.user2_table_revealed === 1
            };

            const theirRevealed = isUser1 ? {
              name: conv.user2_name_revealed === 1,
              table: conv.user2_table_revealed === 1
            } : {
              name: conv.user1_name_revealed === 1,
              table: conv.user1_table_revealed === 1
            };

            res.json({
              success: true,
              conversation: {
                id: conv.id,
                status: conv.status,
                user1_id: conv.user1_id,
                user2_id: conv.user2_id,
                user1_name: conv.user1_nome,
                user1_table: conv.user1_tavolo,
                user1_gender: conv.user1_gender,
                user1_distinctive_sign: conv.user1_sign,
                user1_name_revealed: conv.user1_name_revealed === 1,
                user1_table_revealed: conv.user1_table_revealed === 1,
                user2_name: conv.user2_nome,
                user2_table: conv.user2_tavolo,
                user2_gender: conv.user2_gender,
                user2_distinctive_sign: conv.user2_sign,
                user2_name_revealed: conv.user2_name_revealed === 1,
                user2_table_revealed: conv.user2_table_revealed === 1,
                otherUser: otherUser,
                myRevealed: myRevealed,
                theirRevealed: theirRevealed,
                created_at: conv.created_at,
                updated_at: conv.updated_at
              }
            });
          });
        }
      );
    }
  );
});

// Rifiuta conversazione
app.post('/api/conversations/:conversationId/reject', authenticateToken, (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.userId;

  db.get(
    'SELECT * FROM conversations WHERE id = ? AND user2_id = ?',
    [conversationId, userId],
    (err, conversation) => {
      if (err) {
        return res.status(500).json({ error: 'Errore database' });
      }

      if (!conversation) {
        return res.status(404).json({ error: 'Conversazione non trovata o non autorizzato' });
      }

      if (conversation.status !== 'pending') {
        return res.status(400).json({ error: 'Conversazione già gestita' });
      }

      const initiatorId = conversation.user1_id; // Il mittente che ha iniziato la conversazione

      // 🆕 CREA BLOCCO BIDIREZIONALE
      // L'utente che rifiuta (userId) blocca il mittente (initiatorId)
      // E il mittente viene bloccato dal destinatario
      db.run(
        'INSERT OR IGNORE INTO blocked_users (user_id, blocked_user_id, reason) VALUES (?, ?, ?)',
        [userId, initiatorId, 'rejected_conversation'],
        (blockErr) => {
          if (blockErr) {
            console.error('Errore creazione blocco:', blockErr);
          } else {
            console.log(`🚫 Blocco creato: User ${userId} ha bloccato User ${initiatorId}`);
          }

          // Blocco anche in direzione opposta per evitare nuove richieste
          db.run(
            'INSERT OR IGNORE INTO blocked_users (user_id, blocked_user_id, reason) VALUES (?, ?, ?)',
            [initiatorId, userId, 'conversation_rejected_by_other'],
            (blockErr2) => {
              if (blockErr2) {
                console.error('Errore creazione blocco reciproco:', blockErr2);
              } else {
                console.log(`🚫 Blocco reciproco creato: User ${initiatorId} bloccato da User ${userId}`);
              }

              // Elimina messaggi e conversazione
              db.run('DELETE FROM messages WHERE conversation_id = ?', [conversationId], (delMsgErr) => {
                if (delMsgErr) {
                  console.error('Errore eliminazione messaggi:', delMsgErr);
                }

                db.run('DELETE FROM conversations WHERE id = ?', [conversationId], (delConvErr) => {
                  if (delConvErr) {
                    console.error('Errore rifiuto conversazione:', delConvErr);
                    return res.status(500).json({ error: 'Errore database' });
                  }

                  console.log(`❌ Conversazione ${conversationId} rifiutata da user ${userId}`);

                  // 🆕 NOTIFICA AL MITTENTE
                  // Il frontend mostrerà un messaggio quando il mittente proverà a caricare le conversazioni
                  res.json({
                    success: true,
                    status: 'rejected',
                    message: 'Conversazione rifiutata. L\'utente è stato bloccato fino al reset giornaliero.',
                    initiatorId: initiatorId // Per permettere al frontend di notificare se necessario
                  });
                });
              });
            }
          );
        }
      );
    }
  );
});

// Rivela nome e tavolo (vecchio endpoint, manteniamo per compatibilità)
app.post('/api/conversations/:conversationId/reveal', authenticateToken, (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.userId;

  db.get(
    'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
    [conversationId, userId, userId],
    (err, conversation) => {
      if (err) {
        return res.status(500).json({ error: 'Errore database' });
      }

      if (!conversation) {
        return res.status(404).json({ error: 'Conversazione non trovata' });
      }

      const isUser1 = conversation.user1_id === userId;
      const nameField = isUser1 ? 'user1_name_revealed' : 'user2_name_revealed';
      const tableField = isUser1 ? 'user1_table_revealed' : 'user2_table_revealed';
      const oldRevealField = isUser1 ? 'user1_revealed' : 'user2_revealed';

      db.run(
        `UPDATE conversations 
         SET ${nameField} = 1, ${tableField} = 1, ${oldRevealField} = 1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [conversationId],
        (err) => {
          if (err) {
            console.error('Errore rivelazione:', err);
            return res.status(500).json({ error: 'Errore database' });
          }

          console.log(`👤 User ${userId} ha rivelato nome e tavolo in conv ${conversationId}`);
          res.json({ success: true, revealed: true });
        }
      );
    }
  );
});

// 🆕 Rivela SOLO il nome
app.post('/api/conversations/:conversationId/reveal-name', authenticateToken, (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.userId;

  console.log(`👤 Richiesta rivelazione NOME - Conversazione: ${conversationId}, User: ${userId}`);

  db.get(
    'SELECT id, user1_id, user2_id, user1_name_revealed, user2_name_revealed FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
    [conversationId, userId, userId],
    (err, conversation) => {
      if (err) {
        console.error('Errore verifica conversazione:', err);
        return res.status(500).json({ error: 'Errore database' });
      }

      if (!conversation) {
        console.log('❌ Conversazione non trovata o utente non autorizzato');
        return res.status(404).json({ error: 'Conversazione non trovata' });
      }

      const isUser1 = conversation.user1_id === userId;
      const nameRevealedField = isUser1 ? 'user1_name_revealed' : 'user2_name_revealed';
      const alreadyRevealed = isUser1 ? conversation.user1_name_revealed : conversation.user2_name_revealed;

      if (alreadyRevealed === 1) {
        console.log('ℹ️ Nome già rivelato in precedenza');
        return res.json({
          success: true,
          message: 'Nome già rivelato',
          alreadyRevealed: true
        });
      }

      db.run(
        `UPDATE conversations SET ${nameRevealedField} = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [conversationId],
        function (err) {
          if (err) {
            console.error('Errore aggiornamento rivelazione nome:', err);
            return res.status(500).json({ error: 'Errore nell\'aggiornare la rivelazione' });
          }

          if (this.changes === 0) {
            console.log('⚠️ Nessuna modifica effettuata');
            return res.status(500).json({ error: 'Impossibile aggiornare la rivelazione' });
          }

          console.log(`✅ Nome rivelato con successo - User ${userId} in conversazione ${conversationId}`);

          res.json({
            success: true,
            message: 'Nome rivelato con successo',
            revealed: true
          });
        }
      );
    }
  );
});

// Rivela SOLO il tavolo
app.post('/api/conversations/:conversationId/reveal-table', authenticateToken, (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.userId;

  console.log(`🪑 Richiesta rivelazione TAVOLO - Conversazione: ${conversationId}, User: ${userId}`);

  db.get(
    'SELECT id, user1_id, user2_id, user1_table_revealed, user2_table_revealed FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
    [conversationId, userId, userId],
    (err, conversation) => {
      if (err) {
        console.error('Errore verifica conversazione:', err);
        return res.status(500).json({ error: 'Errore database' });
      }

      if (!conversation) {
        console.log('❌ Conversazione non trovata o utente non autorizzato');
        return res.status(404).json({ error: 'Conversazione non trovata' });
      }

      const isUser1 = conversation.user1_id === userId;
      const tableRevealedField = isUser1 ? 'user1_table_revealed' : 'user2_table_revealed';
      const alreadyRevealed = isUser1 ? conversation.user1_table_revealed : conversation.user2_table_revealed;

      if (alreadyRevealed === 1) {
        console.log('ℹ️ Tavolo già rivelato in precedenza');
        return res.json({
          success: true,
          message: 'Tavolo già rivelato',
          alreadyRevealed: true
        });
      }

      db.run(
        `UPDATE conversations SET ${tableRevealedField} = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [conversationId],
        function (err) {
          if (err) {
            console.error('Errore aggiornamento rivelazione tavolo:', err);
            return res.status(500).json({ error: 'Errore nell\'aggiornare la rivelazione' });
          }

          if (this.changes === 0) {
            console.log('⚠️ Nessuna modifica effettuata');
            return res.status(500).json({ error: 'Impossibile aggiornare la rivelazione' });
          }

          console.log(`✅ Tavolo rivelato con successo - User ${userId} in conversazione ${conversationId}`);

          res.json({
            success: true,
            message: 'Tavolo rivelato con successo',
            revealed: true
          });
        }
      );
    }
  );
});

// Segnala utente
app.post('/api/conversations/:conversationId/report', authenticateToken, (req, res) => {
  const { conversationId } = req.params;
  const { reason } = req.body;
  const reporterId = req.user.userId;

  console.log(`⚠️ Segnalazione ricevuta - Conv: ${conversationId}, Reporter: ${reporterId}`);

  // Verifica conversazione
  db.get(
    'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
    [conversationId, reporterId, reporterId],
    (err, conversation) => {
      if (err) {
        console.error('Errore verifica conversazione:', err);
        return res.status(500).json({ error: 'Errore database' });
      }

      if (!conversation) {
        return res.status(404).json({ error: 'Conversazione non trovata' });
      }

      // Determina l'utente segnalato
      const reportedUserId = conversation.user1_id === reporterId ? conversation.user2_id : conversation.user1_id;

      // 🆕 Invia segnalazione al server centrale
      if (USE_CENTRAL_SERVER && VENUE_API_KEY) {
        // Recupera central_user_id per reporter e reported
        db.get('SELECT central_user_id FROM users WHERE id = ?', [reporterId], async (err, reporter) => {
          if (err) {
            console.error('Errore recupero reporter:', err);
          } else {
            db.get('SELECT central_user_id FROM users WHERE id = ?', [reportedUserId], async (err, reported) => {
              if (err) {
                console.error('Errore recupero reported:', err);
              } else {
                // Invia al server centrale
                const centralResult = await callCentralServer('/api/central/reports', 'POST', {
                  reporter_user_id: reporter?.central_user_id || reporterId,
                  reported_user_id: reported?.central_user_id || reportedUserId,
                  reason: reason || 'Nessun motivo specificato',
                  description: `Conversazione ID: ${conversationId}`
                });

                if (!centralResult.fallback && !centralResult.error) {
                  console.log(`✅ Segnalazione inviata al server centrale (ID: ${centralResult.reportId})`);
                }
              }
            });
          }
        });
      }

      // Inserisci segnalazione locale
      db.run(
        'INSERT INTO reports (reporter_id, reported_user_id, conversation_id, reason, status) VALUES (?, ?, ?, ?, ?)',
        [reporterId, reportedUserId, conversationId, reason || null, 'pending'],
        function (err) {
          if (err) {
            console.error('Errore creazione segnalazione:', err);
            return res.status(500).json({ error: 'Errore creazione segnalazione' });
          }

          const reportId = this.lastID;
          console.log(`📝 Segnalazione creata: ID ${reportId}`);

          // Recupera dati completi per email
          const emailQuery = `
            SELECT 
              r.id,
              r.created_at,
              r.reason,
              r.conversation_id,
              reporter.id as reporter_id,
              reporter.nome as reporter_name,
              reporter.cognome as reporter_surname,
              reporter.email as reporter_email,
              reported.id as reported_user_id,
              reported.nome as reported_user_name,
              reported.cognome as reported_user_surname,
              reported.email as reported_user_email,
              reported.tavolo as reported_user_table
            FROM reports r
            JOIN users reporter ON r.reporter_id = reporter.id
            JOIN users reported ON r.reported_user_id = reported.id
            WHERE r.id = ?
          `;

          db.get(emailQuery, [reportId], (err, reportData) => {
            if (err) {
              console.error('Errore recupero dati segnalazione:', err);
            } else {
              // Invia email admin
              const emailData = {
                id: reportData.id,
                created_at: reportData.created_at,
                conversation_id: reportData.conversation_id,
                reason: reportData.reason,
                reporter_id: reportData.reporter_id,
                reporter_name: `${reportData.reporter_name} ${reportData.reporter_surname}`,
                reporter_email: reportData.reporter_email,
                reported_user_id: reportData.reported_user_id,
                reported_user_name: `${reportData.reported_user_name} ${reportData.reported_user_surname}`,
                reported_user_email: reportData.reported_user_email,
                reported_user_table: reportData.reported_user_table
              };

              sendReportEmail(emailData)
                .then(() => {
                  console.log(`📧 Email segnalazione inviata per report ID ${reportId}`);
                })
                .catch(error => {
                  console.error('Errore invio email segnalazione:', error);
                });
            }
          });

          res.json({
            success: true,
            reportId: reportId,
            message: 'Segnalazione inviata con successo'
          });
        }
      );
    }
  );
});

// ============================================================================
// API ENDPOINTS - ADMIN
// ============================================================================

// Admin: lista venues (tutti, inclusi disattivati)
app.get('/api/admin/venues', authenticateAdminJWT, (req, res) => {
  db.all('SELECT * FROM venues ORDER BY name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Errore database' });
    res.json(rows || []);
  });
});

// Admin: crea venue
app.post('/api/admin/venues', authenticateAdminJWT, (req, res) => {
  const { name, slug, logo_url, menu_url, latitude, longitude, radius_meters, central_api_key } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obbligatorio' });
  const s = (slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')).slice(0, 50) || 'venue';
  db.run(
    `INSERT INTO venues (name, slug, logo_url, menu_url, latitude, longitude, radius_meters, central_api_key) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, s, logo_url || '', menu_url || '', latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null, radius_meters || 80, central_api_key || ''],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID, slug: s });
    }
  );
});

// Admin: aggiorna venue
app.put('/api/admin/venues/:id', authenticateAdminJWT, (req, res) => {
  const id = req.params.id;
  const { name, slug, logo_url, menu_url, latitude, longitude, radius_meters, central_api_key, active } = req.body;
  db.run(
    `UPDATE venues SET name = ?, slug = ?, logo_url = ?, menu_url = ?, latitude = ?, longitude = ?, radius_meters = ?, central_api_key = ?, active = ? 
     WHERE id = ?`,
    [name || '', slug || '', logo_url || '', menu_url || '', latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null, radius_meters || 80, central_api_key || '', active !== 0 ? 1 : 0, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Login admin
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign(
      { username: ADMIN_USERNAME, isAdmin: true },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Admin login effettuato');
    res.json({ success: true, token });
  } else {
    console.log('❌ Tentativo login admin fallito');
    res.status(401).json({ error: 'Credenziali non valide' });
  }
});

// Statistiche
app.get('/api/admin/stats', authenticateAdminJWT, (req, res) => {
  const stats = {};

  db.get('SELECT COUNT(*) as count FROM users', (err, result) => {
    stats.totalUsers = result ? result.count : 0;

    db.get(
      "SELECT COUNT(*) as count FROM users WHERE logged_in = 1 AND datetime(last_activity, '+30 minutes') > datetime('now')",
      (err, result) => {
        stats.onlineUsers = result ? result.count : 0;

        // 🆕 Pulisci utenti con logged_in = 1 ma last_activity scaduta (dovrebbero essere offline)
        // Usa due controlli per sicurezza: uno con datetime() e uno con confronto diretto
        db.run(
          "UPDATE users SET logged_in = 0, tavolo = NULL WHERE logged_in = 1 AND (datetime(last_activity, '+30 minutes') <= datetime('now') OR last_activity < datetime('now', '-30 minutes'))",
          (cleanupErr) => {
            if (cleanupErr) {
              console.error('Errore pulizia utenti offline:', cleanupErr);
            } else {
              // Log solo se ci sono stati cambiamenti
              db.get("SELECT changes() as count", (logErr, logResult) => {
                if (!logErr && logResult && logResult.count > 0) {
                  console.log(`🧹 Puliti ${logResult.count} utenti con last_activity scaduta`);
                }
              });
            }
          }
        );

        db.get('SELECT COUNT(*) as count FROM messages', (err, result) => {
          stats.totalMessages = result ? result.count : 0;

          db.get('SELECT COUNT(*) as count FROM users WHERE newsletter = 1', (err, result) => {
            stats.newsletterSubscribers = result ? result.count : 0;

            db.get("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'", (err, result) => {
              stats.pendingReports = result ? result.count : 0;

              // Conta backup
              fs.readdir(BACKUP_DIR, (err, files) => {
                if (err) {
                  stats.backupCount = 0;
                } else {
                  stats.backupCount = files.filter(f => f.endsWith('.gz')).length;
                }

                res.json(stats);
              });
            });
          });
        });
      }
    );
  });
});

// Lista utenti
app.get('/api/admin/users', authenticateAdminJWT, (req, res) => {
  const query = `
    SELECT 
      u.id,
      u.email,
      u.nome,
      u.cognome,
      u.gender,
      u.distinctive_sign,
      u.tavolo,
      u.logged_in,
      u.last_activity,
      u.newsletter,
      u.created_at,
      (SELECT COUNT(*) FROM messages WHERE sender_id = u.id) as messages_sent,
      (SELECT COUNT(*) FROM reports WHERE reported_user_id = u.id) as reports_received,
      CASE 
        WHEN u.logged_in = 1 AND datetime(u.last_activity, '+30 minutes') > datetime('now') THEN 1
        ELSE 0
      END as is_online
    FROM users u
    ORDER BY u.created_at DESC
  `;

  db.all(query, (err, users) => {
    if (err) {
      console.error('Errore query utenti admin:', err);
      return res.status(500).json({ error: 'Errore database' });
    }

    // 🆕 Formatta gli utenti con stato online corretto
    const formattedUsers = users.map(user => ({
      ...user,
      logged_in: user.is_online === 1 ? 1 : 0 // Usa is_online invece di logged_in
    }));

    res.json(formattedUsers);
  });
});

// Export newsletter
app.get('/api/admin/export-newsletter', authenticateAdminJWT, (req, res) => {
  db.all(
    'SELECT email, nome, cognome, created_at FROM users WHERE newsletter = 1 ORDER BY created_at DESC',
    (err, subscribers) => {
      if (err) {
        console.error('Errore export newsletter:', err);
        return res.status(500).json({ error: 'Errore database' });
      }

      res.json(subscribers);
    }
  );
});

// Lista segnalazioni
app.get('/api/admin/reports', authenticateAdminJWT, (req, res) => {
  const query = `
    SELECT 
      r.id,
      r.reporter_id,
      r.reported_user_id,
      r.conversation_id,
      r.reason,
      r.created_at,
      r.status,
      r.reviewed_at,
      r.reviewed_by,
      r.notes,
      reporter.nome as reporter_nome,
      reporter.cognome as reporter_cognome,
      reporter.email as reporter_email,
      reported.nome as reported_nome,
      reported.cognome as reported_cognome,
      reported.email as reported_email,
      reported.tavolo as reported_tavolo
    FROM reports r
    JOIN users reporter ON r.reporter_id = reporter.id
    JOIN users reported ON r.reported_user_id = reported.id
    ORDER BY r.created_at DESC
  `;

  db.all(query, (err, reports) => {
    if (err) {
      console.error('Errore query segnalazioni:', err);
      return res.status(500).json({ error: 'Errore database' });
    }

    res.json(reports);
  });
});

// Gestisci segnalazione
app.patch('/api/admin/reports/:reportId', authenticateAdminJWT, (req, res) => {
  const { reportId } = req.params;
  const { status, notes } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status richiesto' });
  }

  db.run(
    'UPDATE reports SET status = ?, notes = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE id = ?',
    [status, notes || null, req.admin.username, reportId],
    function (err) {
      if (err) {
        console.error('Errore aggiornamento segnalazione:', err);
        return res.status(500).json({ error: 'Errore database' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Segnalazione non trovata' });
      }

      console.log(`✅ Segnalazione ${reportId} aggiornata a status: ${status}`);
      res.json({ success: true });
    }
  );
});

// IP del server
app.get('/api/admin/server-ip', authenticateAdminJWT, (req, res) => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const results = {};

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        if (!results[name]) {
          results[name] = [];
        }
        results[name].push(net.address);
      }
    }
  }

  const primaryIP = results.eth0 ? results.eth0[0] : (results.wlan0 ? results.wlan0[0] : 'Non disponibile');

  res.json({
    ip: primaryIP,
    all: results
  });
});

// Reset manuale (admin)
app.post('/api/admin/reset', authenticateAdminJWT, (req, res) => {
  console.log('🔄 Reset manuale richiesto da admin');

  resetDaily();

  res.json({
    success: true,
    message: 'Reset in corso. Il database verrà pulito e verrà creato un backup.'
  });
});

// ============================================================================
// AVVIO SERVER
// ============================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('🚀 MEEQ SERVER ATTIVO');
  console.log('='.repeat(60));
  console.log(`📍 Server in ascolto sulla porta ${PORT}`);
  console.log(`🌐 Accessibile da: http://172.16.0.10:${PORT}`);
  console.log(`⏰ Reset giornaliero: 4:00 AM`);

  // Conta backup esistenti
  fs.readdir(BACKUP_DIR, (err, files) => {
    if (!err) {
      const backupFiles = files.filter(f => f.endsWith('.gz'));
      console.log(`📊 Backup attivi: ${backupFiles.length}`);
    }
  });

  console.log(`🔒 Sistema backup attivo: conservazione 30 giorni`);
  console.log('='.repeat(60));
});
