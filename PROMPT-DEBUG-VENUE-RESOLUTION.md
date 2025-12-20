# Prompt per Debug Venue Resolution - MEEQ-CENTRAL

Copia e incolla questo prompt nella scheda di Cursor dove stai sviluppando MEEQ-CENTRAL:

---

## Debug: Problema risoluzione venue - "Non sei collegato alla WiFi del locale"

**Problema:**
L'app dice "Non sei collegato alla WiFi del locale" anche quando l'utente è connesso alla WiFi del locale.

**Causa possibile:**
Il server centrale non riesce a risolvere il venue basandosi sull'IP pubblico del client. Potrebbe essere un problema di:
1. IP non rilevato correttamente (Nginx/Cloudflare)
2. Heartbeat del server locale non aggiorna correttamente `last_public_ip`
3. Timing troppo stretto (freshness)
4. IP del client non corrisponde a quello salvato dal heartbeat

**Cosa devo fare:**

1. **Aggiungere logging dettagliato** nell'endpoint `/api/central/resolve-venue`:
   - Loggare l'IP rilevato dal client
   - Loggare tutti gli header rilevanti (X-Forwarded-For, X-Real-IP, cf-connecting-ip)
   - Loggare il risultato della query al database
   - Loggare tutte le venue trovate con quell'IP (anche se non matchano)

2. **Aggiungere logging nell'endpoint heartbeat** `/api/central/venues/heartbeat`:
   - Loggare l'IP ricevuto
   - Loggare quale venue viene aggiornata
   - Loggare il valore di `last_public_ip` prima e dopo l'update

3. **Verificare la funzione `getRequestIP`**:
   - Assicurarsi che legga correttamente gli header da Nginx
   - Se Cloudflare è davanti, usare `cf-connecting-ip`
   - Altrimenti usare `X-Forwarded-For` o `X-Real-IP`

4. **Aumentare temporaneamente il logging** per vedere cosa succede quando un client prova a risolvere il venue.

**File da modificare:**
- `/opt/meeq-central/central-server.js`

**Endpoint da modificare:**
- `GET /api/central/resolve-venue` (riga ~654)
- `POST /api/central/venues/heartbeat` (riga ~600)

**Dettagli tecnici:**
- Il server locale invia heartbeat ogni 10 minuti che aggiorna `last_public_ip` con l'IP pubblico del Raspberry Pi
- Quando un client accede a `https://app.meeq.it`, il server centrale deve rilevare l'IP pubblico del client
- Se il client è sulla stessa WiFi del locale, il suo IP pubblico dovrebbe essere lo stesso del Raspberry Pi
- La query cerca venue con `last_public_ip = ?` e `last_seen_at` entro 30 minuti (configurabile con `VENUE_IP_FRESHNESS_MINUTES`)

**Aggiungi logging per:**
```javascript
// In resolve-venue:
console.log('🔍 Resolve venue - IP rilevato:', ip);
console.log('🔍 Headers:', {
  'cf-connecting-ip': req.headers['cf-connecting-ip'],
  'x-forwarded-for': req.headers['x-forwarded-for'],
  'x-real-ip': req.headers['x-real-ip'],
  'req.ip': req.ip
});
console.log('🔍 Query IP:', ip, 'Freshness:', freshnessMinutes, 'minuti');

// Dopo la query:
console.log('🔍 Venue trovate:', rows.length);
if (rows.length > 0) {
  rows.forEach(v => console.log('  -', v.name, 'IP:', v.last_public_ip, 'Last seen:', v.last_seen_at));
}
```

**Dopo aver aggiunto il logging:**
1. Riavvia il servizio: `sudo systemctl restart meeq-central`
2. Prova a risolvere il venue dall'app
3. Controlla i log: `journalctl -u meeq-central -f`
4. Verifica quale IP viene rilevato e se corrisponde a quello salvato nel database

Applica queste modifiche e analizza i log per capire dove si perde l'IP.











