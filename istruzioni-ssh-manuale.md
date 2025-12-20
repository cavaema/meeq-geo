# Istruzioni Manuali per Configurare SSH

## Passo 1: Connettiti Manualmente al VPS

Apri un terminale e esegui:

```bash
ssh root@128.140.84.82
```

Inserisci la password quando richiesta.

## Passo 2: Se la Connessione Funziona

Una volta connesso al VPS, esegui questi comandi:

```bash
# Crea directory .ssh se non esiste
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Aggiungi la chiave pubblica
echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC+RwnRCKvKbAQVmvswKKEXbkYrIyeh2aldCPhZzLoT35EGIykICtbwSsiFyiqZ1XdnSeyQzM+NNuZHMGGUhZWhUkROSznFCUWBrLgZ8DsAj5g6n7B+UXEtPgOmyXOF68cKp36qUU/Wj4tODhkbPpNgafH64LM4GLVzMyN6Ki0K37DHoAj0J14z6NKEYx28YJKsPfF5GVopn9gq8a3/GehNzOHVEbLjMze90EJ4z6AKfjOTVL6ycbOiA2xgXeMU2fhJXDk/PiXLPJgT2mlOKNAN06gRJtSVxYtThhQc777TWyKyWpVfyqrffOaLLrSbNMaoDHJZGU516kHxxl2+mQDxZTRLJot40syy+2oCe/jUT692Vp/Bf4xol3cSPifRDZVtVmYIbSw1ThZQ9gpsHbQwCkzjyMmR8v+8aifJYmKRgSpne6/t+R6Sh3QftcK3dDuUMcuaE/bkB13oIJJ12PSnwpLiL6zw/Xia033ikF07ToGBJAiOADBXiQg5AhzPkwx+muD6cSjVLHBHrnPEPjxodc0VDqu0MFAdCn+6/PL/uLxMonuMnubw8omlX5HU772ledSF8A/aaTCr+VIugkHTnfZr6AJVw3qnL6H7vzQUIfefAxPTfPrQKEUoGWSE86Z7b1NydIOrUUUnjSUiNPN6phkI1XFo62SZI80gVLlmow== meeq-vps-key" >> ~/.ssh/authorized_keys

# Imposta permessi corretti
chmod 600 ~/.ssh/authorized_keys

# Verifica
cat ~/.ssh/authorized_keys
```

## Passo 3: Esci e Testa

```bash
exit
```

Poi dal Raspberry Pi, prova:

```bash
ssh meeq-vps
```

Dovresti connetterti senza password!

## Se la Password Non Funziona

Se anche con la password non riesci a connetterti, potrebbe essere che:

1. **La password è sbagliata**: Verifica la password del VPS
2. **L'autenticazione con password è disabilitata**: In questo caso, devi usare solo le chiavi SSH
3. **Il server è configurato diversamente**: Contatta il supporto Hetzner o verifica le impostazioni del server

## Alternativa: Verifica Chiave Aggiunta da Hetzner

Se hai aggiunto la chiave tramite il pannello Hetzner, potrebbe essere che:

1. La chiave sia stata aggiunta ma non ancora propagata (aspetta 2-3 minuti)
2. La chiave sia stata aggiunta per un utente diverso da `root`
3. La chiave sia stata aggiunta in un formato diverso

In questo caso, prova a:
- Aspettare qualche minuto e riprovare `ssh meeq-vps`
- Verificare nel pannello Hetzner se la chiave è effettivamente associata al server










