#!/bin/bash

# Script di installazione Meeq Systemd Service
# Autore: Claude Assistant
# Data: 07/11/2025

set -e  # Exit on error

echo "═══════════════════════════════════════"
echo "  INSTALLAZIONE MEEQ SYSTEMD SERVICE"
echo "═══════════════════════════════════════"
echo ""

# Verifica utente root/sudo
if [ "$EUID" -ne 0 ]; then 
   echo "❌ Questo script deve essere eseguito con sudo"
   echo "   Usa: sudo bash install_service.sh"
   exit 1
fi

# Verifica che il file service esista
if [ ! -f "meeq.service" ]; then
    echo "❌ File meeq.service non trovato nella directory corrente"
    exit 1
fi

echo "📋 STEP 1: Ferma il server se in esecuzione..."
# Ferma tutti i processi node in esecuzione
if pgrep -u meeq node > /dev/null; then
    echo "   → Processo node trovato, termino..."
    pkill -u meeq node || true
    sleep 2
    echo "   ✅ Server fermato"
else
    echo "   → Nessun processo node in esecuzione"
fi

echo ""
echo "📋 STEP 2: Copia file service in /etc/systemd/system/..."
cp meeq.service /etc/systemd/system/meeq.service
chmod 644 /etc/systemd/system/meeq.service
echo "   ✅ File copiato"

echo ""
echo "📋 STEP 3: Reload systemd daemon..."
systemctl daemon-reload
echo "   ✅ Daemon ricaricato"

echo ""
echo "📋 STEP 4: Abilita servizio all'avvio..."
systemctl enable meeq.service
echo "   ✅ Servizio abilitato"

echo ""
echo "📋 STEP 5: Avvia servizio..."
systemctl start meeq.service
echo "   ✅ Servizio avviato"

echo ""
echo "📋 STEP 6: Verifica stato..."
sleep 2
if systemctl is-active --quiet meeq.service; then
    echo "   ✅ Servizio ATTIVO e funzionante!"
else
    echo "   ❌ Servizio NON attivo - controlla i log:"
    echo "      sudo journalctl -u meeq -n 50"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════"
echo "  ✅ INSTALLAZIONE COMPLETATA!"
echo "═══════════════════════════════════════"
echo ""
echo "📊 STATO SERVIZIO:"
systemctl status meeq.service --no-pager | head -10
echo ""
echo "🎯 COMANDI UTILI:"
echo "   Stato:    sudo systemctl status meeq"
echo "   Ferma:    sudo systemctl stop meeq"
echo "   Avvia:    sudo systemctl start meeq"
echo "   Riavvia:  sudo systemctl restart meeq"
echo "   Log live: sudo journalctl -u meeq -f"
echo "   Log oggi: sudo journalctl -u meeq --since today"
echo ""
echo "🚀 Il server si avvierà automaticamente all'avvio del Raspberry Pi!"
echo ""
