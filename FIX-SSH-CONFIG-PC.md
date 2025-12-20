# Fix SSH Config sul PC

## Problema
Il file `~/.ssh/config` sul PC manca della configurazione per `meeq-pi`.

## Soluzione

### 1. Apri il file config SSH sul PC

**Su Windows (PowerShell):**
```powershell
notepad C:\Users\ec\.ssh\config
```

**Oppure da Cursor (quando sei sul PC locale, NON via SSH):**
- Apri il file: `C:\Users\ec\.ssh\config`

### 2. Aggiungi questa configurazione

Il file deve contenere ENTRAMBE le configurazioni:

```ssh-config
Host meeq-pi
    HostName 172.16.0.10
    User meeq
    Port 22
    IdentityFile C:\Users\ec\.ssh\id_raspberry
    IdentitiesOnly yes

Host meeq-vps
    HostName 128.140.84.82
    User root
    Port 22
    IdentityFile C:\Users\ec\.ssh\id_ed25519
    IdentitiesOnly yes
```

**NOTA:** 
- Per `meeq-pi`: usa `id_raspberry` (la chiave che hai per il Raspberry Pi)
- Per `meeq-vps`: usa `id_ed25519` (la chiave per il VPS)

### 3. Verifica le connessioni

Apri PowerShell sul PC e testa:

```powershell
# Test Raspberry Pi
ssh meeq-pi "echo 'Raspberry Pi OK'"

# Test VPS
ssh meeq-vps "echo 'VPS OK'"
```

### 4. Apri il workspace

1. **CHIUDI questa finestra di Cursor** (quella connessa al Raspberry Pi)
2. **Apri una NUOVA finestra di Cursor sul PC locale** (File → New Window)
3. **File → Open Workspace from File...**
4. **Seleziona `meeq-remote.code-workspace`** (dal PC locale, non dal Raspberry Pi)

Se il file workspace non è sul PC, copialo:
```powershell
scp meeq@172.16.0.10:/home/meeq/meeq/meeq-remote.code-workspace G:\Il\ mio\ Drive\JOB\PROGETTI\meeq\
```

## IMPORTANTE

**Non puoi aprire il workspace multi-remote se sei già connesso in SSH in quella finestra!**

Devi:
- Chiudere la finestra connessa al Raspberry Pi
- Aprire una nuova finestra locale sul PC
- Poi aprire il workspace multi-remote

