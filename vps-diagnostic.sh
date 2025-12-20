#!/bin/bash
# Script di diagnostica VPS - Eseguire sul VPS per raccogliere informazioni
# Copia questo script sul VPS ed eseguilo: bash vps-diagnostic.sh

echo "🔍 Diagnostica Configurazione VPS"
echo "==================================="
echo ""

# Informazioni sistema
echo "📊 INFORMAZIONI SISTEMA"
echo "-----------------------"
echo "OS: $(lsb_release -d 2>/dev/null | cut -f2 || cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo "Kernel: $(uname -r)"
echo "Architettura: $(uname -m)"
echo "Hostname: $(hostname)"
echo "IP Pubblico: $(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo 'Non rilevato')"
echo ""

# Node.js
echo "📦 NODE.JS"
echo "----------"
if command -v node &> /dev/null; then
    echo "✅ Node.js installato: $(node --version)"
    echo "✅ npm installato: $(npm --version)"
    echo "Percorso: $(which node)"
else
    echo "❌ Node.js NON installato"
fi
echo ""

# Nginx
echo "🌐 NGINX"
echo "--------"
if command -v nginx &> /dev/null; then
    echo "✅ Nginx installato: $(nginx -v 2>&1)"
    echo "Percorso: $(which nginx)"
    echo ""
    echo "Stato servizio:"
    systemctl status nginx --no-pager | head -3
    echo ""
    echo "Configurazioni attive:"
    ls -la /etc/nginx/sites-enabled/ 2>/dev/null | grep -v "^total" | awk '{print $9, $10, $11}'
    echo ""
    echo "Porte in ascolto (nginx):"
    sudo netstat -tlnp 2>/dev/null | grep nginx || ss -tlnp 2>/dev/null | grep nginx || echo "Nessuna porta nginx rilevata"
else
    echo "❌ Nginx NON installato"
fi
echo ""

# Porte utilizzate
echo "🔌 PORTE IN UTILIZZO"
echo "--------------------"
echo "Porte TCP in ascolto:"
sudo netstat -tlnp 2>/dev/null | grep LISTEN | awk '{print $4, $7}' | sort -u || \
ss -tlnp 2>/dev/null | grep LISTEN | awk '{print $4, $6}' | sort -u || \
echo "Comando non disponibile"
echo ""

# Processi Node.js
echo "🟢 PROCESSI NODE.JS"
echo "-------------------"
if pgrep -x node > /dev/null; then
    echo "Processi Node.js attivi:"
    ps aux | grep node | grep -v grep
    echo ""
    echo "Porte usate da Node.js:"
    sudo netstat -tlnp 2>/dev/null | grep node | awk '{print $4}' || \
    ss -tlnp 2>/dev/null | grep node | awk '{print $4}' || \
    echo "Nessuna porta rilevata"
else
    echo "❌ Nessun processo Node.js attivo"
fi
echo ""

# Firewall
echo "🔥 FIREWALL"
echo "-----------"
if command -v ufw &> /dev/null; then
    echo "✅ UFW installato"
    echo "Stato: $(sudo ufw status | head -1)"
    echo "Regole attive:"
    sudo ufw status numbered 2>/dev/null | head -20
elif command -v firewall-cmd &> /dev/null; then
    echo "✅ firewalld installato"
    echo "Stato: $(sudo firewall-cmd --state 2>/dev/null)"
elif iptables -L > /dev/null 2>&1; then
    echo "✅ iptables attivo"
    echo "Regole INPUT:"
    sudo iptables -L INPUT -n --line-numbers | head -10
else
    echo "⚠️ Nessun firewall rilevato o non accessibile"
fi
echo ""

# Directory e permessi
echo "📁 DIRECTORY E PERMESSI"
echo "----------------------"
echo "Directory home: $HOME"
echo "Utente corrente: $(whoami)"
echo "Gruppi utente: $(groups)"
echo ""
echo "Directory comuni per applicazioni:"
for dir in /opt /var/www /home /srv; do
    if [ -d "$dir" ]; then
        echo "  $dir: $(ls -ld $dir | awk '{print $1, $3, $4}')"
    fi
done
echo ""

# SSL/Let's Encrypt
echo "🔒 SSL/CERTIFICATI"
echo "------------------"
if [ -d "/etc/letsencrypt" ]; then
    echo "✅ Let's Encrypt installato"
    echo "Certificati disponibili:"
    sudo ls -la /etc/letsencrypt/live/ 2>/dev/null | grep "^d" | awk '{print $9}' || echo "Nessun certificato trovato"
else
    echo "❌ Let's Encrypt non trovato"
fi
echo ""

# Servizi systemd
echo "⚙️ SERVIZI SYSTEMD"
echo "------------------"
echo "Servizi Node.js attivi:"
systemctl list-units --type=service --state=running | grep -i node || echo "Nessun servizio Node.js trovato"
echo ""
echo "Servizi nginx:"
systemctl list-units --type=service | grep nginx || echo "Nginx non trovato"
echo ""

# Spazio disco
echo "💾 SPAZIO DISCO"
echo "---------------"
df -h / | tail -1
echo ""

# Memoria
echo "🧠 MEMORIA"
echo "----------"
free -h
echo ""

# Domini configurati
echo "🌍 DOMINI/IP CONFIGURATI"
echo "------------------------"
if [ -f "/etc/hosts" ]; then
    echo "File /etc/hosts:"
    cat /etc/hosts | grep -v "^#" | grep -v "^$" | head -10
fi
echo ""

# Variabili d'ambiente Node.js
echo "🔧 VARIABILI D'AMBIENTE"
echo "-----------------------"
echo "NODE_ENV: ${NODE_ENV:-non impostato}"
echo "PORT: ${PORT:-non impostato}"
echo ""

echo "==================================="
echo "✅ Diagnostica completata!"
echo ""
echo "📋 Prossimi passi:"
echo "   1. Copia l'output di questo script"
echo "   2. Inviarlo per la configurazione personalizzata"
echo ""

