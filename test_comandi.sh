# MEEQ - Test Suite per le 7 Modifiche
# Comandi per verificare che tutto funzioni correttamente

## ═══════════════════════════════════════════════════
## TEST 1: VERIFICA DATABASE - Tabella blocked_users
## ═══════════════════════════════════════════════════

ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db '.tables'" 
# Output atteso: deve includere "blocked_users"

ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db '.schema blocked_users'"
# Output atteso: struttura della tabella


## ═══════════════════════════════════════════════════
## TEST 2: VERIFICA SERVER STATUS
## ═══════════════════════════════════════════════════

ssh meeq@172.16.0.10 "sudo systemctl status meeq"
# Output atteso: active (running)


## ═══════════════════════════════════════════════════
## TEST 3: VERIFICA LOGS SERVER
## ═══════════════════════════════════════════════════

# Monitoraggio live dei logs
ssh meeq@172.16.0.10 "sudo journalctl -u meeq -f"

# Ultimi 50 log
ssh meeq@172.16.0.10 "sudo journalctl -u meeq -n 50 --no-pager"

# Cerca errori
ssh meeq@172.16.0.10 "sudo journalctl -u meeq -n 100 --no-pager | grep -i error"


## ═══════════════════════════════════════════════════
## TEST 4: VERIFICA BLOCCHI ATTIVI
## ═══════════════════════════════════════════════════

# Conta blocchi attivi
ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db 'SELECT COUNT(*) FROM blocked_users;'"

# Vedi tutti i blocchi
ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db 'SELECT * FROM blocked_users;'"

# Blocchi per utente specifico (cambia USER_ID)
ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db 'SELECT * FROM blocked_users WHERE user_id = USER_ID OR blocked_user_id = USER_ID;'"


## ═══════════════════════════════════════════════════
## TEST 5: VERIFICA TIMESTAMP MESSAGGI
## ═══════════════════════════════════════════════════

# Vedi ultimi 10 messaggi con timestamp
ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db 'SELECT id, sender_id, message, created_at FROM messages ORDER BY created_at DESC LIMIT 10;'"

# Verifica che created_at sia in formato locale (non UTC)
ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db 'SELECT datetime(\"now\", \"localtime\") as ora_locale, CURRENT_TIMESTAMP as ora_utc;'"


## ═══════════════════════════════════════════════════
## TEST 6: TEST EMAIL PIN (opzionale)
## ═══════════════════════════════════════════════════

# Test invio email - SOSTITUISCI tua_email@example.com
ssh meeq@172.16.0.10 "cd ~/meeq && node -e \"
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'authsmtp.securemail.pro',
  port: 587,
  auth: { user: 'info@meeq.it', pass: 'Flw25mq!' }
});
transporter.sendMail({
  from: 'info@meeq.it',
  to: 'tua_email@example.com',
  subject: 'Test Meeq',
  html: '<p>Test email con avviso spam</p><div style=\\\"background:#fff3cd;padding:15px;margin-top:20px;\\\"><strong>⚠️ IMPORTANTE:</strong> Controlla anche la cartella SPAM</div>'
}).then(() => console.log('✅ Email inviata')).catch(err => console.error('❌ Errore:', err));
\""


## ═══════════════════════════════════════════════════
## TEST 7: RESET MANUALE (per test blocchi)
## ═══════════════════════════════════════════════════

# ATTENZIONE: Questo cancella TUTTO (conversazioni, messaggi, blocchi)
# Usa solo per test in ambiente di sviluppo

# Prima, ottieni un token admin (devi fare login come admin)
# Poi esegui:

curl -X POST http://172.16.0.10:3000/api/admin/reset \
     -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
     -H "Content-Type: application/json"

# Oppure, esegui direttamente la funzione resetDaily dal codice
ssh meeq@172.16.0.10 "cd ~/meeq && node -e \"
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chat.db');
db.run('DELETE FROM messages');
db.run('DELETE FROM conversations');
db.run('DELETE FROM blocked_users', () => {
  console.log('✅ Blocchi cancellati');
  db.close();
});
\""


## ═══════════════════════════════════════════════════
## TEST 8: VERIFICA CONVERSAZIONI
## ═══════════════════════════════════════════════════

# Conta conversazioni attive
ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db 'SELECT COUNT(*) FROM conversations;'"

# Vedi tutte le conversazioni
ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db 'SELECT id, user1_id, user2_id, status, user1_name_revealed, user2_name_revealed FROM conversations;'"


## ═══════════════════════════════════════════════════
## TEST 9: VERIFICA UTENTI ONLINE
## ═══════════════════════════════════════════════════

# Conta utenti loggati
ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db 'SELECT COUNT(*) FROM users WHERE logged_in = 1;'"

# Vedi utenti online con tavoli
ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db 'SELECT id, nome, email, tavolo, logged_in FROM users WHERE logged_in = 1;'"


## ═══════════════════════════════════════════════════
## TEST 10: BACKUP DATABASE (prima di modifiche)
## ═══════════════════════════════════════════════════

# Crea backup del database
ssh meeq@172.16.0.10 "cd ~/meeq && cp chat.db chat.db.backup-\$(date +%Y%m%d-%H%M%S)"

# Verifica backup
ssh meeq@172.16.0.10 "ls -lh ~/meeq/*.db"


## ═══════════════════════════════════════════════════
## COMANDI UTILI
## ═══════════════════════════════════════════════════

# Riavvio server
ssh meeq@172.16.0.10 "sudo systemctl restart meeq"

# Stop server
ssh meeq@172.16.0.10 "sudo systemctl stop meeq"

# Start server
ssh meeq@172.16.0.10 "sudo systemctl start meeq"

# Vedi configurazione server
ssh meeq@172.16.0.10 "cat ~/meeq/server.js | grep -A 5 'const PORT'"

# Vedi dimensione database
ssh meeq@172.16.0.10 "du -h ~/meeq/chat.db"

# Ottimizza database (VACUUM)
ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db 'VACUUM;'"


## ═══════════════════════════════════════════════════
## TROUBLESHOOTING
## ═══════════════════════════════════════════════════

# Se il server non parte, controlla errori
ssh meeq@172.16.0.10 "sudo journalctl -u meeq -n 100 --no-pager | tail -50"

# Verifica porte in ascolto
ssh meeq@172.16.0.10 "sudo netstat -tulpn | grep 3000"

# Verifica processo Node
ssh meeq@172.16.0.10 "ps aux | grep node"

# Test connessione al server
curl http://172.16.0.10:3000

# Test endpoint API specifico
curl http://172.16.0.10:3000/api/tables/active


## ═══════════════════════════════════════════════════
## PULIZIA COMPLETA (ATTENZIONE!)
## ═══════════════════════════════════════════════════

# ATTENZIONE: Questi comandi cancellano TUTTI i dati!
# Usa solo se vuoi ricominciare da zero

# Cancella tutto dal database
ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db 'DELETE FROM messages; DELETE FROM conversations; DELETE FROM blocked_users; DELETE FROM reports; UPDATE users SET logged_in = 0, tavolo = NULL;'"

# Oppure, elimina completamente il database e ricrealo
ssh meeq@172.16.0.10 "cd ~/meeq && rm chat.db && sudo systemctl restart meeq"
# Il server ricreerà automaticamente il database con tutte le tabelle


## ═══════════════════════════════════════════════════
## QUERY UTILI PER DEBUG
## ═══════════════════════════════════════════════════

# Conta messaggi per conversazione
ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db 'SELECT conversation_id, COUNT(*) as msg_count FROM messages GROUP BY conversation_id;'"

# Vedi ultimi 5 log eventi importanti
ssh meeq@172.16.0.10 "sudo journalctl -u meeq -n 200 --no-pager | grep -E '(Conversazione|Blocco|PIN|Messaggio)' | tail -20"

# Statistiche rapide
ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db 'SELECT 
  (SELECT COUNT(*) FROM users) as tot_users,
  (SELECT COUNT(*) FROM users WHERE logged_in=1) as online_users,
  (SELECT COUNT(*) FROM conversations) as tot_conversations,
  (SELECT COUNT(*) FROM messages) as tot_messages,
  (SELECT COUNT(*) FROM blocked_users) as tot_blocks;'"
