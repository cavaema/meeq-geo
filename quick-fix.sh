#!/bin/bash
# 🔧 FIX RAPIDO PER ERRORE HTML INVECE DI JSON
# =============================================

echo "🔧 FIX RAPIDO ERRORE JSON"
echo "========================="
echo ""

# 1. Verifica che l'API funzioni
echo "1️⃣ Test API dal server..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/check-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}')

if echo "$RESPONSE" | grep -q "exists"; then
    echo "   ✅ API funziona correttamente: $RESPONSE"
else
    echo "   ❌ API non funziona!"
    echo "   Riavvia il server: pm2 restart meeq"
    exit 1
fi

# 2. Copia la pagina di test
echo ""
echo "2️⃣ Installo pagina di test..."
cp test-api.html ~/meeq/public/test-api.html
echo "   ✅ Pagina di test installata"

# 3. Fix del frontend
echo ""
echo "3️⃣ Applico fix al frontend..."

# Backup
cp ~/meeq/public/index.html ~/meeq/public/index-backup-$(date +%s).html

# Applica fix all'API_URL
if grep -q "const API_URL = '/api'" ~/meeq/public/index.html; then
    echo "   Modifico API_URL..."
    sed -i "s|const API_URL = '/api';|const API_URL = window.location.origin + '/api';|g" ~/meeq/public/index.html
    echo "   ✅ API_URL modificato"
else
    echo "   ⚠️  API_URL non trovato o già modificato"
fi

# 4. Riavvia
echo ""
echo "4️⃣ Riavvio server..."
pm2 restart meeq
sleep 2

# 5. Test finale
echo ""
echo "5️⃣ Test finale..."
FINAL_TEST=$(curl -s -X POST http://172.16.0.10:3000/api/check-email \
  -H "Content-Type: application/json" \
  -d '{"email":"final@test.com"}')

if echo "$FINAL_TEST" | grep -q "exists"; then
    echo "   ✅ API risponde correttamente!"
else
    echo "   ❌ Ancora problemi"
fi

echo ""
echo "========================="
echo "✅ FIX COMPLETATO!"
echo "========================="
echo ""
echo "📱 ORA TESTA:"
echo ""
echo "1. Pagina di test (più semplice):"
echo "   http://172.16.0.10:3000/test-api.html"
echo ""
echo "2. App completa:"
echo "   http://172.16.0.10:3000"
echo ""
echo "3. Apri la console del browser (F12) per vedere i log"
echo ""
echo "Se la pagina di test funziona ma l'app no,"
echo "sostituisci index.html con index-FIXED-v2.html"
