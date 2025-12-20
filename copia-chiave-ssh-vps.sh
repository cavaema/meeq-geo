#!/bin/bash
# Script per copiare la chiave SSH sul VPS
# Questo script tenta di copiare la chiave usando ssh-copy-id

set -e

echo "🔑 Copia chiave SSH sul VPS"
echo "============================"
echo ""

KEY_FILE="$HOME/.ssh/id_rsa_meeq_vps.pub"
VPS_HOST="128.140.84.82"
VPS_USER="root"

if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Chiave SSH non trovata: $KEY_FILE"
    exit 1
fi

echo "📋 Chiave pubblica da copiare:"
cat "$KEY_FILE"
echo ""
echo ""

echo "⚠️  IMPORTANTE: Per copiare la chiave sul VPS, hai due opzioni:"
echo ""
echo "OPZIONE 1: Se conosci la password del VPS"
echo "------------------------------------------"
echo "Esegui questo comando e inserisci la password quando richiesto:"
echo ""
echo "  ssh-copy-id -i $KEY_FILE $VPS_USER@$VPS_HOST"
echo ""
echo "OPZIONE 2: Se hai accesso al pannello di controllo Hetzner"
echo "-----------------------------------------------------------"
echo "1. Accedi al pannello Hetzner Cloud"
echo "2. Vai al tuo server VPS"
echo "3. Apri 'Access' → 'SSH Keys'"
echo "4. Aggiungi questa chiave pubblica:"
echo ""
cat "$KEY_FILE"
echo ""
echo "OPZIONE 3: Copia manualmente sul VPS"
echo "-------------------------------------"
echo "1. Connettiti al VPS (anche via console web se disponibile)"
echo "2. Esegui questi comandi sul VPS:"
echo ""
echo "   mkdir -p ~/.ssh"
echo "   chmod 700 ~/.ssh"
echo "   echo '$(cat $KEY_FILE)' >> ~/.ssh/authorized_keys"
echo "   chmod 600 ~/.ssh/authorized_keys"
echo ""
echo "OPZIONE 4: Prova automaticamente (richiede password)"
echo "----------------------------------------------------"
read -p "Vuoi provare a copiare automaticamente la chiave? (s/n): " response
if [[ "$response" =~ ^[Ss]$ ]]; then
    echo ""
    echo "🔄 Tentativo di copia automatica..."
    ssh-copy-id -i "$KEY_FILE" "$VPS_USER@$VPS_HOST" || {
        echo ""
        echo "❌ Copia automatica fallita. Usa una delle opzioni manuali sopra."
        exit 1
    }
    echo ""
    echo "✅ Chiave copiata con successo!"
    echo ""
    echo "🔍 Test connessione..."
    ssh -o ConnectTimeout=5 meeq-vps "echo '✅ Connessione SSH funzionante!'" && {
        echo ""
        echo "🎉 Setup completato! Ora puoi connetterti senza password:"
        echo "   ssh meeq-vps"
    }
fi










