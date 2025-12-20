# Setup Server Centrale Meeq

## Panoramica

Il sistema Meeq ora utilizza un'architettura centralizzata:
- **Server Centrale**: Gestisce tutti gli utenti registrati, dashboard admin, segnalazioni
- **Server Locali**: Gestiscono chat, tavoli, conversazioni per ogni locale

## Installazione Server Centrale

### 1. Installazione Dipendenze

```bash
cd /home/meeq/meeq
npm install
```

### 2. Configurazione

Modifica le variabili d'ambiente in `central-server.js` o usa variabili d'ambiente:

```bash
export PORT=3001
export JWT_SECRET="your-secret-key"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="your-password"
```

### 3. Avvio Server Centrale

```bash
node central-server.js
```

Oppure crea un servizio systemd:

```bash
sudo nano /etc/systemd/system/meeq-central.service
```

```ini
[Unit]
Description=Meeq Central Server
After=network.target

[Service]
Type=simple
User=meeq
WorkingDirectory=/home/meeq/meeq
Environment="PORT=3001"
Environment="JWT_SECRET=your-secret-key"
Environment="ADMIN_USERNAME=admin"
Environment="ADMIN_PASSWORD=your-password"
ExecStart=/usr/bin/node /home/meeq/meeq/central-server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable meeq-central
sudo systemctl start meeq-central
```

### 4. Accesso Dashboard Admin

Apri il browser e vai a:
```
http://your-server-ip:3001/central-admin.html
```

Login con:
- Username: `admin` (o quello configurato)
- Password: `meeq2024` (o quella configurata)

### 5. Creazione Locale e API Key

1. Accedi alla dashboard admin
2. Vai alla tab "Locali"
3. Clicca "Nuovo Locale"
4. Inserisci nome e email contatto
5. **COPIA L'API KEY GENERATA** - ti servirà per configurare i server locali

## Configurazione Server Locali

### 1. Modifica server.js

Aggiungi all'inizio del file (dopo le costanti):

```javascript
// Configurazione Server Centrale
const CENTRAL_SERVER_URL = process.env.CENTRAL_SERVER_URL || 'https://your-central-server.com';
const VENUE_API_KEY = process.env.VENUE_API_KEY || 'your-api-key-here';
const USE_CENTRAL_SERVER = process.env.USE_CENTRAL_SERVER !== 'false'; // Default: true
```

Oppure usa variabili d'ambiente:

```bash
export CENTRAL_SERVER_URL="https://your-central-server.com"
export VENUE_API_KEY="your-api-key-here"
export USE_CENTRAL_SERVER="true"
```

### 2. Riavvia Server Locale

```bash
sudo systemctl restart meeq
```

## Funzionalità

### Server Centrale

- ✅ Registrazione e autenticazione utenti centralizzata
- ✅ Dashboard admin per gestione utenti, segnalazioni, locali
- ✅ Invio email agli utenti segnalati
- ✅ Gestione API Key per ogni locale
- ✅ Token JWT con refresh token (30 giorni access, 90 giorni refresh)

### Server Locali

- ✅ Verifica utenti contro server centrale
- ✅ Cache locale utenti (sincronizzazione giornaliera)
- ✅ Fallback locale se server centrale offline
- ✅ Gestione chat, tavoli, conversazioni locali
- ✅ Segnalazioni inviate al server centrale

### Frontend (PWA)

- ✅ Salvataggio credenziali in localStorage
- ✅ Login automatico se credenziali presenti
- ✅ Gestione cambio locale (logout automatico)
- ✅ Gestione cambio tavolo (senza logout)
- ✅ Banner installazione PWA "Salva in home"

## Flusso Utente

### Prima Volta

1. Utente scansiona QR code → ottiene `tableNumber`
2. Inserisce email
3. Se email non esiste → registrazione (nome, cognome, gender)
4. Server centrale genera PIN → invia email
5. Utente inserisce PIN
6. Server centrale verifica → crea utente → genera JWT
7. PWA salva credenziali (token, email, dati utente, venue ID)
8. Login automatico → assegna tavolo → entra in chat

### Volte Successive (Stesso Locale)

1. Utente scansiona QR code → ottiene `tableNumber`
2. PWA verifica credenziali salvate
3. Se token valido → login automatico → assegna tavolo → entra in chat
4. Se token scaduto → richiede nuovo PIN → verifica → aggiorna credenziali

### Cambio Locale

1. Utente scansiona QR code da locale diverso
2. PWA rileva cambio venue ID
3. Logout automatico → richiede nuovo login
4. Nuovo login → assegna tavolo → entra in chat

### Cambio Tavolo (Stesso Locale)

1. Utente scansiona QR code con tavolo diverso
2. PWA rileva stesso venue ID
3. Cambio tavolo senza logout → assegna nuovo tavolo → ricarica conversazioni

## Troubleshooting

### Server Centrale Non Raggiungibile

Il server locale usa automaticamente il fallback locale:
- Utenti in cache locale possono ancora accedere
- Nuove registrazioni vengono salvate localmente
- Quando il server centrale torna online, le registrazioni vengono sincronizzate

### API Key Non Valida

Verifica:
1. API Key corretta nel file `server.js` o variabile d'ambiente
2. Locale attivo nella dashboard admin
3. Header `X-API-Key` inviato correttamente

### Token Scaduto

Il frontend gestisce automaticamente:
- Se access token scaduto, usa refresh token
- Se anche refresh token scaduto, richiede nuovo PIN

## Sicurezza

- ✅ HTTPS consigliato per server centrale (JWT e API Key)
- ✅ Token JWT con scadenza (30 giorni)
- ✅ Refresh token con scadenza (90 giorni)
- ✅ API Key per autenticazione server locale → centrale
- ✅ Logout automatico dopo 10 minuti inattività
- ✅ Logout automatico su cambio locale

## Note

- Il database centrale (`central.db`) contiene tutti gli utenti registrati
- I database locali (`chat.db`) contengono solo cache utenti e dati locali (chat, tavoli)
- La sincronizzazione utenti avviene automaticamente ogni giorno alle 3:00 AM
- Le segnalazioni vengono inviate sia al server centrale che salvate localmente

