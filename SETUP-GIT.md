# Setup Git per Meeq

Questa guida ti aiuta a configurare Git per lavorare su entrambe le repository (locale e centrale) dal PC con Cursor.

## Vantaggi

✅ **Lavori tutto dal PC locale** - nessun problema SSH multi-remote  
✅ **Sincronizzazione automatica** - push/pull tra PC e server  
✅ **Backup automatico** - tutto su GitHub/GitLab  
✅ **Storia completa** - vedi tutte le modifiche  

## Step 1: Crea Repository su GitHub/GitLab

1. Vai su GitHub/GitLab e crea **2 repository**:
   - `meeq-local` (per il server locale/Raspberry Pi)
   - `meeq-central` (per il server centrale/VPS)

2. **NON** inizializzare con README, .gitignore o licenza (li creiamo noi)

## Step 2: Installa Git sul Raspberry Pi

```bash
# Connettiti al Raspberry Pi
ssh meeq-pi

# Installa Git
sudo apt update
sudo apt install -y git

# Configura Git
git config --global user.name "Il Tuo Nome"
git config --global user.email "tua-email@example.com"
```

## Step 3: Installa Git sul VPS

```bash
# Connettiti al VPS
ssh meeq-vps

# Installa Git
apt update
apt install -y git

# Configura Git
git config --global user.name "Il Tuo Nome"
git config --global user.email "tua-email@example.com"
```

## Step 4: Inizializza Repository sul Raspberry Pi

```bash
# Sul Raspberry Pi
cd /home/meeq/meeq

# Inizializza Git
git init

# Aggiungi tutti i file (esclusi quelli in .gitignore)
git add .

# Prima commit
git commit -m "Initial commit - Meeq Local Server"

# Aggiungi remote GitHub/GitLab
git remote add origin https://github.com/TUO-USERNAME/meeq-local.git
# O se usi SSH:
# git remote add origin git@github.com:TUO-USERNAME/meeq-local.git

# Push iniziale
git branch -M main
git push -u origin main
```

## Step 5: Inizializza Repository sul VPS

```bash
# Sul VPS
cd /opt/meeq-central

# Inizializza Git
git init

# Aggiungi tutti i file
git add .

# Prima commit
git commit -m "Initial commit - Meeq Central Server"

# Aggiungi remote GitHub/GitLab
git remote add origin https://github.com/TUO-USERNAME/meeq-central.git
# O se usi SSH:
# git remote add origin git@github.com:TUO-USERNAME/meeq-central.git

# Push iniziale
git branch -M main
git push -u origin main
```

## Step 6: Clona sul PC Locale

Sul PC, apri PowerShell e clona entrambe le repository:

```powershell
cd "G:\Il mio Drive\JOB\PROGETTI\meeq"

# Clona repository locale
git clone https://github.com/TUO-USERNAME/meeq-local.git meeq-local

# Clona repository centrale
git clone https://github.com/TUO-USERNAME/meeq-central.git meeq-central
```

## Step 7: Apri Workspace in Cursor

1. Apri Cursor sul PC locale
2. File → Open Folder → seleziona la cartella `meeq` (che contiene entrambe le sottocartelle)
3. Oppure apri `meeq-git.code-workspace` (che creerò)

## Workflow Quotidiano

### Sviluppo sul PC

1. **Modifica i file** in Cursor sul PC
2. **Commit**:
   ```bash
   git add .
   git commit -m "Descrizione modifiche"
   git push
   ```
3. **Sul server** (Raspberry Pi o VPS):
   ```bash
   git pull
   # Riavvia il servizio se necessario
   sudo systemctl restart meeq  # o meeq-central
   ```

### Sviluppo diretto sul server

1. **Modifica i file** sul server (via SSH)
2. **Commit e push**:
   ```bash
   git add .
   git commit -m "Descrizione modifiche"
   git push
   ```
3. **Sul PC**:
   ```bash
   git pull
   ```

## Branch per Feature

Per sviluppare nuove feature senza rompere il codice in produzione:

```bash
# Crea nuovo branch
git checkout -b feature/nome-feature

# Sviluppa e committa
git add .
git commit -m "Aggiunta feature X"

# Push branch
git push -u origin feature/nome-feature

# Quando pronto, merge su main
git checkout main
git merge feature/nome-feature
git push
```

## File da NON committare

Il `.gitignore` esclude già:
- Database (`*.db`)
- Log (`*.log`)
- Chiavi SSH (`*.key`, `*.pem`)
- File di configurazione sensibili (`.env`)
- `node_modules/`

## Troubleshooting

### "Permission denied" su GitHub/GitLab

Se usi SSH, aggiungi la chiave SSH a GitHub/GitLab:
```bash
# Genera chiave SSH (se non ce l'hai)
ssh-keygen -t ed25519 -C "tua-email@example.com"

# Mostra chiave pubblica
cat ~/.ssh/id_ed25519.pub

# Copia e incolla su GitHub/GitLab → Settings → SSH Keys
```

### "Repository not found"

Verifica che:
- Il repository esista su GitHub/GitLab
- Tu abbia i permessi
- L'URL del remote sia corretto: `git remote -v`

### Conflitti durante pull

```bash
# Vedi i conflitti
git status

# Risolvi manualmente i file in conflitto, poi:
git add .
git commit -m "Risolti conflitti"
git push
```

