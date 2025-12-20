# Verifica Chiave SSH sul VPS

Il server sta rifiutando la chiave SSH. Verifichiamo che sia stata aggiunta correttamente.

## Passo 1: Accedi alla Console Web del VPS

1. Vai su https://console.hetzner.cloud/
2. Clicca su **"Servers"**
3. Clicca sul server `128.140.84.82`
4. Cerca **"Console"** o **"Web Console"** (di solito è un pulsante nella parte superiore della pagina)
5. Clicca per aprire il terminale web nel browser

## Passo 2: Verifica la Chiave SSH

Una volta nella console web, esegui questi comandi:

```bash
# Verifica che il file authorized_keys esista
ls -la ~/.ssh/authorized_keys

# Mostra il contenuto del file
cat ~/.ssh/authorized_keys

# Verifica i permessi (devono essere 600)
stat -c "%a %n" ~/.ssh/authorized_keys
```

## Passo 3: Confronta la Chiave

La chiave che hai aggiunto dovrebbe essere esattamente questa:

```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC+RwnRCKvKbAQVmvswKKEXbkYrIyeh2aldCPhZzLoT35EGIykICtbwSsiFyiqZ1XdnSeyQzM+NNuZHMGGUhZWhUkROSznFCUWBrLgZ8DsAj5g6n7B+UXEtPgOmyXOF68cKp36qUU/Wj4tODhkbPpNgafH64LM4GLVzMyN6Ki0K37DHoAj0J14z6NKEYx28YJKsPfF5GVopn9gq8a3/GehNzOHVEbLjMze90EJ4z6AKfjOTVL6ycbOiA2xgXeMU2fhJXDk/PiXLPJgT2mlOKNAN06gRJtSVxYtThhQc777TWyKyWpVfyqrffOaLLrSbNMaoDHJZGU516kHxxl2+mQDxZTRLJot40syy+2oCe/jUT692Vp/Bf4xol3cSPifRDZVtVmYIbSw1ThZQ9gpsHbQwCkzjyMmR8v+8aifJYmKRgSpne6/t+R6Sh3QftcK3dDuUMcuaE/bkB13oIJJ12PSnwpLiL6zw/Xia033ikF07ToGBJAiOADBXiQg5AhzPkwx+muD6cSjVLHBHrnPEPjxodc0VDqu0MFAdCn+6/PL/uLxMonuMnubw8omlX5HU772ledSF8A/aaTCr+VIugkHTnfZr6AJVw3qnL6H7vzQUIfefAxPTfPrQKEUoGWSE86Z7b1NydIOrUUUnjSUiNPN6phkI1XFo62SZI80gVLlmow== meeq-vps-key
```

## Passo 4: Se la Chiave NON è Presente

Se il file `~/.ssh/authorized_keys` non esiste o non contiene la chiave, aggiungila manualmente:

```bash
# Crea la directory se non esiste
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Aggiungi la chiave
echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC+RwnRCKvKbAQVmvswKKEXbkYrIyeh2aldCPhZzLoT35EGIykICtbwSsiFyiqZ1XdnSeyQzM+NNuZHMGGUhZWhUkROSznFCUWBrLgZ8DsAj5g6n7B+UXEtPgOmyXOF68cKp36qUU/Wj4tODhkbPpNgafH64LM4GLVzMyN6Ki0K37DHoAj0J14z6NKEYx28YJKsPfF5GVopn9gq8a3/GehNzOHVEbLjMze90EJ4z6AKfjOTVL6ycbOiA2xgXeMU2fhJXDk/PiXLPJgT2mlOKNAN06gRJtSVxYtThhQc777TWyKyWpVfyqrffOaLLrSbNMaoDHJZGU516kHxxl2+mQDxZTRLJot40syy+2oCe/jUT692Vp/Bf4xol3cSPifRDZVtVmYIbSw1ThZQ9gpsHbQwCkzjyMmR8v+8aifJYmKRgSpne6/t+R6Sh3QftcK3dDuUMcuaE/bkB13oIJJ12PSnwpLiL6zw/Xia033ikF07ToGBJAiOADBXiQg5AhzPkwx+muD6cSjVLHBHrnPEPjxodc0VDqu0MFAdCn+6/PL/uLxMonuMnubw8omlX5HU772ledSF8A/aaTCr+VIugkHTnfZr6AJVw3qnL6H7vzQUIfefAxPTfPrQKEUoGWSE86Z7b1NydIOrUUUnjSUiNPN6phkI1XFo62SZI80gVLlmow== meeq-vps-key" >> ~/.ssh/authorized_keys

# Imposta i permessi corretti
chmod 600 ~/.ssh/authorized_keys
```

## Passo 5: Verifica i Permessi

I permessi devono essere esattamente:
- `~/.ssh`: `700` (drwx------)
- `~/.ssh/authorized_keys`: `600` (-rw-------)

Se non lo sono, correggili:

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

## Passo 6: Testa la Connessione

Dopo aver verificato/corretto, torna al terminale locale e prova:

```bash
ssh meeq-vps
```

## Possibili Problemi

### Problema 1: Chiave aggiunta per utente sbagliato
- Verifica di essere connesso come `root` nella console web
- La chiave deve essere in `/root/.ssh/authorized_keys` (non in `/home/altro-utente/.ssh/`)

### Problema 2: Chiave con spazi o caratteri extra
- La chiave deve essere su una sola riga
- Non devono esserci spazi all'inizio o alla fine
- Non devono esserci interruzioni di riga

### Problema 3: Permessi sbagliati
- `~/.ssh` deve essere `700`
- `~/.ssh/authorized_keys` deve essere `600`
- Se i permessi sono sbagliati, SSH rifiuterà la chiave per sicurezza

### Problema 4: Chiave aggiunta tramite Hetzner ma non propagata
- A volte Hetzner impiega qualche minuto per propagare le chiavi
- Prova ad aspettare 2-3 minuti e riprova
- Oppure aggiungi manualmente tramite console web










