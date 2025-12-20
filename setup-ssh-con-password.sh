#!/bin/bash
# Script per configurare SSH usando la password (una sola volta)

set -e

echo "🔑 Configurazione SSH con Password"
echo "==================================="
echo ""
echo "Questo script si connetterà al VPS usando la password"
echo "e configurerà automaticamente la chiave SSH."
echo ""

VPS_HOST="128.140.84.82"
VPS_USER="root"
KEY_FILE="$HOME/.ssh/id_rsa_meeq_vps.pub"

if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Chiave SSH non trovata: $KEY_FILE"
    exit 1
fi

echo "📋 Chiave pubblica da installare:"
cat "$KEY_FILE"
echo ""
echo ""

# Leggi la chiave pubblica
PUBLIC_KEY=$(cat "$KEY_FILE")

echo "⚠️  IMPORTANTE: Ti verrà chiesta la password del VPS"
echo "   (la inserirai una sola volta, poi useremo la chiave SSH)"
echo ""

# Connettiti e configura la chiave
ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" bash <<EOF
    # Crea directory .ssh se non esiste
    mkdir -p ~/.ssh
    chmod 700 ~/.ssh
    
    # Verifica se la chiave esiste già
    if grep -q "$(echo "$PUBLIC_KEY" | cut -d' ' -f2)" ~/.ssh/authorized_keys 2>/dev/null; then
        echo "⚠️  Chiave già presente in authorized_keys"
    else
        # Aggiungi la chiave
        echo "$PUBLIC_KEY" >> ~/.ssh/authorized_keys
        echo "✅ Chiave aggiunta a ~/.ssh/authorized_keys"
    fi
    
    # Imposta permessi corretti
    chmod 600 ~/.ssh/authorized_keys
    chmod 700 ~/.ssh
    
    echo "✅ Configurazione completata!"
    echo ""
    echo "📋 Contenuto authorized_keys:"
    cat ~/.ssh/authorized_keys
EOF

echo ""
echo "================================================"
echo "✅ Setup completato!"
echo ""
echo "🔍 Test connessione senza password..."
if ssh -o ConnectTimeout=5 -o BatchMode=yes meeq-vps "echo '✅ Connessione SSH funzionante!'" 2>/dev/null; then
    echo "🎉 Perfetto! Ora puoi connetterti senza password:"
    echo "   ssh meeq-vps"
else
    echo "⚠️  La connessione potrebbe richiedere ancora la password."
    echo "   Prova manualmente: ssh meeq-vps"
fi
echo ""










