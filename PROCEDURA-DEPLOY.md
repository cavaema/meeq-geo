# Procedura passo-passo: MEEQ-GEO su Hetzner (PC → Git → VPS)

---

## Fase 1: Sul PC

### 1.1 Inizializza Git nel progetto

Apri il terminale nella cartella meeq-geo:

```bash
cd "g:\Il mio Drive\JOB\PROGETTI\meeq\meeq-geo"
```

Se il progetto non è ancora un repo Git:

```bash
git init
git add .
git commit -m "Initial commit meeq-geo"
```

### 1.2 Collega a GitHub

Sostituisci `TUO-USER` con il tuo username GitHub:

```bash
git remote add origin https://github.com/TUO-USER/meeq-geo.git
git branch -M main
git push -u origin main
```

Se richiede login: usa username + Personal Access Token (non la password).

### 1.3 Aggiornamenti futuri (dopo modifiche)

```bash
git add .
git commit -m "Descrizione della modifica"
git push
```

---

## Fase 2: Su GitHub

### 2.1 Crea il repository (solo la prima volta)

1. Vai su **https://github.com**
2. Clicca **"New"** / **"New repository"**
3. **Repository name**: `meeq-geo`
4. **Visibility**: Private o Public
5. **Non** spuntare "Add a README"
6. Clicca **"Create repository"**

### 2.2 Copia l’URL

Dopo la creazione, copia l’URL (es. `https://github.com/tuouser/meeq-geo.git`) e usalo nel comando `git remote add origin` al passo 1.2.

---

## Fase 3: Sul VPS (Hetzner)

### 3.1 Connessione SSH

```bash
ssh root@IP_DEL_TUO_VPS
```

Esempio: `ssh root@123.45.67.89`

### 3.2 Aggiorna il sistema

```bash
apt update && apt upgrade -y
```

### 3.3 Installa Git e Node.js

```bash
apt install -y git
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### 3.4 Clone del progetto

Sostituisci con il tuo URL GitHub:

```bash
cd /opt
git clone https://github.com/TUO-USER/meeq-geo.git
cd meeq-geo
```

### 3.5 Installa le dipendenze

```bash
npm install
```

### 3.6 Configura `.env`

```bash
cp .env.example .env
nano .env
```

Modifica almeno:

- `VENUE_NAME` – nome del locale
- `VENUE_LATITUDE` e `VENUE_LONGITUDE` – coordinate
- `VENUE_API_KEY` – da meeq-central
- `ADMIN_PASSWORD` – password admin

Salva: `Ctrl+O`, `Enter`, `Ctrl+X`

### 3.7 Crea il service systemd

```bash
nano /etc/systemd/system/meeq-geo.service
```

Incolla:

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

Salva e chiudi.

### 3.8 Avvia il servizio

```bash
systemctl daemon-reload
systemctl enable meeq-geo
systemctl start meeq-geo
systemctl status meeq-geo
```

### 3.9 Firewall (consigliato)

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## Fase 4: Nginx + SSL (opzionale, per dominio)

### 4.1 Installa Nginx e Certbot

```bash
apt install -y nginx certbot python3-certbot-nginx
```

### 4.2 Crea il sito

```bash
nano /etc/nginx/sites-available/meeq-geo
```

Sostituisci `geo.meeq.it` con il tuo dominio:

```nginx
server {
    listen 80;
    server_name geo.meeq.it;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Attiva:

```bash
ln -s /etc/nginx/sites-available/meeq-geo /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 4.3 DNS

Nel pannello DNS del dominio: record **A** → `geo` (o `@`) → IP del VPS.

### 4.4 Certificato SSL

```bash
certbot --nginx -d geo.meeq.it
```

---

## Aggiornamenti: workflow completo

| Dove | Azione |
|------|--------|
| **PC** | Modifica codice, poi: `git add .` → `git commit -m "messaggio"` → `git push` |
| **VPS** | `cd /opt/meeq-geo` → `git pull` → `npm install` (se cambiano dipendenze) → `systemctl restart meeq-geo` |

---

## Comandi utili VPS

```bash
# Stato servizio
systemctl status meeq-geo

# Log in tempo reale
journalctl -u meeq-geo -f

# Riavvio
systemctl restart meeq-geo
```
