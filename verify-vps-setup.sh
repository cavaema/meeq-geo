#!/bin/bash
# Script per verificare setup VPS
# Esegui questo script SUL VPS

echo "🔍 Verifica setup VPS"
echo "===================="
echo ""

# Verifica file app.html
if [ -f "/opt/meeq-central/public/app.html" ]; then
    SIZE=$(ls -lh /opt/meeq-central/public/app.html | awk '{print $5}')
    echo "✅ app.html presente: $SIZE"
else
    echo "❌ app.html NON trovato in /opt/meeq-central/public/"
fi

echo ""

# Verifica central server
if systemctl is-active --quiet meeq-central; then
    echo "✅ Central server ATTIVO"
    systemctl status meeq-central --no-pager | head -5
else
    echo "⚠️  Central server NON attivo"
    echo "   Avvia con: sudo systemctl start meeq-central"
fi

echo ""

# Verifica porta
if netstat -tuln | grep -q ":3002"; then
    echo "✅ Server in ascolto sulla porta 3002"
else
    echo "⚠️  Porta 3002 non in ascolto"
fi

echo ""
echo "📝 Test URL:"
echo "   http://128.140.84.82:3002/app.html"
echo ""


