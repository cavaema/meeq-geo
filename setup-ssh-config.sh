#!/bin/bash
# Script per configurare SSH per il workspace remoto MEEQ

set -e

echo "🔧 Configurazione SSH per Workspace Remoto MEEQ"
echo "================================================"
echo ""

# Crea directory .ssh se non esiste
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# File di configurazione SSH
SSH_CONFIG="$HOME/.ssh/config"

# Backup configurazione esistente
if [ -f "$SSH_CONFIG" ]; then
    echo "📋 Backup configurazione SSH esistente..."
    cp "$SSH_CONFIG" "$SSH_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Verifica se la configurazione esiste già
if grep -q "Host meeq-vps" "$SSH_CONFIG" 2>/dev/null; then
    echo "⚠️  Configurazione 'meeq-vps' già presente in $SSH_CONFIG"
    echo "   Vuoi sovrascriverla? (s/n)"
    read -r response
    if [[ ! "$response" =~ ^[Ss]$ ]]; then
        echo "❌ Configurazione non modificata."
        exit 0
    fi
    # Rimuovi la configurazione esistente
    sed -i '/^Host meeq-vps$/,/^$/d' "$SSH_CONFIG"
fi

# Aggiungi configurazione
echo "" >> "$SSH_CONFIG"
echo "# Server VPS MEEQ (Centrale)" >> "$SSH_CONFIG"
echo "Host meeq-vps" >> "$SSH_CONFIG"
echo "    HostName 128.140.84.82" >> "$SSH_CONFIG"
echo "    User root" >> "$SSH_CONFIG"
echo "    Port 22" >> "$SSH_CONFIG"
echo "" >> "$SSH_CONFIG"

chmod 600 "$SSH_CONFIG"

echo "✅ Configurazione SSH aggiunta a $SSH_CONFIG"
echo ""

# Test connessione
echo "🔍 Test connessione SSH..."
if ssh -o ConnectTimeout=5 -o BatchMode=yes meeq-vps exit 2>/dev/null; then
    echo "✅ Connessione SSH funzionante (chiave SSH configurata)"
    SSH_WORKING=true
else
    echo "⚠️  Connessione SSH richiede password o chiave non configurata"
    echo ""
    echo "Vuoi configurare l'autenticazione con chiave SSH? (s/n)"
    read -r response
    if [[ "$response" =~ ^[Ss]$ ]]; then
        echo ""
        echo "🔑 Configurazione chiave SSH..."
        
        # Verifica se esiste già una chiave
        if [ -f "$HOME/.ssh/id_rsa" ]; then
            echo "📋 Chiave SSH esistente trovata: ~/.ssh/id_rsa"
            echo "   Vuoi usare questa chiave? (s/n)"
            read -r use_existing
            if [[ "$use_existing" =~ ^[Ss]$ ]]; then
                KEY_FILE="$HOME/.ssh/id_rsa.pub"
            else
                KEY_FILE="$HOME/.ssh/id_rsa_vps.pub"
                if [ ! -f "$HOME/.ssh/id_rsa_vps" ]; then
                    echo "🔑 Generazione nuova chiave SSH..."
                    ssh-keygen -t rsa -b 4096 -f "$HOME/.ssh/id_rsa_vps" -N ""
                fi
            fi
        else
            echo "🔑 Generazione nuova chiave SSH..."
            ssh-keygen -t rsa -b 4096 -f "$HOME/.ssh/id_rsa_vps" -N ""
            KEY_FILE="$HOME/.ssh/id_rsa_vps.pub"
        fi
        
        echo ""
        echo "📤 Copia della chiave pubblica sul VPS..."
        echo "   Ti verrà chiesta la password del VPS"
        ssh-copy-id -i "$KEY_FILE" root@128.140.84.82
        
        # Se usi chiave specifica, aggiungila alla config
        if [ "$KEY_FILE" = "$HOME/.ssh/id_rsa_vps.pub" ]; then
            sed -i '/Host meeq-vps/a\    IdentityFile ~/.ssh/id_rsa_vps' "$SSH_CONFIG"
        fi
        
        echo ""
        echo "✅ Chiave SSH configurata!"
        SSH_WORKING=true
    else
        SSH_WORKING=false
    fi
fi

echo ""
echo "================================================"
if [ "$SSH_WORKING" = true ]; then
    echo "✅ Setup completato!"
    echo ""
    echo "📝 Prossimi passi:"
    echo "   1. Apri Cursor"
    echo "   2. File → Open Workspace from File..."
    echo "   3. Seleziona: /home/meeq/meeq/meeq-remote.code-workspace"
    echo "   4. Cursor si connetterà automaticamente al VPS"
else
    echo "⚠️  Setup SSH base completato"
    echo ""
    echo "📝 Prossimi passi:"
    echo "   1. Testa la connessione: ssh meeq-vps"
    echo "   2. Se funziona, apri il workspace in Cursor"
    echo "   3. Cursor ti chiederà la password quando necessario"
fi
echo ""










