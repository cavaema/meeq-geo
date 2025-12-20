#!/bin/bash
# Script di setup personalizzato per Server Centrale Meeq
# Configurazione per VPS condiviso

set -e

echo "🚀 Setup Server Centrale Meeq (VPS Condiviso)"
echo "==============================================="

# ============================================================================
# CONFIGURAZIONE - MODIFICA QUESTI VALORI
# ============================================================================

# Porta del server Node.js (cambia se necessario)
NODE_PORT="${NODE_PORT:-3001}"

# Directory di installazione
WORK_DIR="${WORK_DIR:-/opt/meeq-central}"

# Utente che esegue il servizio
SERVICE_USER="${SERVICE_USER:-root}"

# Dominio/sottodominio (se usi nginx)
DOMAIN="${DOMAIN:-api.meeq.it}"

# Path nginx (se non vuoi usare la root)
NGINX_PATH="${NGINX_PATH:-/}"

# Usa nginx come reverse proxy? (true/false)
USE_NGINX="${USE_NGINX:-true}"

# ============================================================================
# SETUP
# ============================================================================

echo ""
echo "📝 Configurazione:"
echo "   Porta Node.js: $NODE_PORT"
echo "   Directory: $WORK_DIR"
echo "   Utente: $SERVICE_USER"
echo "   Dominio: $DOMAIN"
echo "   Usa Nginx: $USE_NGINX"
echo ""

read -p "Confermi questa configurazione? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "❌ Setup annullato. Modifica le variabili all'inizio dello script."
    exit 1
fi

# Crea directory
echo "📁 Creazione directory..."
sudo mkdir -p $WORK_DIR
sudo mkdir -p $WORK_DIR/public

# Chiedi configurazione avanzata
echo ""
echo "🔐 Configurazione Sicurezza"
echo "----------------------------"
read -sp "JWT Secret (lascia vuoto per generare): " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -hex 32)
    echo "✅ JWT Secret generato"
fi
echo ""

read -p "Admin Username (default: admin): " ADMIN_USERNAME
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}

read -sp "Admin Password: " ADMIN_PASSWORD
echo ""

# Crea file .env
echo "⚙️ Creazione file configurazione..."
sudo tee $WORK_DIR/.env > /dev/null <<EOF
PORT=$NODE_PORT
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
ADMIN_USERNAME=$ADMIN_USERNAME
ADMIN_PASSWORD=$ADMIN_PASSWORD
NODE_ENV=production
EOF

# Crea service file systemd
echo "🔧 Creazione servizio systemd..."
sudo tee /etc/systemd/system/meeq-central.service > /dev/null <<EOF
[Unit]
Description=Meeq Central Server
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
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

# Configura Nginx (se richiesto)
if [ "$USE_NGINX" = "true" ]; then
    echo "🌐 Configurazione Nginx..."
    
    # Verifica se nginx è installato
    if ! command -v nginx &> /dev/null; then
        echo "⚠️ Nginx non trovato. Installo?"
        read -p "Installa nginx? (y/n): " INSTALL_NGINX
        if [ "$INSTALL_NGINX" = "y" ]; then
            sudo apt-get update
            sudo apt-get install -y nginx
        else
            USE_NGINX="false"
        fi
    fi
    
    if [ "$USE_NGINX" = "true" ]; then
        # Crea configurazione nginx
        NGINX_CONFIG="/etc/nginx/sites-available/meeq-central"
        
        if [ "$NGINX_PATH" = "/" ]; then
            # Configurazione root domain
            sudo tee $NGINX_CONFIG > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    
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
        else
            # Configurazione con path
            sudo tee $NGINX_CONFIG > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location $NGINX_PATH {
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
        fi
        
        # Abilita sito
        sudo ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/
        
        # Test configurazione
        sudo nginx -t
        
        # Riavvia nginx
        sudo systemctl reload nginx
        
        echo "✅ Nginx configurato per $DOMAIN"
    fi
fi

# Imposta permessi
echo "🔐 Impostazione permessi..."
sudo chown -R $SERVICE_USER:$SERVICE_USER $WORK_DIR
sudo chmod 600 $WORK_DIR/.env

# Installa dipendenze (se necessario)
if [ -f "$WORK_DIR/package.json" ]; then
    echo "📦 Installazione dipendenze..."
    cd $WORK_DIR
    if [ "$SERVICE_USER" != "root" ]; then
        sudo -u $SERVICE_USER npm install --production
    else
        npm install --production
    fi
fi

# Abilita e avvia servizio
echo "▶️ Avvio servizio..."
sudo systemctl daemon-reload
sudo systemctl enable meeq-central
sudo systemctl start meeq-central

# Verifica stato
sleep 2
if sudo systemctl is-active --quiet meeq-central; then
    echo ""
    echo "✅ Server centrale avviato con successo!"
    echo ""
    echo "📍 Accesso:"
    if [ "$USE_NGINX" = "true" ]; then
        echo "   Dashboard Admin: http://$DOMAIN/central-admin.html"
        echo "   API: http://$DOMAIN/api/central/..."
    else
        echo "   Dashboard Admin: http://$(hostname -I | awk '{print $1}'):$NODE_PORT/central-admin.html"
        echo "   API: http://$(hostname -I | awk '{print $1}'):$NODE_PORT/api/central/..."
    fi
    echo ""
    echo "📊 Stato servizio:"
    sudo systemctl status meeq-central --no-pager | head -10
else
    echo "❌ Errore avvio servizio. Controlla i log:"
    echo "   sudo journalctl -u meeq-central -n 50"
fi

echo ""
echo "🎉 Setup completato!"

