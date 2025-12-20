#!/bin/bash
# Script di setup per Server Centrale Meeq
# Eseguire sul VPS Hetzner

set -e

echo "🚀 Setup Server Centrale Meeq"
echo "================================"

# Directory di lavoro
WORK_DIR="/opt/meeq-central"
SERVICE_USER="meeq"

# Crea directory
echo "📁 Creazione directory..."
sudo mkdir -p $WORK_DIR
sudo mkdir -p $WORK_DIR/public

# Crea utente se non esiste
if ! id "$SERVICE_USER" &>/dev/null; then
    echo "👤 Creazione utente $SERVICE_USER..."
    sudo useradd -r -s /bin/bash -d $WORK_DIR $SERVICE_USER
fi

# Chiedi configurazione
echo ""
echo "📝 Configurazione Server Centrale"
echo "-----------------------------------"
read -p "Porta server (default: 3001): " PORT
PORT=${PORT:-3001}

read -p "JWT Secret (lascia vuoto per generare automaticamente): " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -hex 32)
    echo "✅ JWT Secret generato: $JWT_SECRET"
fi

read -p "Admin Username (default: admin): " ADMIN_USERNAME
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}

read -sp "Admin Password: " ADMIN_PASSWORD
echo ""

read -p "Dominio/IP pubblico (es: api.meeq.it o 123.456.789.0): " DOMAIN

# Copia file (assumendo che siano già sul server o da trasferire)
echo ""
echo "📦 Copia file..."
# I file devono essere copiati manualmente o tramite scp
# sudo cp central-server.js $WORK_DIR/
# sudo cp -r public/central-admin.html $WORK_DIR/public/

# Crea file .env
echo "⚙️ Creazione file configurazione..."
sudo tee $WORK_DIR/.env > /dev/null <<EOF
PORT=$PORT
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

# Imposta permessi
echo "🔐 Impostazione permessi..."
sudo chown -R $SERVICE_USER:$SERVICE_USER $WORK_DIR
sudo chmod 600 $WORK_DIR/.env

# Installa dipendenze (se necessario)
if [ -f "$WORK_DIR/package.json" ]; then
    echo "📦 Installazione dipendenze..."
    cd $WORK_DIR
    sudo -u $SERVICE_USER npm install --production
fi

# Abilita e avvia servizio
echo "▶️ Avvio servizio..."
sudo systemctl daemon-reload
sudo systemctl enable meeq-central
sudo systemctl start meeq-central

# Verifica stato
sleep 2
if sudo systemctl is-active --quiet meeq-central; then
    echo "✅ Server centrale avviato con successo!"
    echo ""
    echo "📍 Accesso Dashboard Admin:"
    echo "   http://$DOMAIN:$PORT/central-admin.html"
    echo ""
    echo "📊 Stato servizio:"
    sudo systemctl status meeq-central --no-pager | head -10
else
    echo "❌ Errore avvio servizio. Controlla i log:"
    echo "   sudo journalctl -u meeq-central -n 50"
fi

echo ""
echo "🎉 Setup completato!"

