#!/bin/bash
# Script per diagnosticare e risolvere problemi servizio VPS

echo "🔍 Diagnostica Servizio Meeq Central"
echo "===================================="
echo ""

# Controlla log
echo "📋 Log servizio (ultimi 50 righe):"
echo "-----------------------------------"
journalctl -u meeq-central -n 50 --no-pager

echo ""
echo "📁 Verifica file:"
echo "----------------"
WORK_DIR="/opt/meeq-central"

if [ -f "$WORK_DIR/central-server.js" ]; then
    echo "✅ central-server.js presente"
else
    echo "❌ central-server.js MANCANTE"
    echo "   Trasferisci con: scp central-server.js root@vps:/opt/meeq-central/"
fi

if [ -f "$WORK_DIR/package.json" ]; then
    echo "✅ package.json presente"
else
    echo "❌ package.json MANCANTE"
    echo "   Trasferisci con: scp package.json root@vps:/opt/meeq-central/"
fi

if [ -f "$WORK_DIR/public/central-admin.html" ]; then
    echo "✅ central-admin.html presente"
else
    echo "❌ central-admin.html MANCANTE"
    echo "   Trasferisci con: scp -r public/central-admin.html root@vps:/opt/meeq-central/public/"
fi

if [ -f "$WORK_DIR/.env" ]; then
    echo "✅ .env presente"
    echo "   Contenuto (senza password):"
    grep -v "PASSWORD\|SECRET" $WORK_DIR/.env
else
    echo "❌ .env MANCANTE"
fi

echo ""
echo "🔧 Test manuale:"
echo "----------------"
cd $WORK_DIR
if [ -f "central-server.js" ]; then
    echo "Test avvio manuale (Ctrl+C per fermare):"
    echo "node central-server.js"
else
    echo "❌ Impossibile testare: central-server.js non trovato"
fi

echo ""
echo "📊 Stato servizio:"
echo "------------------"
systemctl status meeq-central --no-pager | head -15

