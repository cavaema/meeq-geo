#!/bin/bash
# Script per inizializzare Git sul VPS
# Eseguire sul VPS

set -e

echo "🔧 Inizializzazione Git - Meeq Central"
echo "======================================"
echo ""

# Verifica che Git sia installato
if ! command -v git &> /dev/null; then
    echo "📦 Installazione Git..."
    apt update
    apt install -y git
fi

# Vai alla directory del progetto
cd /opt/meeq-central

# Verifica se già inizializzato
if [ -d ".git" ]; then
    echo "⚠️  Repository Git già inizializzato"
    read -p "Vuoi re-inizializzare? (s/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        echo "✅ Mantenuto repository esistente"
        exit 0
    fi
    echo "🗑️  Rimozione repository esistente..."
    rm -rf .git
fi

# Inizializza Git
echo "📦 Inizializzazione repository Git..."
git init

# Configura Git (se non già configurato)
if [ -z "$(git config --global user.name)" ]; then
    echo ""
    echo "📝 Configurazione Git (prima volta)"
    read -p "Nome utente Git: " GIT_NAME
    read -p "Email Git: " GIT_EMAIL
    git config --global user.name "$GIT_NAME"
    git config --global user.email "$GIT_EMAIL"
fi

# Aggiungi .gitignore se non esiste
if [ ! -f ".gitignore" ]; then
    echo "📄 Creazione .gitignore..."
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*

# Database files
*.db
*.db.backup
*.db.old
*.db.OLD

# Logs
*.log
*.log.*

# Environment variables
.env
.env.local
.env.*.local

# Backups
backups/
*.backup
*.BACKUP
*.old
*.OLD

# OS files
.DS_Store
Thumbs.db
*.swp
*.swo
*~

# IDE
.vscode/
.idea/
*.code-workspace

# SSH keys
*.pem
*.key
id_rsa*
id_ed25519*
*.pub

# Temporary files
tmp/
temp/
*.tmp

# Service files
*.service

# Build files
dist/
build/
EOF
fi

# Aggiungi tutti i file
echo "📤 Aggiunta file al repository..."
git add .

# Prima commit
echo "💾 Creazione commit iniziale..."
git commit -m "Initial commit - Meeq Central Server" || {
    echo "⚠️  Nessun file da committare (tutti ignorati?)"
    exit 0
}

echo ""
echo "✅ Repository Git inizializzato!"
echo ""
echo "📝 Prossimi passi:"
echo "   1. Crea repository su GitHub/GitLab: meeq-central"
echo "   2. Aggiungi remote:"
echo "      git remote add origin https://github.com/TUO-USERNAME/meeq-central.git"
echo "   3. Push iniziale:"
echo "      git branch -M main"
echo "      git push -u origin main"
echo ""

