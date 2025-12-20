#!/bin/bash
# Script setup Cloudflare Tunnel per Meeq locale
# Uso: sudo bash setup-cloudflare-tunnel.sh <TUNNEL_TOKEN>

set -e

if [ "$EUID" -ne 0 ]; then 
   echo "❌ Questo script deve essere eseguito con sudo"
   echo "   Usa: sudo bash setup-cloudflare-tunnel.sh <TUNNEL_TOKEN>"
   exit 1
fi

if [ -z "$1" ]; then
    echo "❌ Token tunnel richiesto"
    echo "   Uso: sudo bash setup-cloudflare-tunnel.sh <TUNNEL_TOKEN>"
    echo ""
    echo "   Per ottenere il token:"
    echo "   1. Vai su Cloudflare Dashboard → Zero Trust → Networks → Tunnels"
    echo "   2. Crea un tunnel (nome: venue-01)"
    echo "   3. Copia il token/comando che Cloudflare ti fornisce"
    exit 1
fi

TUNNEL_TOKEN="$1"
TUNNEL_NAME="venue-01"

echo "═══════════════════════════════════════"
echo "  SETUP CLOUDFLARE TUNNEL"
echo "═══════════════════════════════════════"
echo ""

echo "📋 STEP 1: Installa tunnel con token..."
cloudflared service install "$TUNNEL_TOKEN"

echo ""
echo "📋 STEP 2: Verifica configurazione tunnel..."
if [ -f /etc/cloudflared/config.yml ]; then
    echo "✅ Config trovata: /etc/cloudflared/config.yml"
    cat /etc/cloudflared/config.yml
else
    echo "⚠️ Config non trovata, potrebbe essere in ~/.cloudflared/"
    echo "   Verifica manualmente la configurazione del tunnel"
fi

echo ""
echo "📋 STEP 3: Avvia servizio tunnel..."
systemctl enable cloudflared
systemctl restart cloudflared

echo ""
echo "📋 STEP 4: Verifica stato..."
sleep 2
if systemctl is-active --quiet cloudflared; then
    echo "✅ Tunnel ATTIVO!"
    systemctl status cloudflared --no-pager | head -10
else
    echo "❌ Tunnel NON attivo - controlla i log:"
    echo "   sudo journalctl -u cloudflared -n 50"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════"
echo "  ✅ SETUP COMPLETATO!"
echo "═══════════════════════════════════════"
echo ""
echo "🎯 PROSSIMI PASSI:"
echo "   1. Vai su Cloudflare → Zero Trust → Tunnels"
echo "   2. Configura il routing del tunnel:"
echo "      - Hostname: venue-01-api.meeq.it (o nome che preferisci)"
echo "      - Service: http://localhost:3000"
echo "   3. Aggiorna /etc/meeq/meeq.env:"
echo "      LOCAL_API_BASE_URL=https://venue-01-api.meeq.it"
echo "   4. Riavvia meeq: sudo systemctl restart meeq"
echo ""


