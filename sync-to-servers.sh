#!/bin/bash
# Script per sincronizzare le modifiche dal PC ai server
# Eseguire dal PC dopo git push

echo "🔄 Sincronizzazione Repository Meeq"
echo "===================================="
echo ""

# Colori
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Funzione per sincronizzare
sync_repo() {
    local REPO_NAME=$1
    local SERVER_HOST=$2
    local SERVER_PATH=$3
    local SERVER_USER=$4
    
    echo -e "${YELLOW}Sincronizzazione $REPO_NAME...${NC}"
    
    # Verifica che il repository esista localmente
    if [ ! -d "$REPO_NAME" ]; then
        echo -e "${RED}❌ Repository $REPO_NAME non trovato localmente${NC}"
        return 1
    fi
    
    cd "$REPO_NAME"
    
    # Verifica che ci siano modifiche da pushare
    if [ -z "$(git status --porcelain)" ] && [ -z "$(git log origin/main..HEAD 2>/dev/null)" ]; then
        echo -e "${GREEN}✅ Nessuna modifica da sincronizzare${NC}"
        cd ..
        return 0
    fi
    
    # Push al repository remoto (GitHub/GitLab)
    echo "  📤 Push a GitHub/GitLab..."
    if git push; then
        echo -e "${GREEN}  ✅ Push completato${NC}"
    else
        echo -e "${RED}  ❌ Errore durante push${NC}"
        cd ..
        return 1
    fi
    
    # Pull sul server
    echo "  📥 Pull sul server ($SERVER_HOST)..."
    if ssh "$SERVER_USER@$SERVER_HOST" "cd $SERVER_PATH && git pull"; then
        echo -e "${GREEN}  ✅ Pull completato sul server${NC}"
        
        # Riavvia servizio se necessario
        if [ "$REPO_NAME" = "meeq-local" ]; then
            echo "  🔄 Riavvio servizio meeq..."
            ssh "$SERVER_USER@$SERVER_HOST" "sudo systemctl restart meeq" 2>/dev/null || echo "  ⚠️  Servizio meeq non trovato o già in esecuzione"
        elif [ "$REPO_NAME" = "meeq-central" ]; then
            echo "  🔄 Riavvio servizio meeq-central..."
            ssh "$SERVER_USER@$SERVER_HOST" "sudo systemctl restart meeq-central" 2>/dev/null || echo "  ⚠️  Servizio meeq-central non trovato o già in esecuzione"
        fi
    else
        echo -e "${RED}  ❌ Errore durante pull sul server${NC}"
        cd ..
        return 1
    fi
    
    cd ..
    echo ""
    return 0
}

# Sincronizza repository locale (Raspberry Pi)
sync_repo "meeq-local" "172.16.0.10" "/home/meeq/meeq" "meeq"

# Sincronizza repository centrale (VPS)
sync_repo "meeq-central" "128.140.84.82" "/opt/meeq-central" "root"

echo -e "${GREEN}✅ Sincronizzazione completata!${NC}"

