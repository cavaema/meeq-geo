#!/bin/bash
# Setup MEEQ-GEO su VPS via Git
# Uso: GIT_REPO=https://github.com/TUO-USER/meeq-geo.git sudo bash setup-vps.sh

set -e

GIT_REPO="${GIT_REPO:-https://github.com/cavaema/meeq-geo.git}"
INSTALL_DIR="/opt/meeq-geo"
SERVICE_NAME="meeq-geo"
PORT=3000

echo "=========================================="
echo "  Setup MEEQ-GEO su VPS (via Git)"
echo "=========================================="
echo ""
echo "📦 Repository: $GIT_REPO"
echo "📁 Directory:  $INSTALL_DIR"
echo ""

if [ "$EUID" -ne 0 ]; then
    echo "⚠️  Esegui come root: sudo bash setup-vps.sh"
    echo "    Oppure: GIT_REPO=https://github.com/TUO-USER/meeq-geo.git sudo bash setup-vps.sh"
    exit 1
fi

# Git
if ! command -v git &> /dev/null; then
    echo "📦 Installazione Git..."
    apt update && apt install -y git
fi

# Node.js
if ! command -v node &> /dev/null; then
    echo "📦 Installazione Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

echo "✅ Node.js $(node --version) | npm $(npm --version)"
echo ""

# Clone o pull
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "🔄 Repository già presente, aggiornamento..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "📥 Clonazione repository..."
    mkdir -p "$(dirname $INSTALL_DIR)"
    git clone "$GIT_REPO" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Dipendenze
echo "📦 Installazione dipendenze..."
npm install

# .env
if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo "📄 Creazione .env da .env.example..."
    cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    echo "⚠️  Modifica .env con le tue configurazioni!"
fi

# Systemd
echo "⚙️  Configurazione service systemd..."
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=MEEQ-GEO Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
ExecStart=/usr/bin/node ${INSTALL_DIR}/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}

sleep 2
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo ""
    echo "✅ Setup completato!"
    echo ""
    echo "📝 Comandi:"
    echo "   Status:  systemctl status ${SERVICE_NAME}"
    echo "   Logs:    journalctl -u ${SERVICE_NAME} -f"
    echo "   Restart: systemctl restart ${SERVICE_NAME}"
    echo ""
    echo "🌐 App:  http://$(hostname -I | awk '{print $1}'):${PORT}/"
    echo "   Admin: http://$(hostname -I | awk '{print $1}'):${PORT}/admin"
else
    echo "❌ Errore avvio. Log: journalctl -u ${SERVICE_NAME} -n 50"
    exit 1
fi
