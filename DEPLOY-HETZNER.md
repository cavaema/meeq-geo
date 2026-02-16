# Guida: Deploy MEEQ-GEO su Hetzner

Guida completa per configurare meeq-geo su un VPS Hetzner: creazione server, installazione, Nginx, SSL e integrazione con meeq-central.

---

## Parte 1: Creare il VPS su Hetzner

### 1.1 Accedi a Hetzner Cloud

1. Vai su [https://console.hetzner.cloud](https://console.hetzner.cloud)
2. Accedi con le tue credenziali
3. Seleziona il tuo progetto (o creane uno)

### 1.2 Crea un nuovo server

1. Clicca **"Add Server"** (Aggiungi Server)
2. **Location**: scegli il datacenter (es. Falkenstein, Nuremberg, Helsinki)
3. **Image**: **Ubuntu 22.04**
4. **Type**: 
   - **CX21** (2 vCPU, 4 GB RAM) – adatto per 1–2 locali
   - **CX31** (4 vCPU, 8 GB RAM) – per più locali e carico maggiore
5. **SSH Key**: aggiungi la tua chiave SSH (consigliato) oppure usa password
6. **Name**: es. `meeq-geo`
7. Clicca **"Create & Buy"**

### 1.3 Ottieni l’IP del server

Dopo la creazione, copia l’**IP pubblico** (es. `123.45.67.89`) dall’overview del server.

---

## Parte 2: Primo accesso e setup base

### 2.1 Connessione SSH

```bash
# Con chiave SSH
ssh root@123.45.67.89

# Con password (se non hai aggiunto la chiave)
ssh root@123.45.67.89
# Inserisci la password ricevuta via email
```

### 2.2 Aggiorna il sistema

```bash
apt update && apt upgrade -y
```

### 2.3 Crea un utente non-root (consigliato)

```bash
adduser meeq
usermod -aG sudo meeq
# Configura SSH per l'utente meeq
rsync --archive --chown=meeq:meeq ~/.ssh /home/meeq
```

Poi connettiti con `ssh meeq@123.45.67.89` e usa `sudo` per i comandi che lo richiedono.

### 2.4 Firewall

```bash
# UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (per Certbot)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## Parte 3: Installare Node.js

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verifica
node --version   # v20.x
npm --version
```

---

## Parte 4: Deploy tramite Git

### 4.1 Inizializza il repo (solo la prima volta, sul tuo PC)

Da `g:\Il mio Drive\JOB\PROGETTI\meeq\meeq-geo`:

```bash
cd meeq-geo

# Se non esiste ancora un repo
git init
git add .
git commit -m "Initial commit meeq-geo"

# Collega a GitHub (sostituisci con il tuo URL)
git remote add origin https://github.com/TUO-USER/meeq-geo.git

# Push
git branch -M main
git push -u origin main
```

`.env`, `node_modules`, `chat.db` e `backups/` sono nel `.gitignore` e non vengono pushati.

### 4.2 Crea il repository su GitHub

1. [github.com](https://github.com) → **New repository**
2. Nome: `meeq-geo`
3. Privato o pubblico a tua scelta
4. Non inizializzare con README (hai già il codice)
5. Copia l’URL del repo

### 4.3 Deploy sul VPS

**Manuale**:

```bash
sudo apt install -y git
cd /opt
sudo git clone https://github.com/TUO-USER/meeq-geo.git
cd meeq-geo
sudo npm install
```

**Automatico** (script incluso nel repo):

```bash
# Dopo git clone, nella cartella meeq-geo:
cd /opt/meeq-geo
sudo bash setup-vps.sh

# Con un altro repo (passa l’URL):
sudo GIT_REPO=https://github.com/TUO-USER/meeq-geo.git bash setup-vps.sh
```

### 4.4 Aggiornamenti futuri

**Sul PC** (dopo modifiche):

```bash
git add .
git commit -m "Descrizione modifiche"
git push
```

**Sul VPS**:

```bash
cd /opt/meeq-geo
sudo git pull
sudo npm install
sudo systemctl restart meeq-geo
```

---

## Parte 5: Configurazione `.env`

```bash
sudo cp /opt/meeq-geo/.env.example /opt/meeq-geo/.env
sudo nano /opt/meeq-geo/.env
```

Esempio di configurazione:

```env
# Porta interna (Nginx farà proxy sulla 80/443)
PORT=3000

# Venue (nome del tuo locale)
VENUE_NAME=Il mio Bar
VENUE_LOGO_URL=https://tuosito.it/logo.png
VENUE_MENU_URL=https://tuosito.it/menu.pdf

# Geolocalizzazione - coordinate del locale
# Ottienile da Google Maps: clic destro sul locale → "Cosa c'è qui?"
VENUE_LATITUDE=45.4642
VENUE_LONGITUDE=9.1900
VENUE_RADIUS_METERS=80

# Server centrale (per utenti/registrazione)
CENTRAL_SERVER_URL=https://app.meeq.it
VENUE_API_KEY=la-tua-api-key-dal-central-admin
USE_CENTRAL_SERVER=true

# Admin locale
ADMIN_USERNAME=admin
ADMIN_PASSWORD=CambiaQuestaPassword123!
```

**API Key**: generata dalla dashboard di meeq-central. Ogni venue ha la propria.

---

## Parte 6: Service systemd

```bash
sudo nano /etc/systemd/system/meeq-geo.service
```

Contenuto:

```ini
[Unit]
Description=MEEQ-GEO Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/meeq-geo
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/meeq-geo/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Attiva il servizio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable meeq-geo
sudo systemctl start meeq-geo
sudo systemctl status meeq-geo
```

---

## Parte 7: Nginx + SSL (Let's Encrypt)

### 7.1 Installa Nginx e Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 7.2 Configura il sito

Crea un file di configurazione (sostituisci `geo.meeq.it` con il tuo dominio):

```bash
sudo nano /etc/nginx/sites-available/meeq-geo
```

```nginx
server {
    listen 80;
    server_name geo.meeq.it;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Attiva il sito:

```bash
sudo ln -s /etc/nginx/sites-available/meeq-geo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7.3 DNS

Sul pannello DNS del tuo dominio (Hetzner DNS, Cloudflare, ecc.) aggiungi:

- **Tipo**: A  
- **Nome**: `geo` (o `@` per il dominio principale)  
- **Valore**: IP del VPS (es. `123.45.67.89`)  
- **TTL**: 300 o 3600  

### 7.4 Certificato SSL

```bash
sudo certbot --nginx -d geo.meeq.it
```

Segui le istruzioni (email, condizioni d’uso). Certbot aggiornerà la configurazione Nginx e abiliterà HTTPS.

### 7.5 Rinnovo automatico

```bash
sudo certbot renew --dry-run
```

Se tutto ok, i rinnovi saranno gestiti automaticamente da cron.

---

## Parte 8: Integrazione con meeq-central

### 8.1 Crea il venue in meeq-central

1. Accedi a `https://app.meeq.it/central-admin.html` (o il tuo URL centrale)
2. Vai in **Locali** → **Crea nuovo locale**
3. Inserisci nome e email
4. Copia l’**API Key** generata

### 8.2 Configura meeq-geo

Inserisci l’API Key nel file `.env`:

```env
CENTRAL_SERVER_URL=https://app.meeq.it
VENUE_API_KEY=4b0576016c331735fe476b0d65dec919e627aa503651c6517e6e6d16d72c6400
```

### 8.3 CORS (se il central è su altro dominio)

Se l’app è accessibile da un dominio diverso da meeq-central, aggiungi nel `.env` di meeq-geo:

```env
PWA_ALLOWED_ORIGINS=https://geo.meeq.it,https://app.meeq.it
```

E assicurati che meeq-central accetti richieste dal dominio di meeq-geo (configurazione CORS del central).

---

## Parte 9: QR Code

Il QR deve puntare all’URL pubblico del venue.

**URL**: `https://geo.meeq.it/` oppure `https://geo.meeq.it/venue`

### Generare il QR

- **Online**: [qr-code-generator.com](https://www.qr-code-generator.com/) o simili
- **Dalla dashboard admin**: puoi aggiungere un endpoint che genera il QR (es. `/admin/qr`)

Esempio di contenuto QR: `https://geo.meeq.it/`

Stampa il QR e apponi i cartelli nel locale.

---

## Parte 10: Verifica finale

### Controlli sul VPS

```bash
# Servizio attivo
sudo systemctl status meeq-geo

# Log in tempo reale
journalctl -u meeq-geo -f

# Health check locale
curl http://localhost:3000/api/health
# {"ok":true,"service":"meeq-geo","time":"..."}

# Venue config
curl http://localhost:3000/api/venue
```

### Controlli da browser

1. **Landing**: `https://geo.meeq.it/`
   - Logo, pulsanti "Accedi al menù" e "Gioca con MEEQ"
2. **App**: `https://geo.meeq.it/app`
   - Flusso email → PIN → tavolo → chat
3. **Admin**: `https://geo.meeq.it/admin`
   - Login con credenziali configurate in `.env`

---

## Comandi utili

```bash
# Riavvia meeq-geo
sudo systemctl restart meeq-geo

# Log ultimi 100 righe
journalctl -u meeq-geo -n 100

# Aggiornare il codice (se usi Git)
cd /opt/meeq-geo
sudo git pull
sudo npm install
sudo systemctl restart meeq-geo

# Backup del database
sudo cp /opt/meeq-geo/chat.db /opt/meeq-geo/backups/chat-$(date +%Y%m%d).db
```

---

## Riepilogo flusso

1. **Utente**: scansiona QR → landing (logo, menù, Gioca)
2. **Gioca**: registrazione/login → inserimento tavolo → chat
3. **Geolocalizzazione**: se configurata, disconnessione automatica dopo 3 minuti fuori dal raggio
4. **Utenti**: gestiti da meeq-central (email, PIN, profili)

---

## Troubleshooting

### Servizio non parte

```bash
journalctl -u meeq-geo -n 50
# Verifica .env e dipendenze
cd /opt/meeq-geo && node server.js
```

### Errore "Port 3000 in use"

```bash
sudo lsof -i :3000
sudo kill -9 <PID>
```

### SSL non funziona

- Controlla che il record DNS punti all’IP corretto
- `sudo nginx -t`
- `sudo systemctl status nginx`

### Geolocalizzazione non attiva

- Verifica `VENUE_LATITUDE` e `VENUE_LONGITUDE` nel `.env`
- Ricontrolla l’output di `GET /api/venue` (deve includere `geo`)
