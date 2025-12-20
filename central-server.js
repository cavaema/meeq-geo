// ============================================================================
// MEEQ CENTRAL SERVER - Server Centrale per Gestione Utenti
// ============================================================================
// Gestisce:
// - Registrazione e autenticazione utenti centralizzata
// - Dashboard admin per titolari business
// - Gestione locali (venues)
// - Segnalazioni e invio email
// ============================================================================

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'meeq-central-secret-key-2024-super-secure';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'meeq-refresh-secret-key-2024';

// Admin credentials
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'meeq2024';

// Middleware
// Se il server è dietro reverse proxy / Cloudflare, questo abilita req.ip corretta
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Route per la root: serve app.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
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

// ============================================================================
// DATABASE
// ============================================================================
const db = new sqlite3.Database('./central.db', (err) => {
  if (err) {
    console.error('❌ Errore connessione database centrale:', err);
    process.exit(1);
  } else {
    console.log('✅ Database centrale connesso');
    initDatabase().catch(err => {
      console.error('❌ Errore inizializzazione database:', err);
      process.exit(1);
    });
  }
});

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Tabella utenti centrali
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        nome TEXT NOT NULL,
        cognome TEXT NOT NULL,
        gender TEXT DEFAULT 'other',
        newsletter INTEGER DEFAULT 0,
        blocked INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);

    // Tabella pending registrations (PIN temporanei)
    db.run(`
      CREATE TABLE IF NOT EXISTS pending_registrations (
        email TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        cognome TEXT NOT NULL,
        gender TEXT DEFAULT 'other',
        pin TEXT NOT NULL,
        newsletter INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabella locali (venues)
    db.run(`
      CREATE TABLE IF NOT EXISTS venues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        contact_email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        active INTEGER DEFAULT 1
      )
    `);

    // 🆕 Migrazioni venues per mapping IP → venue e base URL API (tunnel)
    db.run(`ALTER TABLE venues ADD COLUMN api_base_url TEXT`, (err) => {
      // Ignora errore se colonna già esiste
    });
    db.run(`ALTER TABLE venues ADD COLUMN last_public_ip TEXT`, (err) => {
      // Ignora errore se colonna già esiste
    });
    db.run(`ALTER TABLE venues ADD COLUMN last_seen_at DATETIME`, (err) => {
      // Ignora errore se colonna già esiste
    });

    // Tabella segnalazioni (reports da tutti i locali)
    db.run(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venue_id INTEGER,
        reporter_user_id INTEGER,
        reported_user_id INTEGER,
        reason TEXT,
        description TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (venue_id) REFERENCES venues(id)
      )
    `);

    // Tabella refresh tokens
    db.run(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Crea un locale di default se non esiste
    db.get('SELECT COUNT(*) as count FROM venues', (err, row) => {
      if (err) {
        console.error('❌ Errore verifica venues:', err);
        reject(err);
        return;
      }
      if (row.count === 0) {
        const defaultApiKey = crypto.randomBytes(32).toString('hex');
        db.run(
          'INSERT INTO venues (name, api_key, contact_email) VALUES (?, ?, ?)',
          ['Locale Default', defaultApiKey, 'info@meeq.it'],
          function(err) {
            if (err) {
              console.error('❌ Errore creazione locale default:', err);
              reject(err);
            } else {
              console.log(`✅ Locale default creato con API Key: ${defaultApiKey}`);
              console.log('⚠️ IMPORTANTE: Salva questa API Key per configurare i server locali!');
              console.log('✅ Database centrale inizializzato');
              resolve(); // Risolvi la Promise quando tutto è completo
            }
          }
        );
      } else {
        console.log('✅ Database centrale inizializzato');
        resolve(); // Risolvi la Promise quando tutto è completo
      }
    });
    });
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generatePIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getRequestIP(req) {
  // Priorità: Cloudflare header (se presente) → XFF → req.ip
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return String(cf).split(',')[0].trim();

  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();

  const ip = req.ip || '';
  // Normalizza IPv6-mapped IPv4
  return String(ip).replace(/^::ffff:/, '');
}

async function sendPINEmail(email, pin, nome) {
  const mailOptions = {
    from: 'Meeq <info@meeq.it>',
    to: email,
    subject: 'Il tuo PIN per accedere a Meeq',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #E91E8C 0%, #9C27B0 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Meeq</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333;">Ciao ${nome},</p>
          <p style="font-size: 16px; color: #333;">Il tuo PIN per accedere a Meeq è:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 36px; font-weight: bold; color: #E91E8C; letter-spacing: 5px;">${pin}</span>
          </div>
          <p style="font-size: 14px; color: #666;">Questo PIN è valido per 24 ore.</p>
          <p style="font-size: 14px; color: #666;">Se non hai richiesto questo PIN, ignora questa email.</p>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
}

async function sendReportEmailToUser(email, nome, reportReason) {
  const mailOptions = {
    from: 'Meeq <info@meeq.it>',
    to: email,
    subject: 'Segnalazione ricevuta - Meeq',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #E91E8C 0%, #9C27B0 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Meeq</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333;">Ciao ${nome},</p>
          <p style="font-size: 16px; color: #333;">Abbiamo ricevuto una segnalazione riguardo al tuo comportamento sulla piattaforma Meeq.</p>
          <p style="font-size: 14px; color: #666;"><strong>Motivo:</strong> ${reportReason}</p>
          <p style="font-size: 14px; color: #666;">Ti invitiamo a rispettare le regole della community per garantire un'esperienza positiva per tutti.</p>
          <p style="font-size: 14px; color: #666;">Per qualsiasi domanda, contattaci a info@meeq.it</p>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
}

// ============================================================================
// MIDDLEWARE AUTHENTICATION
// ============================================================================

// Middleware per verificare API Key (server locali)
function authenticateVenueAPIKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.body.api_key || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({ error: 'API Key richiesta' });
  }

  db.get('SELECT * FROM venues WHERE api_key = ? AND active = 1', [apiKey], (err, venue) => {
    if (err) {
      console.error('❌ Errore verifica API Key:', err);
      return res.status(500).json({ error: 'Errore server' });
    }

    if (!venue) {
      return res.status(401).json({ error: 'API Key non valida' });
    }

    req.venue = venue;
    next();
  });
}

// Middleware per verificare JWT token utente
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token richiesto' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token non valido' });
    }
    req.user = user;
    next();
  });
}

// Middleware per verificare admin JWT
function authenticateAdminJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token richiesto' });
  }

  jwt.verify(token, JWT_SECRET, (err, admin) => {
    if (err || !admin.isAdmin) {
      return res.status(403).json({ error: 'Token admin non valido' });
    }
    req.admin = admin;
    next();
  });
}

// ============================================================================
// API ENDPOINTS - AUTENTICAZIONE UTENTI
// ============================================================================

// Check email
app.post('/api/central/check-email', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email richiesta' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Errore database' });
    }

    if (user) {
      // Utente esiste - genera nuovo PIN
      const pin = generatePIN();
      
      // Rimuovi vecchie pending registrations
      db.run('DELETE FROM pending_registrations WHERE email = ?', [email]);

      // Inserisci nuova pending registration
      db.run(
        'INSERT INTO pending_registrations (email, nome, cognome, gender, pin, newsletter, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user.email, user.nome, user.cognome, user.gender, pin, user.newsletter, new Date().toISOString()],
        (err) => {
          if (err) {
            console.error('Errore creazione pending registration:', err);
            return res.status(500).json({ error: 'Errore server' });
          }

          // Invia PIN via email
          sendPINEmail(email, pin, user.nome)
            .then(() => {
              console.log(`📧 PIN inviato a ${email}`);
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

// Register nuovo utente
app.post('/api/central/register', (req, res) => {
  const { email, nome, cognome, gender, newsletter } = req.body;

  if (!email || !nome || !cognome || !gender) {
    return res.status(400).json({ error: 'Dati incompleti' });
  }

  // Verifica se email già esiste
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, existingUser) => {
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

    // Inserisci pending registration
    db.run(
      'INSERT INTO pending_registrations (email, nome, cognome, gender, pin, newsletter) VALUES (?, ?, ?, ?, ?, ?)',
      [email, nome, cognome, gender, pin, newsletter ? 1 : 0],
      (err) => {
        if (err) {
          console.error('Errore inserimento pending registration:', err);
          return res.status(500).json({ error: 'Errore registrazione' });
        }

        // Invia PIN via email
        sendPINEmail(email, pin, nome)
          .then(() => {
            console.log(`📧 PIN registrazione inviato a ${email}`);
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

// Verify PIN e genera token
app.post('/api/central/verify-pin', (req, res) => {
  const { email, pin } = req.body;

  if (!email || !pin) {
    return res.status(400).json({ error: 'Email e PIN richiesti' });
  }

  // Cerca pending registration
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

      // Cerca utente esistente
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, existingUser) => {
        if (err) {
          return res.status(500).json({ error: 'Errore database' });
        }

        if (existingUser) {
          // Login utente esistente
          // Aggiorna last_login
          db.run(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [existingUser.id]
          );

          // Genera token JWT (30 giorni)
          const token = jwt.sign(
            { userId: existingUser.id, email: existingUser.email },
            JWT_SECRET,
            { expiresIn: '30d' }
          );

          // Genera refresh token (90 giorni)
          const refreshToken = jwt.sign(
            { userId: existingUser.id, email: existingUser.email, type: 'refresh' },
            JWT_REFRESH_SECRET,
            { expiresIn: '90d' }
          );

          // Salva refresh token nel database
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 90);
          db.run(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [existingUser.id, refreshToken, expiresAt.toISOString()]
          );

          // Cancella pending registration
          db.run('DELETE FROM pending_registrations WHERE email = ?', [email]);

          console.log(`✅ Login utente esistente: ${existingUser.nome} ${existingUser.cognome}`);

          res.json({
            success: true,
            token,
            refreshToken,
            user: {
              id: existingUser.id,
              email: existingUser.email,
              nome: existingUser.nome,
              cognome: existingUser.cognome,
              gender: existingUser.gender,
              newsletter: existingUser.newsletter
            }
          });
        } else {
          // Registra nuovo utente
          db.run(
            'INSERT INTO users (email, nome, cognome, gender, newsletter, last_login) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [pending.email, pending.nome, pending.cognome, pending.gender, pending.newsletter],
            function (err) {
              if (err) {
                console.error('Errore creazione utente:', err);
                return res.status(500).json({ error: 'Errore creazione account' });
              }

              const newUserId = this.lastID;

              // Genera token JWT (30 giorni)
              const token = jwt.sign(
                { userId: newUserId, email: pending.email },
                JWT_SECRET,
                { expiresIn: '30d' }
              );

              // Genera refresh token (90 giorni)
              const refreshToken = jwt.sign(
                { userId: newUserId, email: pending.email, type: 'refresh' },
                JWT_REFRESH_SECRET,
                { expiresIn: '90d' }
              );

              // Salva refresh token nel database
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 90);
              db.run(
                'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
                [newUserId, refreshToken, expiresAt.toISOString()]
              );

              // Cancella pending registration
              db.run('DELETE FROM pending_registrations WHERE email = ?', [email]);

              console.log(`✅ Nuovo utente registrato: ${pending.nome} ${pending.cognome}`);

              res.json({
                success: true,
                token,
                refreshToken,
                user: {
                  id: newUserId,
                  email: pending.email,
                  nome: pending.nome,
                  cognome: pending.cognome,
                  gender: pending.gender,
                  newsletter: pending.newsletter
                }
              });
            }
          );
        }
      });
    }
  );
});

// Verify token (per server locali)
app.post('/api/central/verify-token', authenticateVenueAPIKey, (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token richiesto' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token non valido', valid: false });
    }

    // Recupera dati utente
    db.get('SELECT * FROM users WHERE id = ? AND blocked = 0', [decoded.userId], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Errore database' });
      }

      if (!user) {
        return res.status(403).json({ error: 'Utente non trovato o bloccato', valid: false });
      }

      res.json({
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          nome: user.nome,
          cognome: user.cognome,
          gender: user.gender,
          newsletter: user.newsletter
        }
      });
    });
  });
});

// ============================================================================
// 🆕 VENUE RESOLUTION (public IP → venue) + HEARTBEAT (da locale)
// ============================================================================

// Chiamato dai server locali (con X-API-Key). Aggiorna last_public_ip/last_seen_at.
app.post('/api/central/venues/heartbeat', authenticateVenueAPIKey, (req, res) => {
  const ip = getRequestIP(req);

  // opzionale: il locale può inviare l'URL del suo tunnel/API (configurato una volta)
  const apiBaseUrl = (req.body && (req.body.apiBaseUrl || req.body.api_base_url)) ? String(req.body.apiBaseUrl || req.body.api_base_url).trim() : null;

  const fields = [];
  const values = [];

  if (ip) {
    fields.push('last_public_ip = ?');
    values.push(ip);
  }

  fields.push('last_seen_at = CURRENT_TIMESTAMP');

  if (apiBaseUrl) {
    fields.push('api_base_url = ?');
    values.push(apiBaseUrl);
  }

  values.push(req.venue.id);

  db.run(
    `UPDATE venues SET ${fields.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        console.error('❌ Errore heartbeat venue:', err);
        return res.status(500).json({ error: 'Errore database' });
      }
      res.json({
        success: true,
        venueId: req.venue.id,
        last_public_ip: ip || null,
        api_base_url: apiBaseUrl || req.venue.api_base_url || null
      });
    }
  );
});

// Chiamato dalla PWA centrale. Determina il locale basandosi sull'IP pubblico del client.
// UX richiesta:
// - determinata: entra con il numero di tavolo
// - non determinata: mostra "Non sei collegato alla rete wifi del locale" + retry
app.get('/api/central/resolve-venue', (req, res) => {
  const tavolo = (req.query.t || req.query.tavolo || req.query.table || '').toString();
  const ip = getRequestIP(req);

  if (!tavolo) {
    return res.status(400).json({ error: 'Tavolo richiesto', determined: false });
  }
  if (!ip) {
    return res.json({ determined: false, reason: 'no_ip' });
  }

  // Considera valida solo una venue "vista" di recente (evita stale mapping)
  const freshnessMinutes = Number(process.env.VENUE_IP_FRESHNESS_MINUTES) || 30;

  db.all(
    `SELECT id, name, api_base_url, last_public_ip, last_seen_at
     FROM venues
     WHERE active = 1
       AND last_public_ip = ?
       AND last_seen_at IS NOT NULL
       AND datetime(last_seen_at) > datetime('now', ?)
    `,
    [ip, `-${freshnessMinutes} minutes`],
    (err, rows) => {
      if (err) {
        console.error('❌ Errore resolve venue:', err);
        return res.status(500).json({ error: 'Errore server', determined: false });
      }

      if (!rows || rows.length !== 1) {
        // 0: non sei sul Wi-Fi del locale o venue offline
        // >1: ambiguità (raro, es. stesso public IP)
        return res.json({
          determined: false,
          reason: !rows || rows.length === 0 ? 'not_found' : 'ambiguous'
        });
      }

      const v = rows[0];
      if (!v.api_base_url) {
        return res.json({ determined: false, reason: 'venue_missing_api_base_url' });
      }

      res.json({
        determined: true,
        tavolo,
        venue: { id: v.id, name: v.name },
        apiBaseUrl: v.api_base_url
      });
    }
  );
});

// Refresh token
app.post('/api/central/refresh-token', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token richiesto' });
  }

  jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Refresh token non valido' });
    }

    // Verifica che il refresh token esista nel database
    db.get(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime("now")',
      [refreshToken],
      (err, tokenRecord) => {
        if (err || !tokenRecord) {
          return res.status(403).json({ error: 'Refresh token non valido o scaduto' });
        }

        // Genera nuovo access token
        const newToken = jwt.sign(
          { userId: decoded.userId, email: decoded.email },
          JWT_SECRET,
          { expiresIn: '30d' }
        );

        res.json({
          success: true,
          token: newToken
        });
      }
    );
  });
});

// Get user data
app.get('/api/central/user', authenticateToken, (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.user.userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Errore database' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    res.json({
      id: user.id,
      email: user.email,
      nome: user.nome,
      cognome: user.cognome,
      gender: user.gender,
      newsletter: user.newsletter
    });
  });
});

// ============================================================================
// API ENDPOINTS - ADMIN DASHBOARD
// ============================================================================

// Admin login
app.post('/api/central/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign(
      { isAdmin: true, username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Credenziali non valide' });
  }
});

// Get all users (admin)
app.get('/api/central/admin/users', authenticateAdminJWT, (req, res) => {
  const { search, blocked, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM users WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (email LIKE ? OR nome LIKE ? OR cognome LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (blocked !== undefined) {
    query += ' AND blocked = ?';
    params.push(blocked === 'true' ? 1 : 0);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, users) => {
    if (err) {
      console.error('Errore recupero utenti:', err);
      return res.status(500).json({ error: 'Errore database' });
    }

    // Conta totale
    db.get('SELECT COUNT(*) as total FROM users', (err, countRow) => {
      if (err) {
        return res.status(500).json({ error: 'Errore database' });
      }

      res.json({
        users: users.map(u => ({
          id: u.id,
          email: u.email,
          nome: u.nome,
          cognome: u.cognome,
          gender: u.gender,
          newsletter: u.newsletter,
          blocked: u.blocked === 1,
          created_at: u.created_at,
          last_login: u.last_login
        })),
        total: countRow.total
      });
    });
  });
});

// 🆕 Crea utente direttamente (admin - per migrazione)
app.post('/api/central/admin/users/create', authenticateAdminJWT, (req, res) => {
  const { email, nome, cognome, gender, newsletter } = req.body;

  if (!email || !nome || !cognome) {
    return res.status(400).json({ error: 'Email, nome e cognome richiesti' });
  }

  // Verifica se email già esiste
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Errore database' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Email già registrata', userId: existingUser.id });
    }

    // Crea utente direttamente
    db.run(
      'INSERT INTO users (email, nome, cognome, gender, newsletter) VALUES (?, ?, ?, ?, ?)',
      [email, nome, cognome, gender || 'other', newsletter ? 1 : 0],
      function (err) {
        if (err) {
          console.error('Errore creazione utente:', err);
          return res.status(500).json({ error: 'Errore creazione utente' });
        }

        console.log(`✅ Utente creato da admin: ${nome} ${cognome} (ID: ${this.lastID})`);

        res.json({
          success: true,
          user: {
            id: this.lastID,
            email,
            nome,
            cognome,
            gender: gender || 'other',
            newsletter: newsletter ? 1 : 0
          }
        });
      }
    );
  });
});

// Delete user (admin)
app.delete('/api/central/admin/users/:userId', authenticateAdminJWT, (req, res) => {
  const { userId } = req.params;

  // Prima verifica se l'utente esiste
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Errore database' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Elimina dati correlati
    // 1. Elimina refresh tokens
    db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId], (err1) => {
      if (err1) {
        console.error('Errore eliminazione refresh tokens:', err1);
      }

      // 2. Elimina reports dove l'utente è segnalato o segnalante
      db.run('DELETE FROM reports WHERE reporter_id = ? OR reported_user_id = ?', [userId, userId], (err2) => {
        if (err2) {
          console.error('Errore eliminazione reports:', err2);
        }

        // 3. Elimina pending registrations
        db.run('DELETE FROM pending_registrations WHERE email = ?', [user.email], (err3) => {
          if (err3) {
            console.error('Errore eliminazione pending registrations:', err3);
          }

          // 4. Elimina l'utente
          db.run('DELETE FROM users WHERE id = ?', [userId], function(err4) {
            if (err4) {
              console.error('Errore eliminazione utente:', err4);
              return res.status(500).json({ error: 'Errore eliminazione utente' });
            }

            console.log(`✅ Utente eliminato: ${user.email} (ID: ${userId})`);
            res.json({ success: true, message: 'Utente eliminato con successo' });
          });
        });
      });
    });
  });
});

// Block/Unblock user
app.post('/api/central/admin/users/:userId/block', authenticateAdminJWT, (req, res) => {
  const { userId } = req.params;
  const { blocked } = req.body;

  db.run(
    'UPDATE users SET blocked = ? WHERE id = ?',
    [blocked ? 1 : 0, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore database' });
      }

      res.json({ success: true, message: blocked ? 'Utente bloccato' : 'Utente sbloccato' });
    }
  );
});

// Get all reports (admin)
app.get('/api/central/admin/reports', authenticateAdminJWT, (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT r.*, 
           u1.email as reporter_email, u1.nome as reporter_nome, u1.cognome as reporter_cognome,
           u2.email as reported_email, u2.nome as reported_nome, u2.cognome as reported_cognome,
           v.name as venue_name
    FROM reports r
    LEFT JOIN users u1 ON r.reporter_user_id = u1.id
    LEFT JOIN users u2 ON r.reported_user_id = u2.id
    LEFT JOIN venues v ON r.venue_id = v.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND r.status = ?';
    params.push(status);
  }

  query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, reports) => {
    if (err) {
      console.error('Errore recupero segnalazioni:', err);
      return res.status(500).json({ error: 'Errore database' });
    }

    // Conta totale
    db.get('SELECT COUNT(*) as total FROM reports', (err, countRow) => {
      if (err) {
        return res.status(500).json({ error: 'Errore database' });
      }

      res.json({
        reports,
        total: countRow.total
      });
    });
  });
});

// Send email to reported user
app.post('/api/central/admin/reports/:reportId/send-email', authenticateAdminJWT, (req, res) => {
  const { reportId } = req.params;

  db.get('SELECT * FROM reports WHERE id = ?', [reportId], (err, report) => {
    if (err) {
      return res.status(500).json({ error: 'Errore database' });
    }

    if (!report) {
      return res.status(404).json({ error: 'Segnalazione non trovata' });
    }

    // Recupera dati utente segnalato
    db.get('SELECT * FROM users WHERE id = ?', [report.reported_user_id], (err, user) => {
      if (err || !user) {
        return res.status(500).json({ error: 'Utente non trovato' });
      }

      // Invia email
      sendReportEmailToUser(user.email, user.nome, report.reason)
        .then(() => {
          // Aggiorna status report
          db.run('UPDATE reports SET status = ? WHERE id = ?', ['email_sent', reportId]);
          res.json({ success: true, message: 'Email inviata' });
        })
        .catch(error => {
          console.error('Errore invio email:', error);
          res.status(500).json({ error: 'Errore invio email' });
        });
    });
  });
});

// Get all venues (admin)
app.get('/api/central/admin/venues', authenticateAdminJWT, (req, res) => {
  db.all('SELECT * FROM venues ORDER BY created_at DESC', (err, venues) => {
    if (err) {
      return res.status(500).json({ error: 'Errore database' });
    }

    res.json(venues.map(v => ({
      id: v.id,
      name: v.name,
      api_key: v.api_key,
      contact_email: v.contact_email,
      active: v.active === 1,
      created_at: v.created_at
    })));
  });
});

// Create venue
app.post('/api/central/admin/venues', authenticateAdminJWT, (req, res) => {
  const { name, contact_email } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nome locale richiesto' });
  }

  const apiKey = crypto.randomBytes(32).toString('hex');

  db.run(
    'INSERT INTO venues (name, api_key, contact_email) VALUES (?, ?, ?)',
    [name, apiKey, contact_email || null],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore database' });
      }

      res.json({
        success: true,
        venue: {
          id: this.lastID,
          name,
          api_key: apiKey,
          contact_email,
          active: true
        }
      });
    }
  );
});

// Update venue
app.put('/api/central/admin/venues/:venueId', authenticateAdminJWT, (req, res) => {
  const { venueId } = req.params;
  const { name, contact_email, active } = req.body;

  db.run(
    'UPDATE venues SET name = ?, contact_email = ?, active = ? WHERE id = ?',
    [name, contact_email, active ? 1 : 0, venueId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Errore database' });
      }

      res.json({ success: true, message: 'Locale aggiornato' });
    }
  );
});

// Get stats (admin)
app.get('/api/central/admin/stats', authenticateAdminJWT, (req, res) => {
  db.get('SELECT COUNT(*) as total_users FROM users', (err, usersRow) => {
    if (err) {
      return res.status(500).json({ error: 'Errore database' });
    }

    db.get('SELECT COUNT(*) as blocked_users FROM users WHERE blocked = 1', (err, blockedRow) => {
      if (err) {
        return res.status(500).json({ error: 'Errore database' });
      }

      db.get('SELECT COUNT(*) as total_reports FROM reports', (err, reportsRow) => {
        if (err) {
          return res.status(500).json({ error: 'Errore database' });
        }

        db.get('SELECT COUNT(*) as total_venues FROM venues', (err, venuesRow) => {
          if (err) {
            return res.status(500).json({ error: 'Errore database' });
          }

          res.json({
            total_users: usersRow.total_users,
            blocked_users: blockedRow.blocked_users,
            total_reports: reportsRow.total_reports,
            total_venues: venuesRow.total_venues
          });
        });
      });
    });
  });
});

// ============================================================================
// API ENDPOINTS - VENUES (per server locali)
// ============================================================================

// Create report (chiamato dai server locali)
app.post('/api/central/reports', authenticateVenueAPIKey, (req, res) => {
  const { reporter_user_id, reported_user_id, reason, description } = req.body;

  if (!reporter_user_id || !reported_user_id || !reason) {
    return res.status(400).json({ error: 'Dati incompleti' });
  }

  db.run(
    'INSERT INTO reports (venue_id, reporter_user_id, reported_user_id, reason, description) VALUES (?, ?, ?, ?, ?)',
    [req.venue.id, reporter_user_id, reported_user_id, reason, description || null],
    function(err) {
      if (err) {
        console.error('Errore creazione report:', err);
        return res.status(500).json({ error: 'Errore database' });
      }

      res.json({ success: true, reportId: this.lastID });
    }
  );
});

// ============================================================================
// SERVER START
// ============================================================================

const server = app.listen(PORT, () => {
  console.log(`📍 Server centrale in ascolto sulla porta ${PORT}`);
  console.log(`🌐 Accessibile da: http://localhost:${PORT}`);
  console.log(`🔒 JWT Secret configurato`);
  console.log(`📧 Email configurata`);
});

// Gestione shutdown graceful
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM ricevuto, chiusura graceful...');
  server.close(() => {
    console.log('✅ Server chiuso');
    db.close((err) => {
      if (err) {
        console.error('❌ Errore chiusura database:', err);
      } else {
        console.log('✅ Database chiuso');
      }
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT ricevuto, chiusura graceful...');
  server.close(() => {
    console.log('✅ Server chiuso');
    db.close((err) => {
      if (err) {
        console.error('❌ Errore chiusura database:', err);
      } else {
        console.log('✅ Database chiuso');
      }
      process.exit(0);
    });
  });
});

// Gestione errori non catturati
process.on('uncaughtException', (err) => {
  console.error('❌ Errore non catturato:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rifiutata non gestita:', reason);
  process.exit(1);
});

