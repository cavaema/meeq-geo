# Prompt per Fix Root Route - MEEQ-CENTRAL

Copia e incolla questo prompt nella scheda di Cursor dove stai sviluppando MEEQ-CENTRAL:

---

## Fix: Aggiungere route per root "/" che serve app.html

**Problema:**
Quando si accede a `https://app.meeq.it/` (root), il server restituisce "Cannot GET /" invece di servire `app.html`.

**Soluzione:**
Aggiungere una route Express per la root che serva `app.html`.

**File da modificare:**
`/opt/meeq-central/central-server.js` (o il percorso corretto del file sul VPS)

**Modifica da applicare:**

Nel file `central-server.js`, dopo la riga:
```javascript
app.use(express.static('public'));
```

Aggiungi queste righe:
```javascript
// Route per la root: serve app.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});
```

**Nota:**
- Il modulo `path` dovrebbe già essere importato all'inizio del file
- Se non lo è, assicurati che ci sia: `const path = require('path');`

**Dopo la modifica:**
1. Riavvia il servizio systemd:
   ```bash
   sudo systemctl restart meeq-central
   ```

2. Verifica che funzioni:
   ```bash
   curl -I https://app.meeq.it/
   ```
   Dovrebbe restituire HTTP 200 invece di 404.

**Risultato atteso:**
- `https://app.meeq.it/` → serve `app.html`
- `https://app.meeq.it/app.html` → continua a funzionare
- Gli endpoint API continuano a funzionare normalmente

Applica questa modifica e riavvia il servizio.











