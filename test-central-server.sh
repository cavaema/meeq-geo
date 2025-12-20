#!/bin/bash
# Test server centrale

echo "🧪 Test Server Centrale Meeq"
echo "============================"
echo ""

# Test endpoint
echo "1. Test endpoint API:"
echo "---------------------"
curl -s http://localhost:3001/api/central/admin/stats 2>&1 | head -5
echo ""

# Test dashboard
echo "2. Test dashboard (HTTP status):"
echo "--------------------------------"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3001/central-admin.html
echo ""

# Test porta in ascolto
echo "3. Porta 3001 in ascolto:"
echo "-------------------------"
netstat -tlnp 2>/dev/null | grep 3001 || ss -tlnp 2>/dev/null | grep 3001
echo ""

# Test processo
echo "4. Processo Node.js:"
echo "-------------------"
ps aux | grep "central-server.js" | grep -v grep
echo ""

# Test database
echo "5. Database:"
echo "------------"
if [ -f "/opt/meeq-central/central.db" ]; then
    echo "✅ central.db presente ($(du -h /opt/meeq-central/central.db | cut -f1))"
else
    echo "⚠️ central.db non trovato"
fi
echo ""

echo "✅ Test completato!"

