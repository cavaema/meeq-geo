# Diagnostica Workspace Multi-Remote

## Problema: Punto Esclamativo sulle Cartelle

Se entrambe le cartelle mostrano un punto esclamativo, significa che Cursor non riesce a connettersi ai server.

## Step 1: Test Connessioni SSH dal PC

Esegui questo script da PowerShell sul PC locale:

```powershell
cd "G:\Il mio Drive\JOB\PROGETTI\meeq"
.\test-ssh-connections.ps1
```

Oppure testa manualmente:

```powershell
# Test Raspberry Pi
ssh meeq-pi "echo 'OK'"

# Test VPS
ssh meeq-vps "echo 'OK'"
```

Se questi comandi funzionano, il problema è nella configurazione di Cursor.

## Step 2: Verifica Config SSH

Apri `C:\Users\ec\.ssh\config` e verifica che contenga:

```
Host meeq-pi
    HostName 172.16.0.10
    User meeq
    Port 22
    IdentityFile C:\Users\ec\.ssh\id_raspberry
    IdentitiesOnly yes
    ServerAliveInterval 60
    ServerAliveCountMax 3

Host meeq-vps
    HostName 128.140.84.82
    User root
    Port 22
    IdentityFile C:\Users\ec\.ssh\id_ed25519
    IdentitiesOnly yes
```

## Step 3: Verifica Chiavi SSH

Verifica che le chiavi esistano:

```powershell
Test-Path "C:\Users\ec\.ssh\id_raspberry"
Test-Path "C:\Users\ec\.ssh\id_ed25519"
```

## Step 4: Test Cursor Remote SSH

1. Apri Cursor sul PC locale (finestra locale, non SSH)
2. Premi `Ctrl+Shift+P` → "Remote-SSH: Connect to Host"
3. Prova a connetterti a `meeq-pi`
4. Prova a connetterti a `meeq-vps`

Se funziona individualmente, il problema è nel workspace multi-remote.

## Step 5: Workspace Alternativo

Se il workspace multi-remote non funziona, prova `meeq-remote-alt.code-workspace` che usa hostname completi invece degli alias.

## Step 6: Log Cursor

Se ancora non funziona, controlla i log di Cursor:

1. `Ctrl+Shift+P` → "Remote-SSH: Show Log"
2. Cerca errori relativi a `meeq-pi` o `meeq-vps`

## Soluzione Alternativa: Due Finestre Separate

Se il workspace multi-remote continua a non funzionare, usa due finestre separate:

1. **Finestra 1**: Connettiti a `meeq-pi` e apri `/home/meeq/meeq`
2. **Finestra 2**: Connettiti a `meeq-vps` e apri `/opt/meeq-central`

