# Setup Workspace Remoto MEEQ

Questo documento spiega come configurare Cursor per sviluppare sia sul server locale (Raspberry Pi) che sul server remoto (VPS) nella stessa finestra.

## Prerequisiti

1. **Estensione Remote SSH** (già inclusa in Cursor)
2. **Accesso SSH al VPS** configurato

## Passo 1: Configura SSH

Crea/modifica il file `~/.ssh/config`:

```bash
mkdir -p ~/.ssh
nano ~/.ssh/config
```

Aggiungi questa configurazione:

```
# Server VPS (Centrale)
Host meeq-vps
    HostName 128.140.84.82
    User root
    Port 22
    # Se usi chiavi SSH specifiche:
    # IdentityFile ~/.ssh/id_rsa_vps
```

**Nota**: Se non hai ancora configurato l'autenticazione SSH senza password, puoi:
- Usare password (Cursor la chiederà)
- Configurare chiavi SSH (consigliato per produzione)

### Configurazione chiavi SSH (opzionale ma consigliato):

```bash
# Genera chiave SSH (se non ce l'hai già)
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_vps

# Copia la chiave pubblica sul VPS
ssh-copy-id -i ~/.ssh/id_rsa_vps.pub root@128.140.84.82
```

## Passo 2: Testa la connessione SSH

```bash
ssh meeq-vps
```

Se funziona, esci con `exit`.

## Passo 3: Apri il workspace remoto

1. In Cursor, vai su **File → Open Workspace from File...**
2. Seleziona `/home/meeq/meeq/meeq-remote.code-workspace`
3. Cursor ti chiederà di connetterti al VPS → clicca **Connect**
4. Se richiesto, inserisci la password SSH o seleziona la chiave SSH

## Passo 4: Verifica

Dovresti vedere nella sidebar due cartelle:

- **🖥️ Server Locale (Raspberry Pi)**
  - `server.js` (server locale)
  - `public/index.html` (PWA locale)
  - Altri file locali

- **☁️ Server VPS (Centrale)**
  - `central-server.js` (server centrale)
  - `public/app.html` (PWA centrale)
  - Altri file del VPS

## Vantaggi

✅ **Tutto in una finestra**: Vedi e modifichi entrambi i server  
✅ **Sincronizzazione automatica**: Le modifiche sono immediate  
✅ **Ricerca globale**: Cerca in tutti i file di entrambi i server  
✅ **Terminali multipli**: Puoi aprire terminali su entrambi i server  
✅ **Git unificato**: Gestisci commit su entrambi i repository  

## Terminali multipli

Puoi aprire terminali su entrambi i server:

1. **Terminale locale**: `Ctrl+Shift+` ` (o View → Terminal)
2. **Terminale VPS**: Clicca destro sulla cartella "Server VPS" → "Open in Integrated Terminal"

## Troubleshooting

### Errore: "Could not establish connection to 'meeq-vps'"

**Soluzione**: Verifica la configurazione SSH:
```bash
ssh meeq-vps
```

### Errore: "Permission denied (publickey)"

**Soluzione**: Configura l'autenticazione SSH (vedi Passo 1)

### Il workspace non si connette automaticamente

**Soluzione**: 
1. Vai su **View → Command Palette** (`Ctrl+Shift+P`)
2. Cerca "Remote-SSH: Connect to Host"
3. Seleziona "meeq-vps"

### Non vedo i file del VPS

**Soluzione**: Verifica che la directory sul VPS sia `/opt/meeq-central`. Se è diversa, modifica `meeq-remote.code-workspace`:
```json
"uri": "vscode-remote://ssh-remote+meeq-vps/PATH/CORRETTO"
```

## Modifiche ai file

- **File locali**: Modifiche immediate, nessun trasferimento necessario
- **File VPS**: Modifiche immediate via SSH, nessun `scp` necessario!

## Riavvio servizi

Dopo modifiche ai file, riavvia i servizi:

**Server locale**:
```bash
sudo systemctl restart meeq
```

**Server VPS** (dal terminale VPS in Cursor):
```bash
sudo systemctl restart meeq-central
```

## Prossimi passi

Ora puoi:
1. Modificare `server.js` e `central-server.js` nella stessa finestra
2. Testare le modifiche su entrambi i server
3. Sviluppare senza dover trasferire file manualmente










