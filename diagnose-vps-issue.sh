#!/bin/bash
# Diagnostica problema VPS

echo "🔍 Diagnostica Problema VPS"
echo "==========================="
echo ""

# 1. Test diretto server Node.js (bypass nginx)
echo "1. Test diretto server Node.js (localhost:3001):"
echo "-------------------------------------------------"
curl -s http://127.0.0.1:3001/api/central/admin/stats
echo ""
echo ""

# 2. Verifica processo Node.js
echo "2. Processo Node.js central-server:"
echo "-----------------------------------"
ps aux | grep "central-server.js" | grep -v grep
echo ""

# 3. Verifica docker-prox
echo "3. Processo docker-prox sulla porta 3001:"
echo "-----------------------------------------"
ps aux | grep docker-prox | grep 3001 | head -3
echo ""

# 4. Verifica configurazione nginx
echo "4. Configurazione nginx per meeq-central:"
echo "-----------------------------------------"
if [ -f "/etc/nginx/sites-enabled/meeq-central" ]; then
    cat /etc/nginx/sites-enabled/meeq-central
else
    echo "❌ Configurazione nginx non trovata"
fi
echo ""

# 5. Test porta 3001
echo "5. Porte in ascolto sulla 3001:"
echo "-------------------------------"
netstat -tlnp 2>/dev/null | grep 3001 || ss -tlnp 2>/dev/null | grep 3001
echo ""

# 6. Test endpoint senza autenticazione
echo "6. Test endpoint pubblico:"
echo "--------------------------"
curl -s http://127.0.0.1:3001/api/central/check-email -X POST -H "Content-Type: application/json" -d '{"email":"test@test.com"}' | head -3
echo ""

echo "✅ Diagnostica completata!"

