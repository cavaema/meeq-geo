# Migrazione Utenti al Server Centrale

## Panoramica

Questo script migra tutti gli utenti esistenti dal database locale al server centrale.

## Prerequisiti

1. ✅ Server centrale configurato e funzionante
2. ✅ API Key del locale configurata
3. ✅ Database locale accessibile

## Configurazione

Prima di eseguire, configura le variabili d'ambiente o modifica lo script:

```bash
export CENTRAL_SERVER_URL="http://your-vps-ip:3002"
export VENUE_API_KEY="your-api-key-here"
```

Oppure modifica direttamente lo script:

```javascript
const CENTRAL_SERVER_URL = 'http://your-vps-ip:3002';
const VENUE_API_KEY = 'your-api-key-here';
```

## Esecuzione

### Metodo 1: Script Semplice (Consigliato)

```bash
cd /home/meeq/meeq
node migrate-users-to-central.js
```

### Metodo 2: Script Avanzato

```bash
cd /home/meeq/meeq
node migrate-users-advanced.js
```

## Cosa Fa lo Script

1. **Legge** tutti gli utenti dal database locale (`chat.db`)
2. **Verifica** se ogni utente esiste già nel server centrale
3. **Crea** l'utente nel server centrale se non esiste
4. **Salta** utenti già migrati (con `central_user_id`)
5. **Mostra** progresso e statistiche

## Limitazioni

⚠️ **Importante**: Lo script crea gli utenti nel server centrale, ma non può ottenere automaticamente il `central_user_id` perché richiede un PIN.

Gli utenti migrati dovranno:
1. Fare login una volta (con PIN)
2. Il sistema sincronizzerà automaticamente il `central_user_id`
3. Dopo il primo login, saranno completamente sincronizzati

## Output Esempio

```
🚀 Inizio migrazione utenti al server centrale
==============================================
📍 Server centrale: http://your-vps-ip:3002
📁 Database locale: ./chat.db

📊 Trovati 15 utenti da migrare

[1/15] Migrazione: user1@example.com (Mario Rossi)
   ✅ Utente creato nel server centrale
[2/15] Migrazione: user2@example.com (Luigi Bianchi)
   ⏭️  Già migrato (central_user_id: 5)
...

✅ Migrazione completata!
   ✅ Migrati: 12
   ⏭️  Saltati: 3
   ❌ Errori: 0

📝 Nota: Gli utenti migrati dovranno fare login una volta
   per completare la sincronizzazione (ottenere central_user_id)
```

## Troubleshooting

### Errore: VENUE_API_KEY non configurata

```bash
export VENUE_API_KEY="your-api-key"
```

### Errore: Server centrale non raggiungibile

Verifica:
- URL corretto del server centrale
- Server centrale attivo
- Porta corretta (3002)
- Firewall configurato

### Utenti non migrati

Se alcuni utenti non vengono migrati:
- Verifica i log per errori specifici
- Controlla se esistono già nel server centrale
- Esegui lo script di nuovo (salta quelli già migrati)

## Dopo la Migrazione

1. ✅ Utenti creati nel server centrale
2. ⏳ Utenti devono fare login per sincronizzazione completa
3. ✅ Nuovi utenti saranno automaticamente sincronizzati

## Verifica Migrazione

Controlla nel server centrale:
- Dashboard admin → Tab "Utenti"
- Dovresti vedere tutti gli utenti migrati

Controlla nel database locale:
```bash
sqlite3 chat.db "SELECT COUNT(*) FROM users WHERE central_user_id IS NOT NULL;"
```

