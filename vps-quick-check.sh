#!/bin/bash
# Check rapido VPS - Versione semplificata

echo "🔍 Check Rapido VPS"
echo "==================="
echo ""

# Node.js
echo -n "Node.js: "
if command -v node &> /dev/null; then
    echo "✅ $(node --version)"
else
    echo "❌ NON installato"
fi

# Nginx
echo -n "Nginx: "
if command -v nginx &> /dev/null; then
    echo "✅ $(nginx -v 2>&1 | cut -d'/' -f2)"
    echo "   Configurazioni: $(ls /etc/nginx/sites-enabled/ 2>/dev/null | wc -l) attive"
else
    echo "❌ NON installato"
fi

# Porte Node.js
echo -n "Porte Node.js in uso: "
PORTS=$(sudo netstat -tlnp 2>/dev/null | grep node | awk '{print $4}' | cut -d':' -f2 | sort -u | tr '\n' ',' || \
        ss -tlnp 2>/dev/null | grep node | awk '{print $4}' | cut -d':' -f2 | sort -u | tr '\n' ',')
if [ -z "$PORTS" ]; then
    echo "nessuna"
else
    echo "$PORTS"
fi

# Firewall
echo -n "Firewall: "
if command -v ufw &> /dev/null; then
    echo "✅ UFW - $(sudo ufw status | head -1 | cut -d' ' -f2)"
elif command -v firewall-cmd &> /dev/null; then
    echo "✅ firewalld"
elif iptables -L > /dev/null 2>&1; then
    echo "✅ iptables"
else
    echo "⚠️ Non rilevato"
fi

# SSL
echo -n "Let's Encrypt: "
if [ -d "/etc/letsencrypt" ]; then
    echo "✅ $(sudo ls /etc/letsencrypt/live/ 2>/dev/null | wc -l) certificati"
else
    echo "❌ NON installato"
fi

# IP
echo -n "IP Pubblico: "
IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "Non rilevato")
echo "$IP"

# Utente
echo "Utente: $(whoami)"
echo "Home: $HOME"

echo ""
echo "✅ Check completato!"

