# Istruzioni Setup VPS - Configurazione Personalizzata

## Situazione Attuale

✅ **Nginx**: Installato (1.24.0)  
✅ **Firewall (UFW)**: Attivo - Porta 3000 già aperta  
✅ **SSL/Let's Encrypt**: Installato (certificati per dsec.emanuelecavallini.it, voice.emanuelecavallini.it)  
❌ **Node.js**: NON installato (da installare)  
✅ **Porte disponibili**: 3001 (consigliata, 3000 già in uso)  

## Procedura Setup

### 1. Trasferisci i file sul VPS

Dal Raspberry Pi:

```bash
cd /home/meeq/meeq
scp central-server.js root@your-vps-ip:/opt/meeq-central/
scp package.json root@your-vps-ip:/opt/meeq-central/
scp -r public/central-admin.html root@your-vps-ip:/opt/meeq-central/public/
scp setup-vps-personalizzato.sh root@your-vps-ip:/tmp/
```

### 2. Connettiti al VPS

```bash
ssh root@your-vps-ip
```

### 3. Esegui lo script di setup

```bash
cd /tmp
chmod +x setup-vps-personalizzato.sh
bash setup-vps-personalizzato.sh
```

Lo script ti chiederà:
- **Dominio/sottodominio** (es: `api.emanuelecavallini.it` oppure lascia vuoto per usare IP)
- **Admin Username** (default: admin)
- **Admin Password**

### 4. Configurazione Opzionale SSL

Se hai scelto un dominio, lo script chiederà se vuoi configurare SSL. Rispondi `y` e verrà configurato automaticamente con Let's Encrypt.

## Configurazione Manuale (Alternativa)

Se preferisci configurare manualmente:

### 1. Installa Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs
node --version
```

### 2. Crea directory e file

```bash
mkdir -p /opt/meeq-central/public
cd /opt/meeq-central

# Copia i file (se non già fatto)
# central-server.js
# package.json
# public/central-admin.html
```

### 3. Crea file .env

```bash
nano .env
```

Incolla (modifica i valori):

```env
PORT=3001
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
NODE_ENV=production
```

Genera i secret:

```bash
openssl rand -hex 32  # Per JWT_SECRET
openssl rand -hex 32  # Per JWT_REFRESH_SECRET
```

### 4. Installa dipendenze

```bash
npm install --production
```

### 5. Configura Nginx

Crea configurazione:

```bash
nano /etc/nginx/sites-available/meeq-central
```

Incolla (modifica `api.emanuelecavallini.it` con il tuo dominio):

```nginx
server {
    listen 80;
    server_name api.emanuelecavallini.it;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Abilita sito:

```bash
ln -s /etc/nginx/sites-available/meeq-central /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 6. Configura SSL (Opzionale)

```bash
certbot --nginx -d api.emanuelecavallini.it
```

### 7. Apri porta firewall

```bash
ufw allow 3001/tcp
```

### 8. Crea servizio systemd

```bash
nano /etc/systemd/system/meeq-central.service
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

Avvia servizio:

```bash
systemctl daemon-reload
systemctl enable meeq-central
systemctl start meeq-central
systemctl status meeq-central
```

## Verifica Funzionamento

### Test endpoint:

```bash
curl http://localhost:3001/api/central/admin/stats
```

### Controlla log:

```bash
journalctl -u meeq-central -f
```

### Accesso Dashboard:

- Con dominio: `http://api.emanuelecavallini.it/central-admin.html`
- Con IP: `http://your-vps-ip:3001/central-admin.html`

## Prossimi Passi

1. ✅ Server centrale configurato
2. 📝 Accedi alla dashboard admin
3. 🏢 Crea il primo locale
4. 🔑 Copia l'API Key generata
5. ⚙️ Configura il Raspberry con l'API Key

## Troubleshooting

### Server non si avvia:

```bash
journalctl -u meeq-central -n 50
cd /opt/meeq-central
node central-server.js  # Test manuale
```

### Porta già in uso:

```bash
sudo lsof -i :3001
# Cambia PORT nel .env
```

### Nginx error:

```bash
nginx -t  # Test configurazione
journalctl -u nginx -n 50  # Log nginx
```

