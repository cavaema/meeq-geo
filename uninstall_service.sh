#!/bin/bash

# Script di disinstallazione Meeq Systemd Service
# Autore: Claude Assistant
# Data: 07/11/2025

set -e

echo "═══════════════════════════════════════"
echo "  DISINSTALLAZIONE MEEQ SERVICE"
echo "═══════════════════════════════════════"
echo ""

# Verifica utente root/sudo
if [ "$EUID" -ne 0 ]; then 
   echo "❌ Questo script deve essere eseguito con sudo"
   echo "   Usa: sudo bash uninstall_service.sh"
   exit 1
fi

# Verifica che il servizio esista
if [ ! -f "/etc/systemd/system/meeq.service" ]; then
    echo "⚠️  Servizio meeq non installato"
    exit 0
fi

echo "📋 STEP 1: Ferma servizio..."
if systemctl is-active --quiet meeq.service; then
    systemctl stop meeq.service
    echo "   ✅ Servizio fermato"
else
    echo "   → Servizio già fermo"
fi

echo ""
echo "📋 STEP 2: Disabilita servizio dall'avvio..."
if systemctl is-enabled --quiet meeq.service; then
    systemctl disable meeq.service
    echo "   ✅ Servizio disabilitato"
else
    echo "   → Servizio già disabilitato"
fi

echo ""
echo "📋 STEP 3: Rimuovi file service..."
rm -f /etc/systemd/system/meeq.service
echo "   ✅ File rimosso"

echo ""
echo "📋 STEP 4: Reload systemd daemon..."
systemctl daemon-reload
systemctl reset-failed
echo "   ✅ Daemon ricaricato"

echo ""
echo "═══════════════════════════════════════"
echo "  ✅ DISINSTALLAZIONE COMPLETATA!"
echo "═══════════════════════════════════════"
echo ""
echo "💡 Per avviare il server manualmente:"
echo "   cd ~/meeq"
echo "   node server.js"
echo ""
