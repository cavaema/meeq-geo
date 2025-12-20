#!/bin/bash
# Fix conflitto porta 3001

echo "🔧 Fix Conflitto Porta 3001"
echo "==========================="
echo ""

# Nuova porta
NEW_PORT=3002

echo "⚠️ Porta 3001 occupata da Docker"
echo "📝 Cambio porta a $NEW_PORT"
echo ""

# Ferma servizio
systemctl stop meeq-central

# Modifica .env
sed -i "s/PORT=3001/PORT=$NEW_PORT/" /opt/meeq-central/.env

# Verifica modifica
echo "✅ Porta modificata in .env:"
grep PORT /opt/meeq-central/.env
echo ""

# Apri porta firewall
ufw allow $NEW_PORT/tcp
echo "✅ Porta $NEW_PORT aperta nel firewall"
echo ""

# Riavvia servizio
systemctl start meeq-central

# Attendi 2 secondi
sleep 2

# Verifica stato
echo "📊 Stato servizio:"
systemctl status meeq-central --no-pager | head -10
echo ""

# Verifica processo
echo "🔍 Processo Node.js:"
ps aux | grep "central-server.js" | grep -v grep || echo "❌ Processo non trovato"
echo ""

# Test endpoint
echo "🧪 Test endpoint:"
curl -s http://127.0.0.1:$NEW_PORT/api/central/admin/stats | head -3
echo ""

# Verifica porta
echo "🔌 Porta $NEW_PORT in ascolto:"
netstat -tlnp 2>/dev/null | grep $NEW_PORT || ss -tlnp 2>/dev/null | grep $NEW_PORT
echo ""

echo "✅ Fix completato!"
echo ""
echo "📍 Accesso Dashboard:"
IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo "   http://$IP:$NEW_PORT/central-admin.html"

