#!/bin/bash
# Setup Server Centrale Meeq - Configurazione Personalizzata
# Per VPS con Nginx già configurato
# Eseguire sul VPS: bash setup-vps-personalizzato.sh

set -e

echo "🚀 Setup Server Centrale Meeq (VPS Personalizzato)"
echo "=================================================="
echo ""

# ============================================================================
# CONFIGURAZIONE
# ============================================================================

# Porta Node.js (3001 per evitare conflitti con altre app)
NODE_PORT=3001

# Directory installazione
WORK_DIR="/opt/meeq-central"

# Dominio (modifica se vuoi usare un sottodominio)
# Es: api.emanuelecavallini.it oppure meeq.emanuelecavallini.it
read -p "Dominio/sottodominio per server centrale (es: api.emanuelecavallini.it) [lascia vuoto per usare IP]: " DOMAIN

# Se non specificato dominio, usa IP
if [ -z "$DOMAIN" ]; then
    USE_DOMAIN=false
    echo "⚠️ Userai l'IP pubblico con porta $NODE_PORT"
else
    USE_DOMAIN=true
    echo "✅ Dominio configurato: $DOMAIN"
fi

# Chiedi credenziali admin
echo ""
read -p "Admin Username (default: admin): " ADMIN_USERNAME
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}

read -sp "Admin Password: " ADMIN_PASSWORD
echo ""

# ============================================================================
# INSTALLAZIONE NODE.JS
# ============================================================================

echo ""
echo "📦 Installazione Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    apt-get install -y nodejs
    echo "✅ Node.js installato: $(node --version)"
else
    echo "✅ Node.js già installato: $(node --version)"
fi

# ============================================================================
# CREAZIONE DIRECTORY E FILE
# ============================================================================

echo ""
echo "📁 Creazione directory..."
mkdir -p $WORK_DIR
mkdir -p $WORK_DIR/public

# Genera secret keys
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

# Crea file .env
echo "⚙️ Creazione file configurazione..."
cat > $WORK_DIR/.env <<EOF
PORT=$NODE_PORT
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
ADMIN_USERNAME=$ADMIN_USERNAME
ADMIN_PASSWORD=$ADMIN_PASSWORD
NODE_ENV=production
EOF

chmod 600 $WORK_DIR/.env

# ============================================================================
# CONFIGURAZIONE NGINX
# ============================================================================

if [ "$USE_DOMAIN" = true ]; then
    echo ""
    echo "🌐 Configurazione Nginx per $DOMAIN..."
    
    # Crea configurazione nginx
    NGINX_CONFIG="/etc/nginx/sites-available/meeq-central"
    
    cat > $NGINX_CONFIG <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Redirect HTTP to HTTPS (se hai SSL)
    # return 301 https://\$server_name\$request_uri;
    
    location / {
        proxy_pass http://localhost:$NODE_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

    # Abilita sito
    ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/
    
    # Test configurazione
    nginx -t
    
    # Riavvia nginx
    systemctl reload nginx
    
    echo "✅ Nginx configurato per $DOMAIN"
    
    # Chiedi se vuoi configurare SSL
    echo ""
    read -p "Vuoi configurare SSL/HTTPS con Let's Encrypt? (y/n): " SETUP_SSL
    if [ "$SETUP_SSL" = "y" ]; then
        if command -v certbot &> /dev/null; then
            echo "🔒 Configurazione SSL..."
            certbot --nginx -d $DOMAIN
            echo "✅ SSL configurato!"
        else
            echo "⚠️ Certbot non installato. Installa con: apt-get install certbot python3-certbot-nginx"
        fi
    fi
fi

# ============================================================================
# CONFIGURAZIONE FIREWALL
# ============================================================================

echo ""
echo "🔥 Configurazione Firewall..."
if command -v ufw &> /dev/null; then
    # Verifica se porta è già aperta
    if ! ufw status | grep -q "$NODE_PORT/tcp"; then
        ufw allow $NODE_PORT/tcp
        echo "✅ Porta $NODE_PORT aperta nel firewall"
    else
        echo "✅ Porta $NODE_PORT già aperta"
    fi
fi

# ============================================================================
# CREAZIONE SERVIZIO SYSTEMD
# ============================================================================

echo ""
echo "🔧 Creazione servizio systemd..."
cat > /etc/systemd/system/meeq-central.service <<EOF
[Unit]
Description=Meeq Central Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$WORK_DIR
EnvironmentFile=$WORK_DIR/.env
ExecStart=/usr/bin/node $WORK_DIR/central-server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable meeq-central

echo "✅ Servizio systemd creato"

# ============================================================================
# INSTALLAZIONE DIPENDENZE
# ============================================================================

echo ""
echo "📦 Installazione dipendenze..."
if [ -f "$WORK_DIR/package.json" ]; then
    cd $WORK_DIR
    npm install --production
    echo "✅ Dipendenze installate"
else
    echo "⚠️ package.json non trovato. Assicurati di aver copiato i file necessari."
fi

# ============================================================================
# AVVIO SERVIZIO
# ============================================================================

echo ""
echo "▶️ Avvio servizio..."
systemctl start meeq-central

# Verifica stato
sleep 2
if systemctl is-active --quiet meeq-central; then
    echo ""
    echo "✅ Server centrale avviato con successo!"
    echo ""
    echo "📍 Accesso:"
    if [ "$USE_DOMAIN" = true ]; then
        echo "   Dashboard Admin: http://$DOMAIN/central-admin.html"
        echo "   API: http://$DOMAIN/api/central/..."
    else
        IP=$(curl -s ifconfig.me)
        echo "   Dashboard Admin: http://$IP:$NODE_PORT/central-admin.html"
        echo "   API: http://$IP:$NODE_PORT/api/central/..."
    fi
    echo ""
    echo "📊 Stato servizio:"
    systemctl status meeq-central --no-pager | head -10
    echo ""
    echo "📝 Credenziali Admin:"
    echo "   Username: $ADMIN_USERNAME"
    echo "   Password: (quella che hai inserito)"
    echo ""
    echo "🔑 JWT Secret salvato in: $WORK_DIR/.env"
else
    echo "❌ Errore avvio servizio. Controlla i log:"
    echo "   journalctl -u meeq-central -n 50"
fi

echo ""
echo "🎉 Setup completato!"

