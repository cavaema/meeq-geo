#!/bin/bash
# Script per trasferire app.html al VPS
# Eseguire dal Raspberry Pi

set -e

echo "📤 Trasferimento app.html al VPS"
echo "================================="

# Configurazione (modifica se necessario)
VPS_HOST="128.140.84.82"
SSH_USER="root"
SSH_PORT="22"
VPS_DIR="/opt/meeq-central"  # Oppure /home/meeq/meeq se il central server è lì

# Verifica che app.html esista
if [ ! -f "public/app.html" ]; then
    echo "❌ Errore: public/app.html non trovato!"
    exit 1
fi

echo "📍 VPS: $SSH_USER@$VPS_HOST:$VPS_DIR"
echo ""

# Trasferisci app.html
echo "🔄 Trasferimento app.html..."
scp -P $SSH_PORT public/app.html $SSH_USER@$VPS_HOST:$VPS_DIR/public/

echo ""
echo "✅ File trasferito con successo!"
echo ""
echo "📝 Prossimi passi sul VPS:"
echo "   1. Verifica che il file sia presente:"
echo "      ssh $SSH_USER@$VPS_HOST 'ls -lh $VPS_DIR/public/app.html'"
echo ""
echo "   2. Riavvia il central server (se necessario):"
echo "      ssh $SSH_USER@$VPS_HOST 'sudo systemctl restart meeq-central'"
echo ""
echo "   3. Testa la PWA:"
echo "      http://$VPS_HOST:3002/app.html"
echo ""


