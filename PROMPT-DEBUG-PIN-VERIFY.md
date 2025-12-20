# Prompt per Debug "Failed to Fetch" - Verifica PIN

Copia e incolla questo prompt nella scheda di Cursor dove stai sviluppando MEEQ-CENTRAL:

---

## Debug: "Failed to Fetch" durante verifica PIN

**Problema:**
Quando l'utente inserisce il PIN, l'app mostra "failed to fetch". 

**Flusso atteso:**
1. Utente inserisce PIN → chiama `/api/central/verify-pin` sul server centrale
2. Se PIN valido → ottiene token centrale
3. Chiama `/api/auto-login` sul server locale con il token centrale
4. Ottiene token locale e completa il login

**Cosa devo fare:**

1. **Aggiungere logging dettagliato** nell'endpoint `/api/central/verify-pin`:
   - Loggare quando viene ricevuta la richiesta (email, PIN)
   - Loggare il risultato della query al database
   - Loggare se il PIN è valido o meno
   - Loggare eventuali errori

2. **Verificare CORS**:
   - Il server centrale usa `app.use(cors())` che dovrebbe permettere tutte le origini
   - Verificare che le risposte includano gli header CORS corretti
   - Testare con curl per vedere se CORS funziona

3. **Verificare errori di rete**:
   - Controllare i log del server centrale quando viene chiamato verify-pin
   - Verificare se la richiesta arriva al server
   - Verificare se ci sono errori di timeout o connessione

4. **Testare manualmente**:
   ```bash
   # Test verify-pin
   curl -X POST https://app.meeq.it/api/central/verify-pin \
     -H "Content-Type: application/json" \
     -H "Origin: https://app.meeq.it" \
     -d '{"email":"test@test.com","pin":"123456"}'
   ```

**File da modificare:**
- `/opt/meeq-central/central-server.js`
- Endpoint: `POST /api/central/verify-pin` (riga ~421)

**Aggiungi logging:**
```javascript
app.post('/api/central/verify-pin', (req, res) => {
  const { email, pin } = req.body;
  
  console.log('🔍 Verify PIN richiesto:', { email, pin: pin ? '***' : 'mancante' });
  
  if (!email || !pin) {
    console.log('❌ Verify PIN: email o PIN mancanti');
    return res.status(400).json({ error: 'Email e PIN richiesti' });
  }

  // ... resto del codice ...
  
  // Dopo la query pending_registrations:
  console.log('🔍 Verify PIN: pending trovato?', !!pending);
  
  // Dopo la verifica scadenza:
  console.log('🔍 Verify PIN: PIN valido, diffHours:', diffHours);
  
  // Dopo la query users:
  console.log('🔍 Verify PIN: utente esistente?', !!existingUser);
  
  // Prima di inviare la risposta:
  console.log('✅ Verify PIN: login completato per', email);
});
```

**Dopo aver aggiunto il logging:**
1. Riavvia il servizio: `sudo systemctl restart meeq-central`
2. Prova a inserire il PIN dall'app
3. Controlla i log: `journalctl -u meeq-central -f`
4. Verifica se la richiesta arriva al server e dove si blocca

**Verifica anche:**
- Se il problema è nel server locale (auto-login), controlla i log del server locale: `journalctl -u meeq -f`
- Se ci sono errori CORS, verifica che il server centrale risponda con gli header corretti
- Se ci sono errori di rete, verifica la connettività tra PWA e server centrale

Applica queste modifiche e analizza i log per capire dove si blocca il flusso.











