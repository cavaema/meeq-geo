# Setup Rapido Server Centrale VPS

## Opzione 1: Trasferimento Automatico (Consigliato)

### Dal Raspberry Pi:

```bash
cd /home/meeq/meeq
chmod +x transfer-to-vps.sh
./transfer-to-vps.sh
```

Lo script ti chiederà:
- Indirizzo IP/dominio del VPS
- Username SSH (di solito `root`)
- Porta SSH (di solito `22`)
- Directory destinazione (default: `/opt/meeq-central`)

Poi connettiti al VPS e esegui lo setup:

```bash
ssh root@your-vps-ip
cd /opt/meeq-central
chmod +x setup-central-server.sh
sudo bash setup-central-server.sh
```

## Opzione 2: Trasferimento Manuale

### 1. Trasferisci i file manualmente:

```bash
# Dal Raspberry Pi
scp central-server.js root@your-vps-ip:/opt/meeq-central/
scp package.json root@your-vps-ip:/opt/meeq-central/
scp -r public/central-admin.html root@your-vps-ip:/opt/meeq-central/public/
```

### 2. Connettiti al VPS:

```bash
ssh root@your-vps-ip
cd /opt/meeq-central
```

### 3. Installa Node.js (se non presente):

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verifica installazione
node --version
npm --version
```

### 4. Installa dipendenze:

```bash
npm install
```

### 5. Crea file .env:

```bash
nano .env
```

Incolla:

```env
PORT=3001
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
NODE_ENV=production
```

Genera secret keys:

```bash
openssl rand -hex 32  # Per JWT_SECRET
openssl rand -hex 32  # Per JWT_REFRESH_SECRET
```

### 6. Crea servizio systemd:

```bash
sudo nano /etc/systemd/system/meeq-central.service
```

Incolla:

```ini
[Unit]
Description=Meeq Central Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/meeq-central
EnvironmentFile=/opt/meeq-central/.env
ExecStart=/usr/bin/node /opt/meeq-central/central-server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 7. Avvia servizio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable meeq-central
sudo systemctl start meeq-central
sudo systemctl status meeq-central
```

### 8. Verifica funzionamento:

```bash
# Controlla log
sudo journalctl -u meeq-central -f

# Test endpoint
curl http://localhost:3001/api/central/admin/stats
```

## Configurazione Firewall

Se usi UFW:

```bash
sudo ufw allow 3001/tcp
sudo ufw status
```

Se usi iptables:

```bash
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
```

## Configurazione HTTPS (Opzionale ma Consigliato)

### Con Certbot (Let's Encrypt):

```bash
sudo apt-get install certbot
sudo certbot certonly --standalone -d api.meeq.it
```

Poi modifica `central-server.js` per usare HTTPS o usa un reverse proxy (nginx).

### Con Nginx Reverse Proxy:

```bash
sudo apt-get install nginx
sudo nano /etc/nginx/sites-available/meeq-central
```

Configurazione:

```nginx
server {
    listen 80;
    server_name api.meeq.it;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/meeq-central /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Accesso Dashboard Admin

Dopo l'avvio, accedi a:

```
http://your-vps-ip:3001/central-admin.html
```

O se hai configurato dominio:

```
https://api.meeq.it/central-admin.html
```

Login:
- Username: `admin` (o quello configurato)
- Password: quella impostata nel `.env`

## Creazione Primo Locale

1. Accedi alla dashboard admin
2. Vai alla tab "Locali"
3. Clicca "Nuovo Locale"
4. Inserisci:
   - Nome locale
   - Email contatto
5. **COPIA L'API KEY GENERATA** - ti servirà per configurare il Raspberry

## Troubleshooting

### Server non si avvia:

```bash
# Controlla log
sudo journalctl -u meeq-central -n 50

# Verifica permessi
ls -la /opt/meeq-central

# Test manuale
cd /opt/meeq-central
node central-server.js
```

### Porta già in uso:

```bash
sudo lsof -i :3001
# Cambia PORT nel .env
```

### Database non creato:

```bash
cd /opt/meeq-central
node -e "const db = require('sqlite3').Database('./central.db'); db.close();"
ls -lh central.db
```

