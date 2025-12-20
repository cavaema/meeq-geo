# Contesto Progetto MEEQ

## 1. Descrizione

**MEEQ** è un'applicazione web di incontri anonimi progettata per locali pubblici (bar, ristoranti, pub). L'app permette agli utenti di:

- **Registrarsi** tramite email e PIN inviato via email
- **Scegliere un tavolo** nel locale tramite QR code o selezione manuale
- **Chattare in modo anonimo** con altri utenti presenti nel locale
- **Rivelare progressivamente** la propria identità (prima il tavolo, poi il nome)
- **Ricevere notifiche push** per nuovi messaggi
- **Segnalare** utenti inappropriati

L'app è installabile come **PWA (Progressive Web App)** e funziona completamente offline quando connessa al server locale del locale.

## 2. Setup e Configurazione

### Stack Tecnologico

- **Backend**: Node.js + Express.js
- **Database**: SQLite3
- **Frontend**: HTML5, CSS3, JavaScript vanilla (no framework)
- **Autenticazione**: JWT (JSON Web Tokens)
- **Email**: Nodemailer (SMTP)
- **Notifiche Push**: Web Push API + web-push library
- **Scheduling**: node-schedule (per backup e reset automatici)

### Dipendenze Principali

```json
{
  "express": "^5.1.0",
  "sqlite3": "^5.1.7",
  "jsonwebtoken": "^9.0.2",
  "nodemailer": "^7.0.9",
  "web-push": "^3.6.7",
  "node-schedule": "^2.1.1",
  "cors": "^2.8.5",
  "ws": "^8.18.3"
}
```

### Variabili d'Ambiente

#### Server Locale (`server.js`)

- `PORT`: Porta del server locale (default: 3000)
- `JWT_SECRET`: Chiave segreta per JWT (default: 'meeq-secret-key-2024-super-secure')
- `CENTRAL_SERVER_URL`: URL del server centrale (default: 'http://128.140.84.82:3001')
- `VENUE_API_KEY`: API Key del locale per autenticazione con server centrale
- `USE_CENTRAL_SERVER`: Abilita/disabilita integrazione server centrale (default: true)
- `VAPID_PUBLIC_KEY`: Chiave pubblica VAPID per notifiche push
- `VAPID_PRIVATE_KEY`: Chiave privata VAPID per notifiche push

#### Server Centrale (`central-server.js`)

- `PORT`: Porta del server centrale (default: 3001, attualmente 3002)
- `JWT_SECRET`: Chiave segreta per JWT centrale
- `ADMIN_USERNAME`: Username admin dashboard (default: 'admin')
- `ADMIN_PASSWORD`: Password admin dashboard
- `EMAIL_HOST`: Host SMTP per invio email
- `EMAIL_USER`: Username SMTP
- `EMAIL_PASS`: Password SMTP

### Come Avviare l'Applicazione

#### Server Locale (Raspberry Pi)

```bash
# Installazione dipendenze
cd /home/meeq/meeq
npm install

# Avvio manuale
node server.js

# Oppure tramite systemd
sudo systemctl start meeq
sudo systemctl enable meeq
```

#### Server Centrale (VPS)

```bash
# Installazione dipendenze
cd /opt/meeq-central
npm install

# Avvio manuale
node central-server.js

# Oppure tramite systemd
sudo systemctl start meeq-central
sudo systemctl enable meeq-central
```

## 3. Architettura

### Struttura Cartelle

```
/home/meeq/meeq/
├── server.js                 # Server locale (Raspberry)
├── central-server.js         # Server centrale (VPS)
├── package.json             # Dipendenze Node.js
├── chat.db                  # Database SQLite locale
├── public/                   # Frontend
│   ├── index.html           # App principale utenti
│   ├── admin.html           # Dashboard admin locale
│   ├── central-admin.html   # Dashboard admin centrale
│   ├── manifest.json        # PWA manifest
│   ├── sw.js                # Service Worker
│   └── icons/               # Icone PWA
├── backups/                 # Backup automatici database
└── scripts/                 # Script di utilità
    ├── migrate-users-to-central.js
    ├── migrate-users-direct.js
    ├── delete-users-central.js
    └── check-users-central.js
```

### Architettura Sistema

Il sistema utilizza un'**architettura distribuita**:

1. **Server Centrale** (VPS):
   - Gestisce registrazione e autenticazione utenti globali
   - Dashboard admin centrale per gestione utenti, segnalazioni, locali
   - Genera API Keys per ogni locale
   - Database centrale (`central.db`) con utenti, locali, segnalazioni

2. **Server Locale** (Raspberry Pi per ogni locale):
   - Gestisce chat, conversazioni, tavoli
   - Cache locale degli utenti sincronizzata con server centrale
   - Database locale (`chat.db`) con conversazioni, messaggi, tavoli
   - Funziona anche offline (fallback locale se server centrale non disponibile)

### Componenti Principali

#### Backend (`server.js`)

- **API Endpoints**:
  - `/api/check-email`: Verifica se email esiste
  - `/api/register`: Registrazione nuovo utente
  - `/api/verify-pin`: Verifica PIN e login
  - `/api/select-table`: Assegnazione tavolo
  - `/api/conversations`: Lista conversazioni
  - `/api/conversations/:id/messages`: Messaggi conversazione
  - `/api/conversations/:id/send`: Invia messaggio
  - `/api/conversations/:id/reveal-table`: Rivela tavolo
  - `/api/conversations/:id/reveal-name`: Rivela nome
  - `/api/conversations/:id/report`: Segnala utente
  - `/api/logout`: Logout utente
  - `/api/auto-login`: Login automatico con token centrale
  - `/push/subscribe`: Registra subscription push
  - `/push/unsubscribe`: Rimuovi subscription push
  - `/admin/*`: Endpoints admin locale

- **Database Schema Locale**:
  - `users`: Utenti con cache locale (`central_user_id`, `synced_at`)
  - `conversations`: Conversazioni tra utenti (`initiator_id`)
  - `messages`: Messaggi chat
  - `tables`: Tavoli disponibili
  - `reports`: Segnalazioni locali
  - `pending_registrations`: Registrazioni in attesa (fallback locale)
  - `push_subscriptions`: Subscription per notifiche push

#### Backend Centrale (`central-server.js`)

- **API Endpoints**:
  - `/api/central/check-email`: Verifica email
  - `/api/central/register`: Registrazione utente
  - `/api/central/request-pin`: Richiesta PIN
  - `/api/central/verify-pin`: Verifica PIN e login
  - `/api/central/verify-token`: Verifica token JWT
  - `/api/central/refresh-token`: Refresh token
  - `/api/central/admin/*`: Endpoints admin centrale
    - `/login`: Login admin
    - `/users`: Lista utenti
    - `/users/create`: Crea utente (per migrazione)
    - `/users/:id/block`: Blocca/sblocca utente
    - `/users/:id`: DELETE - Elimina utente
    - `/reports`: Lista segnalazioni
    - `/venues`: Gestione locali
    - `/stats`: Statistiche

- **Database Schema Centrale**:
  - `users`: Utenti globali
  - `pending_registrations`: Registrazioni in attesa
  - `venues`: Locali con API Keys
  - `reports`: Segnalazioni globali
  - `refresh_tokens`: Refresh tokens JWT

#### Frontend (`public/index.html`)

- **Screens**:
  - Email check: Verifica email esistente
  - PIN entry: Inserimento PIN
  - Table selection: Scelta tavolo
  - Conversations: Lista conversazioni
  - Chat: Chat con utente anonimo
  - Profile: Profilo utente

- **Funzionalità**:
  - Polling automatico per messaggi, badge, tavoli attivi
  - Gestione errori con retry e exponential backoff
  - Login automatico con token centrale salvato
  - PWA installabile con banner "Save to Home"
  - Notifiche push per nuovi messaggi
  - Gestione sessione con localStorage/sessionStorage
  - Rilevamento cambio locale (logout automatico)

## 4. Lavoro Svolto

### Fase 1: Sistema Base
- Implementazione sistema di registrazione con email e PIN
- Creazione database SQLite con tabelle utenti, conversazioni, messaggi
- Sistema di autenticazione JWT
- Frontend base con schermate email, PIN, selezione tavolo
- Sistema di chat anonima tra utenti

### Fase 2: Funzionalità Avanzate
- **MOD 1**: Aggiunta selezione gender con badge colorati
- **MOD 2**: Campo `distinctive_sign` opzionale per identificazione
- **MOD 3**: Messaggi visibili prima dell'accettazione conversazione
- **MOD 4**: Separazione rivelazione tavolo/nome (due step distinti)
- **MOD 5**: Sistema segnalazione utenti con motivo opzionale
- **MOD 6**: Backup automatico database (30 giorni retention)
- **MOD 7**: Reset giornaliero automatico alle 4 AM

### Fase 3: Error Handling e Polling
- Implementazione parametro `silent` per polling (evita alert per errori temporanei)
- Gestione errori autenticazione con `isAuthError()` e `handleAuthError()`
- Retry logic con exponential backoff in `apiCall()`
- Fix badge nuovo messaggio per primo messaggio (problema timing database)
- Fix logout con chiamata backend `/api/logout`
- Fix admin panel con aggiornamento stato utenti in tempo reale

### Fase 4: PWA e Notifiche Push
- Creazione `manifest.json` per installabilità PWA
- Implementazione Service Worker (`sw.js`) per funzionamento offline
- Sistema notifiche push con VAPID keys
- Banner "Save to Home" per installazione PWA
- Registrazione push subscription e invio notifiche
- Gestione permessi notifiche browser

### Fase 5: Architettura Centralizzata
- Creazione server centrale (`central-server.js`) per gestione utenti globali
- Implementazione API Key authentication per locali
- Sincronizzazione utenti locali con server centrale
- Dashboard admin centrale (`central-admin.html`) con React
- Migrazione utenti esistenti al server centrale
- Login automatico con token centrale salvato
- Endpoint `/api/auto-login` per ripristino sessione

### Fase 6: Deployment e Setup VPS
- Script di setup server centrale su VPS
- Configurazione systemd service per server centrale
- Configurazione Nginx reverse proxy
- Script di migrazione utenti
- Script di diagnostica e troubleshooting
- Fix problemi porta 3001 occupata da docker-proxy (spostato a 3002)

## 5. Problemi Risolti

### Badge Nuovo Messaggio
**Problema**: Il badge non appariva al primo messaggio, solo sui successivi.

**Causa**: Timing issue - il database non aveva ancora aggiornato `messageCount` quando il frontend faceva polling.

**Soluzione**: 
- Aggiunto delay e retry mechanism in `updateBadge()`
- Aggiunta colonna `initiator_id` in `conversations` per identificare correttamente il destinatario
- Fix logica `isReceiver` per gestire correttamente il primo messaggio

### Logout e Stato Utenti
**Problema**: Admin panel non aggiornava quando utenti facevano logout, e richiedeva re-login ad ogni refresh.

**Soluzione**:
- Modificato `logout()` per chiamare endpoint `/api/logout` che aggiorna `logged_in = 0` e `tavolo = NULL`
- Aggiunto `localStorage` per persistenza token admin
- Fix query admin per usare `is_online` basato su `last_activity`
- Aggiunto delay prima di `location.reload()` per permettere completamento chiamata API

### Server Centrale VPS
**Problema**: Service systemd si riavviava continuamente, processo Node.js usciva immediatamente.

**Causa**: 
1. Promise in `initDatabase()` risolta troppo presto
2. Mancanza di graceful shutdown handlers
3. Syntax error (parentesi mancante)

**Soluzione**:
- Corretto `initDatabase()` per risolvere Promise solo dopo completamento inizializzazione
- Aggiunti handlers `SIGINT` e `SIGTERM` per graceful shutdown
- Fix syntax error
- Cambiato porta da 3001 a 3002 per evitare conflitto con docker-proxy

### Utenti Non Visibili Dashboard
**Problema**: Utenti migrati non comparivano nella dashboard centrale.

**Causa**: Script di migrazione chiamava `/api/central/register` che crea solo pending registration, non l'utente effettivo.

**Soluzione**:
- Creato endpoint admin `/api/central/admin/users/create` per creare utenti direttamente
- Creato script `migrate-users-direct.js` per migrazione diretta nel database
- Script `check-users-central.js` per verifica utenti

### Login Automatico
**Problema**: Dopo logout, richiedeva reinserimento email e PIN.

**Soluzione**:
- Implementato endpoint `/api/auto-login` nel server locale
- Aggiunta logica in `init()` per verificare token centrale salvato
- Se token valido, login automatico senza richiedere credenziali
- Salvataggio `centralToken`, `refreshToken`, `centralUserId` in localStorage

## 6. To-Do / Work in Progress

### In Corso
- [ ] Test completo migrazione utenti su produzione
- [ ] Verifica sincronizzazione `central_user_id` dopo login
- [ ] Aggiunta pulsante cancellazione utenti in dashboard admin centrale

### Da Fare
- [ ] Implementare refresh token automatico quando scade
- [ ] Aggiungere statistiche avanzate nella dashboard admin
- [ ] Implementare sistema di notifiche email per segnalazioni
- [ ] Aggiungere export dati utenti (GDPR compliance)
- [ ] Implementare rate limiting per API
- [ ] Aggiungere logging strutturato (Winston o simile)
- [ ] Implementare test automatici
- [ ] Documentazione API completa (Swagger/OpenAPI)
- [ ] Sistema di backup automatico anche per server centrale
- [ ] Monitoraggio e alerting (es. Uptime Robot)

### Miglioramenti Futuri
- [ ] Supporto multi-lingua
- [ ] Dark mode
- [ ] Filtri ricerca conversazioni
- [ ] Notifiche in-app oltre a push
- [ ] Sistema di moderazione automatica
- [ ] Analytics avanzati per locali

## 7. Note Importanti

### Configurazioni Specifiche

1. **Email SMTP**: Configurato con `authsmtp.securemail.pro` (porta 587, TLS)
   - User: `info@meeq.it`
   - Password: `Flw25mq!`

2. **VAPID Keys**: Generate con `node generate-vapid-keys.js`
   - Public: `BFEBC0Geojr89LuTpo-bym8XOP2Pkzo7FEgAp6H6qa-QGtLSWNAJ6WTtnvbtAT2QQip_FmpBy2p1AB6Ih4tlS64`
   - Private: `q4ACxacYopkNX91Ag8gje5Fbc1hk6SB-TxzisvGThwg`
   - Subject: `mailto:info@meeq.it`

3. **Porte**:
   - Server locale: `3000`
   - Server centrale: `3002` (originariamente 3001, cambiato per conflitto docker-proxy)

4. **Credenziali Admin**:
   - Locale: `admin` / `meeq2024`
   - Centrale: Configurabile via variabili d'ambiente

### Gotchas da Ricordare

1. **Database Migration**: Quando si aggiungono colonne, il codice gestisce automaticamente la migrazione, ma è sempre meglio fare backup prima.

2. **Central User ID**: Dopo migrazione utenti, devono fare login una volta per sincronizzare `central_user_id` nel database locale.

3. **Token Centrali**: I token centrali sono salvati in `localStorage` e vengono usati per login automatico. Se cambia il locale (venue), viene fatto logout automatico.

4. **Polling**: Il frontend fa polling continuo per messaggi, badge, tavoli. In caso di errori temporanei, usa `silent: true` per evitare alert all'utente.

5. **Service Worker**: Il service worker funziona solo su HTTPS o localhost. Per produzione, serve certificato SSL.

6. **Backup Automatico**: I backup vengono creati automaticamente ogni giorno alle 4 AM e mantenuti per 30 giorni nella cartella `backups/`.

7. **Reset Giornaliero**: Alle 4 AM viene fatto reset automatico di conversazioni e messaggi (ma non utenti).

### Decisioni Architetturali Importanti

1. **Architettura Distribuita**: Scelta per permettere scalabilità e gestione centralizzata utenti, mantenendo chat locale per performance.

2. **Fallback Locale**: Il server locale può funzionare anche se il server centrale è offline, usando cache locale degli utenti.

3. **PWA Offline-First**: L'app è progettata per funzionare offline quando connessa al server locale, senza dipendere da internet.

4. **JWT Dual-Token**: Sistema con access token (48h) e refresh token per sicurezza e UX.

5. **Polling vs WebSocket**: Scelto polling per semplicità, ma il codice supporta WebSocket (libreria `ws` installata) per future implementazioni.

6. **SQLite**: Scelto per semplicità e portabilità, ma potrebbe essere sostituito con PostgreSQL per scalabilità futura.

### File di Configurazione Importanti

- `server.js`: Server locale principale
- `central-server.js`: Server centrale
- `public/index.html`: Frontend app utenti
- `public/admin.html`: Dashboard admin locale
- `public/central-admin.html`: Dashboard admin centrale
- `public/manifest.json`: Configurazione PWA
- `public/sw.js`: Service Worker
- `meeq.service`: Systemd service locale
- `/etc/systemd/system/meeq-central.service`: Systemd service centrale

### Script Utilità

- `migrate-users-to-central.js`: Migrazione utenti via API
- `migrate-users-direct.js`: Migrazione diretta nel database
- `delete-users-central.js`: Cancellazione utenti interattiva
- `check-users-central.js`: Verifica utenti nel database centrale
- `generate-vapid-keys.js`: Genera chiavi VAPID per push notifications

