# Contesto Progetto MEEQ - Aggiornato Dicembre 2024

## 1. Panoramica

**MEEQ** è un'applicazione web di incontri anonimi per locali pubblici (bar, ristoranti, pub) con architettura distribuita:
- **Server Centrale (VPS)**: Gestione utenti globali, autenticazione, dashboard admin
- **Server Locale (Raspberry Pi)**: Chat, conversazioni, tavoli per ogni locale
- **PWA Centrale**: App web installabile accessibile da `https://app.meeq.it`

## 2. Architettura e Deployment

### Server Centrale (VPS Hetzner)
- **IP**: `128.140.84.82`
- **Dominio**: `app.meeq.it` (servito via Nginx + SSL Let's Encrypt)
- **Path**: `/opt/meeq-central`
- **Porta**: `3002` (Node.js), `443` (Nginx HTTPS)
- **Service**: `meeq-central` (systemd)
- **Repository Git**: `https://github.com/cavaema/meeq-central.git`
- **Database**: `/opt/meeq-central/central.db` (SQLite)

### Server Locale (Raspberry Pi)
- **IP Locale**: `172.16.0.10`
- **Dominio API**: `locale-01-api.meeq.it` (via Cloudflare Tunnel)
- **Path**: `/home/meeq/meeq`
- **Porta**: `3000` (Node.js)
- **Service**: `meeq` (systemd)
- **Repository Git**: `https://github.com/cavaema/meeq-local.git`
- **Database**: `/home/meeq/meeq/chat.db` (SQLite)

### PWA Centrale
- **URL**: `https://app.meeq.it`
- **File**: `public/app.html` (sul server centrale)
- **Funzionalità**:
  - Risoluzione automatica del locale tramite IP pubblico o parametro URL
  - Login/registrazione con server centrale
  - Comunicazione con server locale via Cloudflare Tunnel
  - QR code scanner per selezione tavolo
  - Installabile come PWA

## 3. Configurazione Git e Workflow Sviluppo

### Repository Git
- **meeq-local**: Server locale (Raspberry Pi) - `https://github.com/cavaema/meeq-local.git`
- **meeq-central**: Server centrale (VPS) - `https://github.com/cavaema/meeq-central.git`

### Autenticazione SSH
- **Raspberry Pi**: Chiave SSH `~/.ssh/id_ed25519` aggiunta a GitHub come "Raspberry Pi Meeq"
- **VPS**: Chiave SSH `~/.ssh/id_ed25519` aggiunta a GitHub come "VPS Meeq Central"
- **Username GitHub**: `cavaema`
- **Tutti i remote usano URL SSH**: `git@github.com:cavaema/meeq-*.git`

### Workspace Cursor
- **File**: `meeq-git.code-workspace` (nella cartella principale del PC)
- **Struttura**:
  ```
  meeq/
  ├── meeq-local/          # Clonato da GitHub
  ├── meeq-central/        # Clonato da GitHub
  └── meeq-git.code-workspace
  ```
- **Path PC**: `G:\Il mio Drive\JOB\PROGETTI\meeq\`

### Workflow Sviluppo

1. **Sviluppo sul PC**:
   ```powershell
   cd "G:\Il mio Drive\JOB\PROGETTI\meeq\meeq-local"
   # Modifica file
   git add .
   git commit -m "Descrizione modifiche"
   git push
   ```

2. **Sincronizzazione sui server** (opzionale):
   ```powershell
   # Usa sync-to-servers.ps1 per push automatico + pull sui server
   .\sync-to-servers.ps1
   ```
   
   Oppure manualmente:
   ```bash
   # Sul Raspberry Pi o VPS
   git pull
   sudo systemctl restart meeq  # o meeq-central
   ```

3. **Sviluppo diretto sui server**:
   ```bash
   # Modifica file
   git add .
   git commit -m "Descrizione modifiche"
   git push
   # Sul PC: git pull
   ```

## 4. Stack Tecnologico

### Backend
- **Node.js** + **Express.js**
- **SQLite3** (database)
- **JWT** (autenticazione)
- **Nodemailer** (email SMTP)
- **web-push** (notifiche push)
- **node-schedule** (backup e reset automatici)
- **CORS** (cross-origin requests)

### Frontend
- **HTML5, CSS3, JavaScript vanilla** (no framework)
- **PWA** (Progressive Web App)
- **Service Worker** (`sw.js`)
- **Web Push API**
- **BarcodeDetector API** (scansione QR code)

### Infrastruttura
- **Nginx** (reverse proxy + SSL)
- **Let's Encrypt** (certificati SSL)
- **Cloudflare** (DNS + Tunnel)
- **Systemd** (servizi)
- **Git** (version control)

## 5. Configurazione Domini e DNS

### Domini Cloudflare
- **app.meeq.it**: PWA centrale → `128.140.84.82` (A record)
- **locale-01-api.meeq.it**: API server locale → Cloudflare Tunnel

### DNS (Register.it → Cloudflare)
- **Nameservers Cloudflare**:
  - `armfazh.ns.cloudflare.com` (IPv4: `162.159.44.104`)
  - `melissa.ns.cloudflare.com` (IPv4: `108.162.192.199`)

### Cloudflare Tunnel
- **Tunnel ID**: `5dcd0ce7-7b84-438e-b297-ee0c9f8eb90c`
- **Configurazione**: `/etc/cloudflared/config.yml`
- **Endpoint**: `locale-01-api.meeq.it` → `localhost:3000` (Raspberry Pi)

## 6. Variabili d'Ambiente

### Server Locale (`/etc/meeq/meeq.env`)
```bash
PORT=3000
JWT_SECRET=meeq-secret-key-2024-super-secure
CENTRAL_SERVER_URL=https://app.meeq.it
VENUE_API_KEY=4b0576016c331735fe476b0d65dec919e627aa503651c6517e6e6d16d72c6400
USE_CENTRAL_SERVER=true
VAPID_PUBLIC_KEY=BFEBC0Geojr89LuTpo-bym8XOP2Pkzo7FEgAp6H6qa-QGtLSWNAJ6WTtnvbtAT2QQip_FmpBy2p1AB6Ih4tlS64
VAPID_PRIVATE_KEY=q4ACxacYopkNX91Ag8gje5Fbc1hk6SB-TxzisvGThwg
```

### Server Centrale (`/opt/meeq-central/.env`)
```bash
PORT=3002
JWT_SECRET=<generato>
JWT_REFRESH_SECRET=<generato>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<configurato>
EMAIL_HOST=authsmtp.securemail.pro
EMAIL_USER=info@meeq.it
EMAIL_PASS=Flw25mq!
NODE_ENV=production
```

## 7. File Principali

### Server Locale
- `server.js`: Server principale
- `public/index.html`: App utenti locale (deprecata, usa app.html centrale)
- `public/app.html`: PWA centrale (sul server centrale)
- `public/admin.html`: Dashboard admin locale
- `public/manifest.json`: PWA manifest
- `public/sw.js`: Service Worker
- `chat.db`: Database SQLite locale

### Server Centrale
- `central-server.js`: Server centrale
- `public/app.html`: PWA centrale principale
- `public/central-admin.html`: Dashboard admin centrale
- `central.db`: Database SQLite centrale

## 8. API Endpoints Principali

### Server Centrale (`https://app.meeq.it`)
- `GET /`: Serve `app.html`
- `POST /api/central/check-email`: Verifica email
- `POST /api/central/register`: Registrazione utente
- `POST /api/central/request-pin`: Richiesta PIN
- `POST /api/central/verify-pin`: Verifica PIN e login
- `GET /api/central/resolve-venue`: Risolve locale da IP o parametro
- `POST /api/central/venues/heartbeat`: Aggiorna IP pubblico locale
- `POST /api/central/refresh-token`: Refresh token JWT
- `GET /api/central/admin/*`: Endpoints admin

### Server Locale (`locale-01-api.meeq.it` o IP locale)
- `POST /api/auto-login`: Login automatico con token centrale
- `GET /api/conversations`: Lista conversazioni
- `GET /api/conversations/:id/messages`: Messaggi conversazione
- `POST /api/conversations/:id/send`: Invia messaggio
- `POST /api/conversations/:id/reveal-table`: Rivela tavolo
- `POST /api/conversations/:id/reveal-name`: Rivela nome
- `POST /api/conversations/:id/report`: Segnala utente
- `POST /api/logout`: Logout
- `POST /push/subscribe`: Registra push subscription

## 9. Database Schema

### Database Locale (`chat.db`)
- `users`: Utenti con `central_user_id`, `synced_at`
- `conversations`: Conversazioni con `initiator_id`
- `messages`: Messaggi chat
- `tables`: Tavoli disponibili
- `reports`: Segnalazioni locali
- `push_subscriptions`: Subscription push

### Database Centrale (`central.db`)
- `users`: Utenti globali
- `pending_registrations`: Registrazioni in attesa
- `venues`: Locali con API keys e `last_public_ip`
- `reports`: Segnalazioni globali
- `refresh_tokens`: Refresh tokens JWT

## 10. Flusso Utente PWA Centrale

1. **Accesso**: Utente apre `https://app.meeq.it` o scansiona QR code `https://app.meeq.it?tavolo=X`
2. **Risoluzione Locale**: PWA chiama `/api/central/resolve-venue` per identificare il locale
3. **Login/Registrazione**:
   - Se nuovo utente: registrazione → PIN via email → verifica PIN
   - Se utente esistente: verifica token salvato → auto-login
4. **Auto-login Locale**: PWA chiama `/api/auto-login` sul server locale con token centrale
5. **Assegnazione Tavolo**: Tavolo assegnato automaticamente da QR code o selezione manuale
6. **Chat**: Utente può chattare con altri utenti nel locale

## 11. Configurazione SSH

### PC → Raspberry Pi
- **Host**: `meeq-pi` (alias in `C:\Users\ec\.ssh\config`)
- **IP**: `172.16.0.10`
- **User**: `meeq`
- **Key**: `C:\Users\ec\.ssh\id_raspberry`

### PC → VPS
- **Host**: `meeq-vps` (alias in `C:\Users\ec\.ssh\config`)
- **IP**: `128.140.84.82`
- **User**: `root`
- **Key**: `C:\Users\ec\.ssh\id_ed25519`

### Raspberry Pi → VPS
- **IP**: `128.140.84.82`
- **User**: `root`
- **Key**: `~/.ssh/id_rsa_meeq_vps` (generata sul Raspberry Pi)

## 12. Script Utilità

### Git
- `setup-git-ssh.sh`: Genera chiave SSH per Git
- `push-to-git.sh`: Push repository locale
- `push-to-git-central.sh`: Push repository centrale
- `sync-to-servers.ps1`: Sincronizza modifiche PC → server

### Setup
- `init-git-local.sh`: Inizializza Git sul Raspberry Pi
- `init-git-central.sh`: Inizializza Git sul VPS
- `setup-central-server.sh`: Setup server centrale
- `setup-cloudflare-tunnel.sh`: Setup Cloudflare Tunnel

### Diagnostica
- `test-ssh-connections.ps1`: Test connessioni SSH
- `vps-diagnostic.sh`: Diagnostica VPS
- `fix-vps-service.sh`: Fix servizio VPS

## 13. Note Importanti

### Heartbeat Locale
Il server locale invia periodicamente un heartbeat al server centrale con il suo IP pubblico:
- Endpoint: `POST /api/central/venues/heartbeat`
- Payload: `{ venueId, publicIp }`
- Il server centrale aggiorna `last_public_ip` nella tabella `venues`

### Risoluzione Venue
Quando un client accede alla PWA:
1. Il server centrale rileva l'IP pubblico del client (da header `cf-connecting-ip` o `x-forwarded-for`)
2. Cerca nella tabella `venues` un locale con `last_public_ip` corrispondente
3. Restituisce `apiBaseUrl` del locale (es. `https://locale-01-api.meeq.it`)

### QR Code
I QR code generati dall'admin locale puntano a:
- `https://app.meeq.it?tavolo=X` (non più all'IP locale)

### CORS
- Server locale: Permette `https://app.meeq.it`
- Server centrale: Permette tutti gli origin (configurabile)

## 14. Troubleshooting Comune

### "Failed to Fetch" durante PIN verification
- Verifica che `LOCAL_API_BASE_URL` sia impostato correttamente
- Verifica che il server locale sia raggiungibile
- Controlla i log del server locale

### "Non sei collegato alla WiFi del locale"
- Verifica che l'heartbeat del locale sia stato inviato
- Verifica che `last_public_ip` sia aggiornato nel database centrale
- Verifica che l'IP pubblico del client corrisponda

### Repository Git vuoti
- Verifica che il push iniziale sia stato fatto dai server
- Verifica che le chiavi SSH siano aggiunte a GitHub
- Testa connessione: `ssh -T git@github.com`

## 15. Prossimi Sviluppi

- [ ] Refresh token automatico quando scade
- [ ] Rate limiting per API
- [ ] Logging strutturato (Winston)
- [ ] Test automatici
- [ ] Documentazione API (Swagger)
- [ ] Monitoraggio e alerting
- [ ] Backup automatico server centrale
- [ ] Supporto multi-lingua
- [ ] Dark mode

---

**Ultimo aggiornamento**: Dicembre 2024  
**Versione**: 2.0 (Architettura Centralizzata + Git Workflow)

