# Aggiungi Chiave Raspberry Pi al VPS

## Situazione
- ✅ Ti connetti al VPS dal PC (chiave SSH già configurata)
- ❌ Il Raspberry Pi non può connettersi al VPS (chiave non aggiunta)

## Soluzione: Aggiungi la Chiave dal PC

### Passo 1: Connettiti al VPS dal PC

Dal tuo PC, connettiti al VPS (dovrebbe funzionare già):

```bash
ssh root@128.140.84.82
```

### Passo 2: Aggiungi la Chiave del Raspberry Pi

Una volta connesso al VPS, esegui questi comandi:

```bash
# Crea directory .ssh se non esiste
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Aggiungi la chiave del Raspberry Pi
echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC+RwnRCKvKbAQVmvswKKEXbkYrIyeh2aldCPhZzLoT35EGIykICtbwSsiFyiqZ1XdnSeyQzM+NNuZHMGGUhZWhUkROSznFCUWBrLgZ8DsAj5g6n7B+UXEtPgOmyXOF68cKp36qUU/Wj4tODhkbPpNgafH64LM4GLVzMyN6Ki0K37DHoAj0J14z6NKEYx28YJKsPfF5GVopn9gq8a3/GehNzOHVEbLjMze90EJ4z6AKfjOTVL6ycbOiA2xgXeMU2fhJXDk/PiXLPJgT2mlOKNAN06gRJtSVxYtThhQc777TWyKyWpVfyqrffOaLLrSbNMaoDHJZGU516kHxxl2+mQDxZTRLJot40syy+2oCe/jUT692Vp/Bf4xol3cSPifRDZVtVmYIbSw1ThZQ9gpsHbQwCkzjyMmR8v+8aifJYmKRgSpne6/t+R6Sh3QftcK3dDuUMcuaE/bkB13oIJJ12PSnwpLiL6zw/Xia033ikF07ToGBJAiOADBXiQg5AhzPkwx+muD6cSjVLHBHrnPEPjxodc0VDqu0MFAdCn+6/PL/uLxMonuMnubw8omlX5HU772ledSF8A/aaTCr+VIugkHTnfZr6AJVw3qnL6H7vzQUIfefAxPTfPrQKEUoGWSE86Z7b1NydIOrUUUnjSUiNPN6phkI1XFo62SZI80gVLlmow== meeq-vps-key" >> ~/.ssh/authorized_keys

# Imposta permessi corretti
chmod 600 ~/.ssh/authorized_keys

# Verifica
cat ~/.ssh/authorized_keys
```

### Passo 3: Esci dal VPS

```bash
exit
```

### Passo 4: Testa dal Raspberry Pi

Dal Raspberry Pi, prova:

```bash
ssh meeq-vps
```

Dovrebbe funzionare senza password!

## Alternativa: Workspace dal PC

Se vuoi sviluppare tutto dal PC (non dal Raspberry Pi), puoi:

1. **Aprire il workspace remoto in Cursor sul PC**:
   - File → Open Workspace from File...
   - Seleziona il workspace remoto (se lo hai sul PC)
   - Si connetterà al VPS via SSH

2. **Per il server locale (Raspberry Pi)**:
   - Monta il Raspberry Pi via SSHFS sul PC, oppure
   - Sincronizza i file tra PC e Raspberry Pi, oppure
   - Aggiungi anche il Raspberry Pi come cartella remota nel workspace

Vuoi sviluppare dal PC o dal Raspberry Pi?










