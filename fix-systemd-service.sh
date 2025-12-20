#!/bin/bash
# Fix servizio systemd per server centrale

echo "🔧 Fix Servizio Systemd Meeq Central"
echo "====================================="

# Modifica il servizio per usare Type=simple e aggiungere KeepAlive
cat > /etc/systemd/system/meeq-central.service <<EOF
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
# Mantieni il processo attivo
KillMode=process
KillSignal=SIGTERM
TimeoutStopSec=10

[Install]
WantedBy=multi-user.target
EOF

# Ricarica systemd
systemctl daemon-reload

# Riavvia servizio
systemctl restart meeq-central

# Attendi 3 secondi
sleep 3

# Verifica stato
echo ""
echo "📊 Stato servizio:"
systemctl status meeq-central --no-pager | head -15

echo ""
echo "📋 Ultimi log:"
journalctl -u meeq-central -n 20 --no-pager | tail -20

