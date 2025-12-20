const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const schedule = require('node-schedule');
const fs = require('fs');
const { execSync } = require('child_process');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'meeq-secret-key-change-in-production-' + Date.now();
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'meeq2024';

// 🔥 BACKUP: Configurazione
const BACKUP_DIR = path.join(__dirname, 'backups');
const BACKUP_RETENTION_DAYS = 30;
const DB_PATH = path.join(__dirname, 'chat.db');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const db = new sqlite3.Database('./chat.db', (err) => {
  if (err) {
    console.error('❌ Errore apertura database:', err);
  } else {
    console.log('✅ Database connesso');
  }
});

// 🔥 BACKUP: Crea cartella backup se non esiste
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log('📁 Cartella backup creata:', BACKUP_DIR);
}

// 🔥 MOD 1-4: Database con nuove colonne
db.serialize(() => {
  // Tabella users con gender e distinctive_sign
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefono TEXT,
    tavolo TEXT,
    gender TEXT DEFAULT 'other',
    distinctive_sign TEXT,
    logged_in INTEGER DEFAULT 0,
    privacy_accepted INTEGER DEFAULT 0,
    newsletter_accepted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabella pending_registrations con gender e distinctive_sign
  db.run(`CREATE TABLE IF NOT EXISTS pending_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    telefono TEXT,
    gender TEXT DEFAULT 'other',
    distinctive_sign TEXT,
    pin TEXT NOT NULL,
    privacy_accepted INTEGER DEFAULT 0,
    newsletter_accepted INTEGER DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    is_anonymous INTEGER DEFAULT 1,
    identity_revealed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (recipient_id) REFERENCES users(id)
  )`);

  // Tabella conversations con table_revealed
  db.run(`CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    user1_revealed INTEGER DEFAULT 0,
    user2_revealed INTEGER DEFAULT 0,
    user1_table_revealed INTEGER DEFAULT 0,
    user2_table_revealed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(id),
    FOREIGN KEY (user2_id) REFERENCES users(id),
    UNIQUE(user1_id, user2_id)
  )`);

  // 🔥 MOD 5: Tabella reports (segnalazioni)
  db.run(`CREATE TABLE IF NOT EXISTS reports (
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
  )`);

  const tables = [];
  for (let i = 1; i <= 30; i++) {
    tables.push(`('tavolo-${i}', 'Tavolo ${i}', 'Tavolo numero ${i}')`);
  }
  tables.push(`('generale', 'Chat Generale', 'Chat pubblica per tutti')`);
  
  db.run(`INSERT OR IGNORE INTO rooms (id, name, description) VALUES ${tables.join(', ')}`);
});

const transporter = nodemailer.createTransport({
  host: 'authsmtp.securemail.pro',
  port: 465,
  secure: true,
  auth: {
    user: 'info@meeq.it',
    pass: 'Flw25mq!'
  }
});

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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
    
    db.run('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?', [user.userId]);
    
    next();
  });
}

// ============================================
// 🔒 SISTEMA BACKUP AUTOMATICO
// ============================================

function createBackup() {
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const backupName = `chat_backup_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupName);
    const gzipPath = `${backupPath}.gz`;

    console.log('\n🔒 ═══════════════════════════════════════');
    console.log('   BACKUP GIORNALIERO');
    console.log('═══════════════════════════════════════');
    console.log(`📅 Data: ${timestamp}`);

    if (!fs.existsSync(DB_PATH)) {
      console.error('❌ Database non trovato:', DB_PATH);
      return false;
    }

    const dbStats = fs.statSync(DB_PATH);
    const dbSizeMB = (dbStats.size / 1024 / 1024).toFixed(2);
    console.log(`📊 Dimensione database: ${dbSizeMB} MB`);

    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`✅ Database copiato: ${backupName}`);

    execSync(`gzip -f "${backupPath}"`);
    console.log(`🗜️  Database compresso: ${backupName}.gz`);

    if (fs.existsSync(gzipPath)) {
      const gzStats = fs.statSync(gzipPath);
      const gzSizeMB = (gzStats.size / 1024 / 1024).toFixed(2);
      const compression = ((1 - gzStats.size / dbStats.size) * 100).toFixed(1);
      console.log(`📦 Dimensione compressa: ${gzSizeMB} MB (risparmio: ${compression}%)`);
    }

    console.log('✅ Backup completato con successo!');
    console.log('═══════════════════════════════════════\n');
    return true;

  } catch (error) {
    console.error('❌ Errore durante il backup:', error.message);
    console.log('═══════════════════════════════════════\n');
    return false;
  }
}

function cleanOldBackups() {
  try {
    console.log('🧹 ═══════════════════════════════════════');
    console.log('   PULIZIA BACKUP VECCHI');
    console.log('═══════════════════════════════════════');
    
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const retentionMs = BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;
    let totalSpaceFreed = 0;

    files.forEach(file => {
      if (file.endsWith('.db.gz')) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtimeMs;

        if (fileAge > retentionMs) {
          const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
          fs.unlinkSync(filePath);
          deletedCount++;
          totalSpaceFreed += stats.size;
          console.log(`🗑️  Eliminato: ${file} (${sizeMB} MB)`);
        }
      }
    });

    if (deletedCount > 0) {
      const freedMB = (totalSpaceFreed / 1024 / 1024).toFixed(2);
      console.log(`✅ ${deletedCount} backup eliminati (liberati ${freedMB} MB)`);
    } else {
      console.log('✅ Nessun backup da eliminare');
    }

    const remainingBackups = files.filter(f => f.endsWith('.db.gz')).length;
    console.log(`📊 Backup attivi: ${remainingBackups}/${BACKUP_RETENTION_DAYS}`);
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Errore durante la pulizia backup:', error.message);
    console.log('═══════════════════════════════════════\n');
  }
}

function showBackupStats() {
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db.gz'));
    
    if (files.length === 0) {
      console.log('📊 Backup attivi: 0');
      console.log(`📁 Cartella backup: ${BACKUP_DIR}`);
      return;
    }

    let totalSize = 0;
    files.forEach(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    });

    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
    console.log(`📊 Backup attivi: ${files.length} (${totalSizeMB} MB totali)`);
    console.log(`📁 Cartella backup: ${BACKUP_DIR}`);

  } catch (error) {
    console.error('❌ Errore lettura statistiche backup:', error.message);
  }
}

// ============================================
// ENDPOINTS API
// ============================================

app.post('/api/check-email', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email richiesta' });
  }

  db.get('SELECT id, nome, cognome FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      console.error('Errore check email:', err);
      return res.status(500).json({ error: 'Errore server' });
    }

    if (user) {
      const pin = generatePin();
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();

      db.run('DELETE FROM pending_registrations WHERE email = ?', [email], (deleteErr) => {
        if (deleteErr) {
          console.error('Errore eliminazione pending:', deleteErr);
          return res.status(500).json({ error: 'Errore server' });
        }

        db.run(
          `INSERT INTO pending_registrations (email, nome, cognome, telefono, pin, privacy_accepted, newsletter_accepted, expires_at) 
           VALUES (?, ?, ?, '', ?, 1, 0, ?)`,
          [email, user.nome, user.cognome, pin, expiresAt],
          (insertErr) => {
            if (insertErr) {
              console.error('Errore inserimento pending:', insertErr);
              return res.status(500).json({ error: 'Errore server' });
            }

            const mailOptions = {
              from: '"Meeq" <info@meeq.it>',
              to: email,
              subject: 'Il tuo codice PIN per Meeq',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #E91E8C;">Benvenuto su Meeq!</h2>
                  <p>Ciao <strong>${user.nome}</strong>,</p>
                  <p>Il tuo codice PIN per accedere è:</p>
                  <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #8B5CF6; margin: 20px 0;">
                    ${pin}
                  </div>
                  <p style="color: #666; font-size: 14px;">Il codice scade tra 10 minuti.</p>
                  <p style="margin-top: 30px; color: #999; font-size: 12px;">
                    Connetti. Scopri. Gioca.<br>
                    - Il team Meeq
                  </p>
                </div>
              `
            };

            transporter.sendMail(mailOptions, (mailErr) => {
              if (mailErr) {
                console.error('Errore invio email:', mailErr);
                return res.status(500).json({ error: 'Errore invio email' });
              }

              console.log(`✉️  PIN inviato a ${email}: ${pin}`);
              res.json({ 
                exists: true, 
                message: 'PIN inviato via email',
                distinctiveSign: user.distinctive_sign, // 🔥 FIX: Aggiungo il segno distintivo
                isReturningUser: true 
              });
            });
          }
        );
      });
    } else {
      res.json({ exists: false });
    }
  });
});

// 🔥 MOD 1-2: Registrazione con gender e distinctive_sign
app.post('/api/register', (req, res) => {
  const { nome, cognome, email, telefono, gender, distinctiveSign, privacyAccepted, newsletterAccepted } = req.body;

  if (!nome || !cognome || !email || !privacyAccepted || !gender) {
    return res.status(400).json({ error: 'Campi obbligatori mancanti' });
  }

  // Validazione gender
  if (!['male', 'female', 'other'].includes(gender)) {
    return res.status(400).json({ error: 'Genere non valido' });
  }

  const pin = generatePin();
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();

  db.run('DELETE FROM pending_registrations WHERE email = ?', [email], (deleteErr) => {
    if (deleteErr) {
      console.error('Errore eliminazione pending:', deleteErr);
      return res.status(500).json({ error: 'Errore server' });
    }

    db.run(
      `INSERT INTO pending_registrations (email, nome, cognome, telefono, gender, distinctive_sign, pin, privacy_accepted, newsletter_accepted, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, nome, cognome, telefono || '', gender, distinctiveSign || null, pin, privacyAccepted ? 1 : 0, newsletterAccepted ? 1 : 0, expiresAt],
      function(insertErr) {
        if (insertErr) {
          console.error('Errore salvataggio dati:', insertErr);
          return res.status(500).json({ error: 'Errore salvataggio dati' });
        }

        const mailOptions = {
          from: '"Meeq" <info@meeq.it>',
          to: email,
          subject: 'Il tuo codice PIN per Meeq',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #E91E8C;">Benvenuto su Meeq!</h2>
              <p>Ciao <strong>${nome}</strong>,</p>
              <p>Il tuo codice PIN per accedere è:</p>
              <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #8B5CF6; margin: 20px 0;">
                ${pin}
              </div>
              <p style="color: #666; font-size: 14px;">Il codice scade tra 10 minuti.</p>
              <p style="margin-top: 30px; color: #999; font-size: 12px;">
                Connetti. Scopri. Gioca.<br>
                - Il team Meeq
              </p>
            </div>
          `
        };

        transporter.sendMail(mailOptions, (mailErr) => {
          if (mailErr) {
            console.error('Errore invio email:', mailErr);
            return res.status(500).json({ error: 'Errore invio email' });
          }

          console.log(`✉️  PIN inviato a ${email}: ${pin}`);
          res.json({ 
            message: 'PIN inviato via email',
            isReturningUser: false 
          });
        });
      }
    );
  });
});

// 🔥 MOD 2: Verify-pin con gender e distinctive_sign (SENZA RICHIEDERE TAVOLO)
app.post('/api/verify-pin', (req, res) => {
  const { email, pin, gender, distinctiveSign } = req.body; // 🔥 FIX: Rimosso tavolo

  if (!email || !pin) { // 🔥 FIX: Non richiedo più il tavolo
    return res.status(400).json({ error: 'Dati incompleti' });
  }

  db.get(
    'SELECT * FROM pending_registrations WHERE email = ? AND pin = ? AND expires_at > datetime("now")',
    [email, pin],
    (err, pending) => {
      if (err) {
        console.error('Errore verifica PIN:', err);
        return res.status(500).json({ error: 'Errore server' });
      }

      if (!pending) {
        return res.status(401).json({ error: 'PIN non valido o scaduto' });
      }

      db.get('SELECT * FROM users WHERE email = ?', [email], (err2, existingUser) => {
        if (err2) {
          console.error('Errore check utente:', err2);
          return res.status(500).json({ error: 'Errore server' });
        }

        if (existingUser) {
          // Utente esistente - UPDATE con nuovi dati opzionali
          const updateGender = gender || existingUser.gender;
          const updateSign = distinctiveSign !== undefined ? distinctiveSign : existingUser.distinctive_sign;

          db.run(
            'UPDATE users SET logged_in = 1, gender = ?, distinctive_sign = ?, last_login = CURRENT_TIMESTAMP, last_activity = CURRENT_TIMESTAMP WHERE email = ?', // 🔥 FIX: Rimosso tavolo
            [updateGender, updateSign, email], // 🔥 FIX: Rimosso tavolo dai parametri
            function(updateErr) {
              if (updateErr) {
                console.error('Errore update utente:', updateErr);
                return res.status(500).json({ error: 'Errore server' });
              }

              db.run('DELETE FROM pending_registrations WHERE email = ?', [email]);

              const token = jwt.sign(
                { userId: existingUser.id, email: existingUser.email },
                JWT_SECRET,
                { expiresIn: '48h' }
              );
	      const tavolo = req.body.tavolo || existingUser.tavolo || 'temp';
              console.log(`✅ Utente ri-loggato: ${existingUser.nome} ${existingUser.cognome} (${tavolo})`);

              res.json({
                token,
                userId: existingUser.id, // 🔥 FIX: Aggiungo userId per il frontend
                user: {
                  id: existingUser.id,
                  nome: existingUser.nome,
                  cognome: existingUser.cognome,
                  email: existingUser.email,
                  telefono: existingUser.telefono,
                  // 🔥 FIX: tavolo rimosso, verrà aggiunto dopo
                  gender: updateGender,
                  distinctive_sign: updateSign,
                  privacy_accepted: existingUser.privacy_accepted,
                  newsletter_accepted: existingUser.newsletter_accepted
                }
              });
            }
          );
        } else {
          // Nuovo utente
          const userGender = gender || pending.gender || 'other';
          const userSign = distinctiveSign !== undefined ? distinctiveSign : pending.distinctive_sign;

          db.run(
            `INSERT INTO users (nome, cognome, email, telefono, gender, distinctive_sign, logged_in, privacy_accepted, newsletter_accepted, last_login, last_activity) 
             VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, // 🔥 FIX: Rimosso tavolo
            [pending.nome, pending.cognome, pending.email, pending.telefono, userGender, userSign, pending.privacy_accepted, pending.newsletter_accepted], // 🔥 FIX: Rimosso tavolo dai parametri
            function(insertErr) {
              if (insertErr) {
                console.error('Errore creazione utente:', insertErr);
                return res.status(500).json({ error: 'Errore creazione utente' });
              }

              const newUserId = this.lastID;

              db.run('DELETE FROM pending_registrations WHERE email = ?', [email]);

              const token = jwt.sign(
                { userId: newUserId, email: pending.email },
                JWT_SECRET,
                { expiresIn: '48h' }
              );

              console.log(`✅ Nuovo utente registrato: ${pending.nome} ${pending.cognome} (${tavolo})`);

              res.json({
                token,
                userId: newUserId, // 🔥 FIX: Aggiungo userId per il frontend
                user: {
                  id: newUserId,
                  nome: pending.nome,
                  cognome: pending.cognome,
                  email: pending.email,
                  telefono: pending.telefono,
                  // 🔥 FIX: tavolo rimosso, verrà aggiunto dopo
                  gender: userGender,
                  distinctive_sign: userSign,
                  privacy_accepted: pending.privacy_accepted,
                  newsletter_accepted: pending.newsletter_accepted
                }
              });
            }
          );
        }
      });
    }
  );
});

// 🔥 FIX: Nuovo endpoint per aggiornare il tavolo dopo il login
app.post('/api/select-table', authenticateToken, (req, res) => {
  const { tavolo } = req.body;
  const userId = req.user.userId;
  
  if (!tavolo) {
    return res.status(400).json({ error: 'Tavolo non specificato' });
  }
  
  console.log(`🪑 Utente ${userId} seleziona ${tavolo}`);
  
  db.run(
    'UPDATE users SET tavolo = ?, last_activity = CURRENT_TIMESTAMP WHERE id = ?',
    [tavolo, userId],
    function(err) {
      if (err) {
        console.error('Errore update tavolo:', err);
        return res.status(500).json({ error: 'Errore aggiornamento tavolo' });
      }
      
      console.log(`✅ Tavolo aggiornato per utente ${userId}: ${tavolo}`);
      res.json({ success: true, tavolo });
    }
  );
});

// 🔥 FIX: Alias per update-table (usato dal frontend)
app.post('/api/update-table', authenticateToken, (req, res) => {
  // Richiama lo stesso handler di select-table
  req.url = '/api/select-table';
  app._router.handle(req, res);
});

app.post('/api/logout', authenticateToken, (req, res) => {
  db.run('UPDATE users SET logged_in = 0, last_activity = CURRENT_TIMESTAMP WHERE id = ?', [req.user.userId], (err) => {
    if (err) {
      console.error('Errore logout:', err);
      return res.status(500).json({ error: 'Errore server' });
    }
    
    console.log(`👋 Utente disconnesso: ID ${req.user.userId}`);
    res.json({ message: 'Logout effettuato' });
  });
});

// 🔥 MOD 1-2: Lista tavoli con gender e distinctive_sign
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

// 🔥 MOD 1-2-4: Conversazioni con gender, distinctive_sign e table_revealed
app.get('/api/conversations', authenticateToken, (req, res) => {
  const query = `
    SELECT 
      c.id,
      c.status,
      c.user1_revealed,
      c.user2_revealed,
      c.user1_table_revealed,
      c.user2_table_revealed,
      c.created_at,
      c.updated_at,
      CASE 
        WHEN c.user1_id = ? THEN c.user2_id
        ELSE c.user1_id
      END as other_user_id,
      CASE 
        WHEN c.user1_id = ? THEN u2.nome
        ELSE u1.nome
      END as other_user_name,
      CASE 
        WHEN c.user1_id = ? THEN u2.cognome
        ELSE u1.cognome
      END as other_user_surname,
      CASE 
        WHEN c.user1_id = ? THEN u2.tavolo
        ELSE u1.tavolo
      END as other_user_table,
      CASE 
        WHEN c.user1_id = ? THEN u2.gender
        ELSE u1.gender
      END as other_user_gender,
      CASE 
        WHEN c.user1_id = ? THEN u2.distinctive_sign
        ELSE u1.distinctive_sign
      END as other_user_sign,
      CASE 
        WHEN c.user1_id = ? THEN c.user2_revealed
        ELSE c.user1_revealed
      END as other_user_revealed,
      CASE 
        WHEN c.user1_id = ? THEN c.user2_table_revealed
        ELSE c.user1_table_revealed
      END as other_user_table_revealed,
      (SELECT COUNT(*) FROM messages m 
       WHERE (m.sender_id = other_user_id AND m.recipient_id = ?)
       AND m.created_at > COALESCE(
         (SELECT MAX(created_at) FROM messages 
          WHERE sender_id = ? AND recipient_id = other_user_id),
         '1970-01-01'
       )) as unread_count,
      (SELECT m.message FROM messages m
       WHERE (m.sender_id = other_user_id AND m.recipient_id = ?)
          OR (m.sender_id = ? AND m.recipient_id = other_user_id)
       ORDER BY m.created_at DESC LIMIT 1) as last_message
    FROM conversations c
    JOIN users u1 ON c.user1_id = u1.id
    JOIN users u2 ON c.user2_id = u2.id
    WHERE (c.user1_id = ? OR c.user2_id = ?)
    ORDER BY c.updated_at DESC
  `;

  const userId = req.user.userId;

  db.all(query, [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId], (err, conversations) => {
    if (err) {
      console.error('Errore recupero conversazioni:', err);
      return res.status(500).json({ error: 'Errore database' });
    }

    res.json(conversations.map(conv => ({
      id: conv.id,
      status: conv.status,
      otherUser: {
        id: conv.other_user_id,
        nome: conv.other_user_name,
        cognome: conv.other_user_surname,
        tavolo: conv.other_user_table,
        gender: conv.other_user_gender,
        distinctive_sign: conv.other_user_sign,
        revealed: conv.other_user_revealed === 1,
        tableRevealed: conv.other_user_table_revealed === 1
      },
      unreadCount: conv.unread_count,
      lastMessage: conv.last_message,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at
    })));
  });
});

app.post('/api/conversations', authenticateToken, (req, res) => {
  const { recipientId, initialMessage } = req.body;
  const senderId = req.user.userId;

  if (!recipientId) {
    return res.status(400).json({ error: 'ID destinatario richiesto' });
  }

  if (senderId === recipientId) {
    return res.status(400).json({ error: 'Non puoi chattare con te stesso' });
  }

  const user1Id = Math.min(senderId, recipientId);
  const user2Id = Math.max(senderId, recipientId);

  db.get(
    'SELECT * FROM conversations WHERE user1_id = ? AND user2_id = ?',
    [user1Id, user2Id],
    (err, existingConv) => {
      if (err) {
        console.error('Errore check conversazione:', err);
        return res.status(500).json({ error: 'Errore database' });
      }

      if (existingConv) {
        if (initialMessage) {
          db.run(
            'INSERT INTO messages (sender_id, recipient_id, message) VALUES (?, ?, ?)',
            [senderId, recipientId, initialMessage],
            (msgErr) => {
              if (msgErr) {
                console.error('Errore invio messaggio iniziale:', msgErr);
              }

              db.run(
                'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [existingConv.id]
              );
            }
          );
        }

        return res.json({ conversation: existingConv });
      }

      db.run(
        'INSERT INTO conversations (user1_id, user2_id, status) VALUES (?, ?, ?)',
        [user1Id, user2Id, 'pending'],
        function(insertErr) {
          if (insertErr) {
            console.error('Errore creazione conversazione:', insertErr);
            return res.status(500).json({ error: 'Errore creazione conversazione' });
          }

          const newConvId = this.lastID;

          if (initialMessage) {
            db.run(
              'INSERT INTO messages (sender_id, recipient_id, message) VALUES (?, ?, ?)',
              [senderId, recipientId, initialMessage],
              (msgErr) => {
                if (msgErr) {
                  console.error('Errore invio messaggio iniziale:', msgErr);
                }
              }
            );
          }

          console.log(`💬 Nuova conversazione: User ${senderId} → User ${recipientId}`);

          res.json({
            conversation: {
              id: newConvId,
              user1_id: user1Id,
              user2_id: user2Id,
              status: 'pending',
              user1_revealed: 0,
              user2_revealed: 0,
              user1_table_revealed: 0,
              user2_table_revealed: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          });
        }
      );
    }
  );
});

// 🔥 MOD 1-2-4: Messaggi con gender, distinctive_sign e table_revealed
app.get('/api/conversations/:conversationId/messages', authenticateToken, (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.userId;

  db.get(
    'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
    [conversationId, userId, userId],
    (err, conversation) => {
      if (err) {
        console.error('Errore verifica conversazione:', err);
        return res.status(500).json({ error: 'Errore database' });
      }

      if (!conversation) {
        return res.status(404).json({ error: 'Conversazione non trovata' });
      }

      const otherUserId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;

      const query = `
        SELECT 
          m.*,
          s.nome as sender_nome,
          s.cognome as sender_cognome,
          s.tavolo as sender_tavolo,
          s.gender as sender_gender,
          s.distinctive_sign as sender_sign,
          r.nome as recipient_nome,
          r.cognome as recipient_cognome,
          r.tavolo as recipient_tavolo,
          r.gender as recipient_gender,
          r.distinctive_sign as recipient_sign,
          CASE 
            WHEN m.sender_id = ? THEN ${conversation.user1_id === userId ? 'c.user1_revealed' : 'c.user2_revealed'}
            ELSE ${conversation.user1_id === userId ? 'c.user2_revealed' : 'c.user1_revealed'}
          END as sender_revealed,
          CASE 
            WHEN m.sender_id = ? THEN ${conversation.user1_id === userId ? 'c.user1_table_revealed' : 'c.user2_table_revealed'}
            ELSE ${conversation.user1_id === userId ? 'c.user2_table_revealed' : 'c.user1_table_revealed'}
          END as sender_table_revealed
        FROM messages m
        JOIN users s ON m.sender_id = s.id
        JOIN users r ON m.recipient_id = r.id
        LEFT JOIN conversations c ON c.id = ?
        WHERE (m.sender_id = ? AND m.recipient_id = ?)
           OR (m.sender_id = ? AND m.recipient_id = ?)
        ORDER BY m.created_at ASC
      `;

      db.all(
        query,
        [userId, userId, conversationId, userId, otherUserId, otherUserId, userId],
        (err2, messages) => {
          if (err2) {
            console.error('Errore recupero messaggi:', err2);
            return res.status(500).json({ error: 'Errore database' });
          }

          res.json({
            conversation: {
              id: conversation.id,
              status: conversation.status,
              user1_revealed: conversation.user1_revealed,
              user2_revealed: conversation.user2_revealed,
              user1_table_revealed: conversation.user1_table_revealed,
              user2_table_revealed: conversation.user2_table_revealed
            },
            messages: messages.map(msg => ({
              id: msg.id,
              sender: {
                id: msg.sender_id,
                nome: msg.sender_nome,
                cognome: msg.sender_cognome,
                tavolo: msg.sender_tavolo,
                gender: msg.sender_gender,
                distinctive_sign: msg.sender_sign,
                revealed: msg.sender_revealed === 1,
                tableRevealed: msg.sender_table_revealed === 1
              },
              recipient: {
                id: msg.recipient_id,
                nome: msg.recipient_nome,
                cognome: msg.recipient_cognome,
                tavolo: msg.recipient_tavolo,
                gender: msg.recipient_gender,
                distinctive_sign: msg.recipient_sign
              },
              message: msg.message,
              createdAt: msg.created_at
            }))
          });
        }
      );
    }
  );
});

app.post('/api/conversations/:conversationId/messages', authenticateToken, (req, res) => {
  const { conversationId } = req.params;
  const { message } = req.body;
  const senderId = req.user.userId;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Messaggio vuoto' });
  }

  db.get(
    'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
    [conversationId, senderId, senderId],
    (err, conversation) => {
      if (err) {
        console.error('Errore verifica conversazione:', err);
        return res.status(500).json({ error: 'Errore database' });
      }

      if (!conversation) {
        return res.status(404).json({ error: 'Conversazione non trovata' });
      }

      const recipientId = conversation.user1_id === senderId ? conversation.user2_id : conversation.user1_id;

      db.run(
        'INSERT INTO messages (sender_id, recipient_id, message) VALUES (?, ?, ?)',
        [senderId, recipientId, message.trim()],
        function(insertErr) {
          if (insertErr) {
            console.error('Errore invio messaggio:', insertErr);
            return res.status(500).json({ error: 'Errore invio messaggio' });
          }

          db.run(
            'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [conversationId]
          );

          console.log(`💬 Messaggio inviato: ${senderId} → ${recipientId}`);

          res.json({
            id: this.lastID,
            sender_id: senderId,
            recipient_id: recipientId,
            message: message.trim(),
            created_at: new Date().toISOString()
          });
        }
      );
    }
  );
});

app.post('/api/conversations/:conversationId/accept', authenticateToken, (req, res) => {
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

      db.run(
        'UPDATE conversations SET status = ? WHERE id = ?',
        ['accepted', conversationId],
        (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ error: 'Errore aggiornamento' });
          }

          console.log(`✅ Conversazione accettata: ID ${conversationId} da User ${userId}`);
          res.json({ message: 'Conversazione accettata' });
        }
      );
    }
  );
});

app.post('/api/conversations/:conversationId/reject', authenticateToken, (req, res) => {
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

      const otherUserId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;

      db.run('DELETE FROM messages WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)',
        [userId, otherUserId, otherUserId, userId],
        (delMsgErr) => {
          if (delMsgErr) {
            console.error('Errore eliminazione messaggi:', delMsgErr);
          }

          db.run('DELETE FROM conversations WHERE id = ?', [conversationId], (delConvErr) => {
            if (delConvErr) {
              return res.status(500).json({ error: 'Errore eliminazione' });
            }

            console.log(`❌ Conversazione rifiutata e eliminata: ID ${conversationId} da User ${userId}`);
            res.json({ message: 'Conversazione rifiutata' });
          });
        }
      );
    }
  );
});

// Rivela nome (endpoint esistente)
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
      const columnToUpdate = isUser1 ? 'user1_revealed' : 'user2_revealed';

      db.run(
        `UPDATE conversations SET ${columnToUpdate} = 1 WHERE id = ?`,
        [conversationId],
        (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ error: 'Errore rivelazione identità' });
          }

          console.log(`🎭 Identità rivelata: User ${userId} nella conversazione ${conversationId}`);
          res.json({ message: 'Identità rivelata' });
        }
      );
    }
  );
});

// 🔥 MOD 4: Nuovo endpoint per rivelare tavolo
app.post('/api/conversations/:conversationId/reveal-table', authenticateToken, (req, res) => {
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
      const columnToUpdate = isUser1 ? 'user1_table_revealed' : 'user2_table_revealed';

      db.run(
        `UPDATE conversations SET ${columnToUpdate} = 1 WHERE id = ?`,
        [conversationId],
        (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ error: 'Errore rivelazione tavolo' });
          }

          console.log(`📍 Tavolo rivelato: User ${userId} nella conversazione ${conversationId}`);
          res.json({ message: 'Tavolo rivelato' });
        }
      );
    }
  );
});

// 🔥 MOD 5: Endpoint per segnalare utente
app.post('/api/conversations/:conversationId/report', authenticateToken, (req, res) => {
  const { conversationId } = req.params;
  const { reason } = req.body;
  const reporterId = req.user.userId;

  db.get(
    'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
    [conversationId, reporterId, reporterId],
    (err, conversation) => {
      if (err) {
        return res.status(500).json({ error: 'Errore database' });
      }

      if (!conversation) {
        return res.status(404).json({ error: 'Conversazione non trovata' });
      }

      const reportedUserId = conversation.user1_id === reporterId ? conversation.user2_id : conversation.user1_id;

      // Salva segnalazione
      db.run(
        'INSERT INTO reports (reporter_id, reported_user_id, conversation_id, reason) VALUES (?, ?, ?, ?)',
        [reporterId, reportedUserId, conversationId, reason || ''],
        function(insertErr) {
          if (insertErr) {
            console.error('Errore salvataggio segnalazione:', insertErr);
            return res.status(500).json({ error: 'Errore salvataggio segnalazione' });
          }

          const reportId = this.lastID;

          // Recupera info utenti per email
          db.get('SELECT nome, cognome, email FROM users WHERE id = ?', [reporterId], (err1, reporter) => {
            if (err1 || !reporter) {
              console.error('Errore recupero reporter:', err1);
              return res.json({ message: 'Segnalazione inviata' });
            }

            db.get('SELECT nome, cognome, email FROM users WHERE id = ?', [reportedUserId], (err2, reported) => {
              if (err2 || !reported) {
                console.error('Errore recupero reported:', err2);
                return res.json({ message: 'Segnalazione inviata' });
              }

              // Invia email all'admin
              const mailOptions = {
                from: '"Meeq Alert" <info@meeq.it>',
                to: 'info@meeq.it',
                subject: `⚠️ Nuova Segnalazione Utente #${reportId}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #E91E8C; border-bottom: 3px solid #E91E8C; padding-bottom: 10px;">
                      ⚠️ Nuova Segnalazione Utente
                    </h2>
                    
                    <div style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-left: 4px solid #dc3545;">
                      <h3 style="margin-top: 0; color: #dc3545;">Segnalazione #${reportId}</h3>
                      <p style="margin: 5px 0;"><strong>Data:</strong> ${new Date().toLocaleString('it-IT')}</p>
                    </div>

                    <div style="margin: 20px 0;">
                      <h3 style="color: #333;">Chi ha segnalato:</h3>
                      <ul style="list-style: none; padding: 0;">
                        <li>👤 <strong>Nome:</strong> ${reporter.nome} ${reporter.cognome}</li>
                        <li>📧 <strong>Email:</strong> ${reporter.email}</li>
                        <li>🆔 <strong>ID:</strong> ${reporterId}</li>
                      </ul>
                    </div>

                    <div style="margin: 20px 0;">
                      <h3 style="color: #333;">Utente segnalato:</h3>
                      <ul style="list-style: none; padding: 0;">
                        <li>👤 <strong>Nome:</strong> ${reported.nome} ${reported.cognome}</li>
                        <li>📧 <strong>Email:</strong> ${reported.email}</li>
                        <li>🆔 <strong>ID:</strong> ${reportedUserId}</li>
                      </ul>
                    </div>

                    <div style="margin: 20px 0;">
                      <h3 style="color: #333;">Motivo:</h3>
                      <div style="background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
                        ${reason || '<em style="color: #999;">Nessun motivo specificato</em>'}
                      </div>
                    </div>

                    <div style="margin: 20px 0;">
                      <h3 style="color: #333;">Dettagli tecnici:</h3>
                      <ul style="list-style: none; padding: 0; font-size: 14px; color: #666;">
                        <li>💬 <strong>Conversazione ID:</strong> ${conversationId}</li>
                        <li>📋 <strong>Segnalazione ID:</strong> ${reportId}</li>
                      </ul>
                    </div>

                    <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
                      <p style="margin: 0; color: #856404;">
                        <strong>⚠️ Azione richiesta:</strong> Accedi al pannello admin per visualizzare i dettagli completi e gestire la segnalazione.
                      </p>
                    </div>

                    <div style="text-align: center; margin-top: 30px;">
                      <a href="http://172.16.0.10:3000/admin" 
                         style="background: #E91E8C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Vai al Pannello Admin
                      </a>
                    </div>

                    <p style="margin-top: 30px; color: #999; font-size: 12px; text-align: center;">
                      Questo è un messaggio automatico del sistema Meeq<br>
                      Non rispondere a questa email
                    </p>
                  </div>
                `
              };

              transporter.sendMail(mailOptions, (mailErr) => {
                if (mailErr) {
                  console.error('Errore invio email segnalazione:', mailErr);
                } else {
                  console.log(`⚠️  Segnalazione #${reportId}: ${reporter.email} → ${reported.email}`);
                }
              });

              res.json({ message: 'Segnalazione inviata' });
            });
          });
        }
      );
    }
  );
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

// 🔐 ENDPOINT LOGIN ADMIN (per React app con JWT)
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password richiesti' });
  }

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    // Genera JWT token
    const token = jwt.sign(
      { role: 'admin', username: username },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    console.log('✅ Admin login successful:', username);
    res.json({ 
      success: true, 
      token: token 
    });
  } else {
    console.log('❌ Admin login failed:', username);
    res.status(401).json({ error: 'Credenziali non valide' });
  }
});

// Middleware per verificare JWT token Bearer (per React app)
function authenticateAdminJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token mancante' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('JWT verify error:', err.message);
      return res.status(403).json({ error: 'Token non valido' });
    }
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Permessi insufficienti' });
    }
    
    req.admin = decoded;
    next();
  });
}

// Middleware Basic Auth (manteniamo per compatibilità)
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Autenticazione richiesta' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Credenziali non valide' });
  }
}

app.get('/api/admin/stats', authenticateAdminJWT, (req, res) => {
  db.get('SELECT COUNT(*) as total FROM users', [], (err, totalUsers) => {
    if (err) {
      return res.status(500).json({ error: 'Errore server' });
    }

    db.get('SELECT COUNT(*) as online FROM users WHERE logged_in = 1 AND datetime(last_activity, "+30 minutes") > datetime("now")', [], (err2, onlineUsers) => {
      if (err2) {
        return res.status(500).json({ error: 'Errore server' });
      }

      db.get('SELECT COUNT(*) as total FROM messages', [], (err3, totalMessages) => {
        if (err3) {
          return res.status(500).json({ error: 'Errore server' });
        }

        db.get('SELECT COUNT(*) as subscribed FROM users WHERE newsletter_accepted = 1', [], (err4, newsletter) => {
          if (err4) {
            return res.status(500).json({ error: 'Errore server' });
          }

          // 🔥 MOD 5: Aggiungi conteggio segnalazioni
          db.get('SELECT COUNT(*) as pending FROM reports WHERE status = "pending"', [], (err5, reports) => {
            if (err5) {
              return res.status(500).json({ error: 'Errore server' });
            }

            res.json({
              totalUsers: totalUsers.total,
              onlineUsers: onlineUsers.online,
              totalMessages: totalMessages.total,
              newsletterSubscribers: newsletter.subscribed,
              pendingReports: reports.pending
            });
          });
        });
      });
    });
  });
});

// 🔥 MOD 1: Lista utenti con gender e distinctive_sign
app.get('/api/admin/users', authenticateAdminJWT, (req, res) => {
  const query = `
    SELECT 
      id, 
      nome, 
      cognome, 
      email, 
      telefono, 
      tavolo,
      gender,
      distinctive_sign,
      logged_in,
      privacy_accepted,
      newsletter_accepted,
      created_at,
      last_login,
      last_activity
    FROM users 
    ORDER BY created_at DESC
  `;

  db.all(query, [], (err, users) => {
    if (err) {
      console.error('Errore recupero utenti:', err);
      return res.status(500).json({ error: 'Errore server' });
    }

    res.json(users || []);
  });
});

app.delete('/api/admin/users/:userId', authenticateAdminJWT, (req, res) => {
  const { userId } = req.params;

  db.run('DELETE FROM messages WHERE sender_id = ? OR recipient_id = ?', [userId, userId], (err) => {
    if (err) {
      console.error('Errore eliminazione messaggi:', err);
      return res.status(500).json({ error: 'Errore server' });
    }

    db.run('DELETE FROM conversations WHERE user1_id = ? OR user2_id = ?', [userId, userId], (err2) => {
      if (err2) {
        console.error('Errore eliminazione conversazioni:', err2);
        return res.status(500).json({ error: 'Errore server' });
      }

      db.run('DELETE FROM reports WHERE reporter_id = ? OR reported_user_id = ?', [userId, userId], (err3) => {
        if (err3) {
          console.error('Errore eliminazione segnalazioni:', err3);
        }

        db.run('DELETE FROM users WHERE id = ?', [userId], function(err4) {
          if (err4) {
            console.error('Errore eliminazione utente:', err4);
            return res.status(500).json({ error: 'Errore server' });
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: 'Utente non trovato' });
          }

          res.json({ message: 'Utente eliminato' });
        });
      });
    });
  });
});

app.get('/api/admin/export-newsletter', authenticateAdminJWT, (req, res) => {
  db.all(
    'SELECT nome, cognome, email, telefono FROM users WHERE newsletter_accepted = 1 ORDER BY created_at DESC',
    [],
    (err, users) => {
      if (err) {
        console.error('Errore esportazione newsletter:', err);
        return res.status(500).json({ error: 'Errore server' });
      }

      let csv = 'Nome,Cognome,Email,Telefono\n';
      users.forEach(user => {
        csv += `"${user.nome}","${user.cognome}","${user.email}","${user.telefono || ''}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=newsletter-meeq.csv');
      res.send(csv);
    }
  );
});

// 🔥 MOD 5: Endpoint per visualizzare segnalazioni
app.get('/api/admin/reports', authenticateAdminJWT, (req, res) => {
  const query = `
    SELECT 
      r.id,
      r.reporter_id,
      r.reported_user_id,
      r.conversation_id,
      r.reason,
      r.status,
      r.created_at,
      r.reviewed_at,
      r.reviewed_by,
      r.notes,
      u1.nome as reporter_nome,
      u1.cognome as reporter_cognome,
      u1.email as reporter_email,
      u2.nome as reported_nome,
      u2.cognome as reported_cognome,
      u2.email as reported_email
    FROM reports r
    JOIN users u1 ON r.reporter_id = u1.id
    JOIN users u2 ON r.reported_user_id = u2.id
    ORDER BY 
      CASE r.status 
        WHEN 'pending' THEN 1 
        WHEN 'reviewed' THEN 2 
        ELSE 3 
      END,
      r.created_at DESC
  `;

  db.all(query, [], (err, reports) => {
    if (err) {
      console.error('Errore recupero segnalazioni:', err);
      return res.status(500).json({ error: 'Errore server' });
    }

    res.json(reports || []);
  });
});

// 🔥 MOD 5: Endpoint per aggiornare stato segnalazione
app.patch('/api/admin/reports/:reportId', authenticateAdminJWT, (req, res) => {
  const { reportId } = req.params;
  const { status, notes } = req.body;

  if (!['pending', 'reviewed', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Stato non valido' });
  }

  db.run(
    'UPDATE reports SET status = ?, notes = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE id = ?',
    [status, notes || '', 'admin', reportId],
    function(err) {
      if (err) {
        console.error('Errore aggiornamento segnalazione:', err);
        return res.status(500).json({ error: 'Errore server' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Segnalazione non trovata' });
      }

      res.json({ message: 'Segnalazione aggiornata' });
    }
  );
});

app.get('/api/admin/server-ip', authenticateAdminJWT, (req, res) => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  let serverIp = '172.16.0.10';

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        serverIp = iface.address;
        break;
      }
    }
  }

  res.json({ ip: serverIp, port: PORT });
});

// ============================================
// CLEANUP AUTOMATICI
// ============================================

setInterval(() => {
  const query = `
    UPDATE users 
    SET logged_in = 0 
    WHERE logged_in = 1 
      AND datetime(last_activity, '+30 minutes') < datetime('now')
  `;

  db.run(query, [], function(err) {
    if (err) {
      console.error('Errore cleanup utenti:', err);
    } else if (this.changes > 0) {
      console.log(`🧹 Cleanup: ${this.changes} utenti disconnessi per inattività`);
    }
  });
}, 5 * 60 * 1000);

setInterval(() => {
  db.run('DELETE FROM pending_registrations WHERE expires_at < datetime("now")', [], function(err) {
    if (err) {
      console.error('Errore cleanup PIN:', err);
    } else if (this.changes > 0) {
      console.log(`🧹 Cleanup: ${this.changes} PIN scaduti eliminati`);
    }
  });
}, 10 * 60 * 1000);

// ============================================
// 🔄 RESET GIORNALIERO CON BACKUP
// ============================================

function resetDaily() {
  console.log('\n🔄 ═══════════════════════════════════════');
  console.log('   RESET GIORNALIERO IN CORSO...');
  console.log('═══════════════════════════════════════');
  
  const timestamp = new Date().toLocaleString('it-IT');
  console.log(`🕐 Ora: ${timestamp}\n`);
  
  const backupSuccess = createBackup();
  
  if (!backupSuccess) {
    console.error('⚠️  ATTENZIONE: Backup fallito, ma continuo con il reset');
  }
  
  console.log('🔄 ═══════════════════════════════════════');
  console.log('   RESET DATABASE');
  console.log('═══════════════════════════════════════');
  
  db.serialize(() => {
    db.run('DELETE FROM messages', [], function(err) {
      if (err) {
        console.error('❌ Errore cancellazione messaggi:', err);
      } else {
        console.log(`✅ Messaggi cancellati: ${this.changes}`);
      }
    });
    
    db.run('DELETE FROM conversations', [], function(err) {
      if (err) {
        console.error('❌ Errore cancellazione conversazioni:', err);
      } else {
        console.log(`✅ Conversazioni cancellate: ${this.changes}`);
      }
    });
    
    db.run('UPDATE users SET logged_in = 0, tavolo = NULL, last_activity = NULL', [], function(err) {
      if (err) {
        console.error('❌ Errore reset utenti:', err);
      } else {
        console.log(`✅ Utenti resettati (logout): ${this.changes}`);
      }
    });
    
    db.run('VACUUM', [], function(err) {
      if (err) {
        console.error('❌ Errore VACUUM:', err);
      } else {
        console.log('✅ Database ottimizzato');
      }
    });
    
    console.log('═══════════════════════════════════════\n');
    
    cleanOldBackups();
    
    console.log('✨ ═══════════════════════════════════════');
    console.log('   RESET COMPLETATO!');
    console.log('   Sistema pronto per nuovo giorno.');
    console.log('═══════════════════════════════════════\n');
  });
}

schedule.scheduleJob('0 4 * * *', () => {
  console.log('\n⏰ ═══════════════════════════════════════');
  console.log('   TRIGGER AUTOMATICO');
  console.log('═══════════════════════════════════════');
  console.log('Reset giornaliero avviato alle 4:00 AM\n');
  resetDaily();
});

console.log('⏰ Reset automatico programmato: ogni giorno alle 4:00 AM');
console.log('🔒 Sistema backup attivo: conservazione 30 giorni');

// ============================================
// AVVIO SERVER
// ============================================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 ═══════════════════════════════════════');
  console.log('   MEEQ SERVER ATTIVO');
  console.log('═══════════════════════════════════════');
  console.log(`📱 Locale:  http://localhost:${PORT}`);
  console.log(`🌐 Network: http://172.16.0.10:${PORT}`);
  console.log(`👨‍💼 Admin:   http://172.16.0.10:${PORT}/admin`);
  console.log('═══════════════════════════════════════');
  
  showBackupStats();
  
  console.log('═══════════════════════════════════════\n');
  console.log('✨ Connetti. Scopri. Gioca.\n');
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM ricevuto. Chiusura server...');
  server.close(() => {
    console.log('✅ Server chiuso');
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT ricevuto. Chiusura server...');
  server.close(() => {
    console.log('✅ Server chiuso');
    db.close();
    process.exit(0);
  });
});
