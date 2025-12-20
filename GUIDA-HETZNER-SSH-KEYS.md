# Guida: Aggiungere Chiave SSH su Hetzner Cloud

## Passo 1: Accedi al Pannello Hetzner Cloud

1. Vai su: https://console.hetzner.cloud/
2. Fai login con le tue credenziali

## Passo 2: Trova il tuo Server

1. Dopo il login, vedrai la dashboard principale
2. Clicca su **"Servers"** nella barra laterale sinistra (o nella lista dei progetti)
3. Trova il server con IP `128.140.84.82` e clicca su di esso

## Passo 3: Apri la sezione "Access"

1. Una volta dentro la pagina del server, vedrai diverse tab/schede in alto:
   - **Overview** (Panoramica)
   - **Networking** (Rete)
   - **Backups** (Backup)
   - **Access** ← **QUESTO È QUELLO CHE CERCHI!**
   - **Firewalls** (Firewall)
   - **Volumes** (Volumi)
   - **Snapshots** (Snapshot)

2. Clicca sulla tab **"Access"**

## Passo 4: Aggiungi la Chiave SSH

Nella sezione "Access" vedrai:

### Opzione A: SSH Keys (Chiavi SSH)
- Cerca la sezione **"SSH Keys"** o **"Chiavi SSH"**
- Clicca su **"Add SSH Key"** o **"Aggiungi Chiave SSH"**
- Incolla la chiave pubblica (vedi sotto)

### Opzione B: Authorized Keys
- Se vedi una sezione **"Authorized Keys"** o **"Chiavi Autorizzate"**
- Clicca su **"Add Key"** o **"Aggiungi Chiave"**
- Incolla la chiave pubblica

## Chiave Pubblica da Copiare

Copia questa chiave completa (tutta la riga):

```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC+RwnRCKvKbAQVmvswKKEXbkYrIyeh2aldCPhZzLoT35EGIykICtbwSsiFyiqZ1XdnSeyQzM+NNuZHMGGUhZWhUkROSznFCUWBrLgZ8DsAj5g6n7B+UXEtPgOmyXOF68cKp36qUU/Wj4tODhkbPpNgafH64LM4GLVzMyN6Ki0K37DHoAj0J14z6NKEYx28YJKsPfF5GVopn9gq8a3/GehNzOHVEbLjMze90EJ4z6AKfjOTVL6ycbOiA2xgXeMU2fhJXDk/PiXLPJgT2mlOKNAN06gRJtSVxYtThhQc777TWyKyWpVfyqrffOaLLrSbNMaoDHJZGU516kHxxl2+mQDxZTRLJot40syy+2oCe/jUT692Vp/Bf4xol3cSPifRDZVtVmYIbSw1ThZQ9gpsHbQwCkzjyMmR8v+8aifJYmKRgSpne6/t+R6Sh3QftcK3dDuUMcuaE/bkB13oIJJ12PSnwpLiL6zw/Xia033ikF07ToGBJAiOADBXiQg5AhzPkwx+muD6cSjVLHBHrnPEPjxodc0VDqu0MFAdCn+6/PL/uLxMonuMnubw8omlX5HU772ledSF8A/aaTCr+VIugkHTnfZr6AJVw3qnL6H7vzQUIfefAxPTfPrQKEUoGWSE86Z7b1NydIOrUUUnjSUiNPN6phkI1XFo62SZI80gVLlmow== meeq-vps-key
```

## Passo 5: Salva e Testa

1. Dopo aver incollato la chiave, clicca su **"Save"** o **"Salva"**
2. Aspetta qualche secondo per la propagazione
3. Torna al terminale e prova:
   ```bash
   ssh meeq-vps
   ```

Dovresti connetterti senza password!

## Screenshot/Descrizione Interfaccia

L'interfaccia Hetzner Cloud ha questa struttura:

```
┌─────────────────────────────────────────┐
│ Hetzner Cloud Console                   │
├─────────────────────────────────────────┤
│ [Servers] [Networking] [Firewalls] ...  │
├─────────────────────────────────────────┤
│                                         │
│  Server: 128.140.84.82                 │
│  ┌───────────────────────────────────┐ │
│  │ [Overview] [Networking] [Backups] │ │
│  │ [Access] ← CLICCA QUI              │ │
│  │ [Firewalls] [Volumes] [Snapshots]  │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [Contenuto della tab Access]          │
│  - SSH Keys                             │
│  - [Add SSH Key]                        │
│                                         │
└─────────────────────────────────────────┘
```

## Alternativa: Se non trovi "Access"

Se la tab "Access" non è visibile, potrebbe essere che:

1. **Stai usando una versione diversa del pannello**: Cerca "SSH Keys" o "Chiavi SSH" nella barra laterale
2. **Il server è in un progetto**: Assicurati di essere nel progetto corretto
3. **Permessi insufficienti**: Verifica di avere i permessi di amministratore

In questo caso, puoi usare la **Console Web** del server:

1. Nella pagina del server, cerca **"Console"** o **"Web Console"**
2. Clicca per aprire un terminale web nel browser
3. Esegui manualmente i comandi (vedi Opzione 3 nella guida principale)

## Troubleshooting

### "Access" non visibile
- Verifica di essere nella pagina del server corretto
- Controlla che il server sia attivo (non spento)
- Prova a ricaricare la pagina

### Chiave non funziona dopo l'aggiunta
- Aspetta 1-2 minuti per la propagazione
- Verifica che la chiave sia stata copiata completamente (tutta la riga)
- Controlla che non ci siano spazi extra all'inizio/fine

### Ancora richiede password
- Verifica che la chiave sia stata aggiunta correttamente
- Controlla i log SSH: `ssh -v meeq-vps` (mostra dettagli di debug)










