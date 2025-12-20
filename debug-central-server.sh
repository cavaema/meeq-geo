#!/bin/bash
# Script di debug per server centrale

echo "🔍 Debug Server Centrale Meeq"
echo "=============================="
echo ""

WORK_DIR="/opt/meeq-central"
cd $WORK_DIR

# 1. Verifica file
echo "📁 Verifica file:"
echo "-----------------"
[ -f "central-server.js" ] && echo "✅ central-server.js" || echo "❌ central-server.js MANCANTE"
[ -f "package.json" ] && echo "✅ package.json" || echo "❌ package.json MANCANTE"
[ -f ".env" ] && echo "✅ .env" || echo "❌ .env MANCANTE"
[ -f "public/central-admin.html" ] && echo "✅ central-admin.html" || echo "❌ central-admin.html MANCANTE"
echo ""

# 2. Verifica .env
echo "⚙️ Contenuto .env (senza password):"
echo "------------------------------------"
if [ -f ".env" ]; then
    grep -v "PASSWORD\|SECRET" .env || echo "File vuoto o non leggibile"
else
    echo "❌ File .env non trovato"
fi
echo ""

# 3. Verifica Node.js
echo "📦 Node.js:"
echo "-----------"
node --version
npm --version
echo ""

# 4. Verifica dipendenze
echo "📚 Dipendenze installate:"
echo "-------------------------"
if [ -d "node_modules" ]; then
    echo "✅ node_modules presente"
    ls node_modules | wc -l | xargs echo "   Pacchetti:"
else
    echo "❌ node_modules MANCANTE - Esegui: npm install"
fi
echo ""

# 5. Test sintassi
echo "🔧 Test sintassi central-server.js:"
echo "------------------------------------"
node -c central-server.js && echo "✅ Sintassi OK" || echo "❌ Errore sintassi"
echo ""

# 6. Test database
echo "💾 Test database:"
echo "-----------------"
if [ -f "central.db" ]; then
    echo "✅ central.db presente ($(du -h central.db | cut -f1))"
else
    echo "⚠️ central.db non presente (verrà creato al primo avvio)"
fi
echo ""

# 7. Test avvio manuale (5 secondi)
echo "🚀 Test avvio manuale (5 secondi):"
echo "-----------------------------------"
timeout 5 node central-server.js 2>&1 || echo ""
echo ""

# 8. Log servizio
echo "📋 Ultimi log servizio:"
echo "-----------------------"
journalctl -u meeq-central -n 20 --no-pager | tail -20
echo ""

# 9. Permessi
echo "🔐 Permessi file:"
echo "-----------------"
ls -la central-server.js package.json .env 2>/dev/null | head -5
echo ""

echo "✅ Debug completato!"

