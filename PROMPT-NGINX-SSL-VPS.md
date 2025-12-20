# Prompt per Configurazione Nginx + SSL sul VPS

Copia e incolla questo prompt nella scheda di Cursor dove stai sviluppando MEEQ-CENTRAL:

---

## Configurazione Nginx + SSL per app.meeq.it

**Situazione attuale:**
- Server centrale Node.js in esecuzione su `http://localhost:3002`
- File `app.html` presente in `/opt/meeq-central/public/app.html`
- Server serve file statici con `express.static('public')`
- Dominio `app.meeq.it` già configurato su Cloudflare e punta a `128.140.84.82`
- DNS già propagato (verificato)
- Il server risponde correttamente su `http://128.140.84.82:3002/app.html`

**Obiettivo:**
Configurare Nginx come reverse proxy con SSL (Let's Encrypt) per servire `https://app.meeq.it` e `https://app.meeq.it/app.html`.

**Requisiti:**
1. Nginx installato e funzionante
2. Certbot (Let's Encrypt) installato
3. Porta 80 e 443 aperte sul firewall
4. Dominio `app.meeq.it` già puntato a `128.140.84.82` su Cloudflare

**Cosa devo fare:**
1. Creare configurazione Nginx per `app.meeq.it` che:
   - Ascolta su porta 80 (HTTP) e 443 (HTTPS)
   - Fa reverse proxy a `http://localhost:3002`
   - Passa correttamente gli header (X-Real-IP, X-Forwarded-For, etc.)
   - Supporta WebSocket se necessario
   - Serve correttamente i file statici

2. Configurare SSL con Let's Encrypt:
   - Ottenere certificato per `app.meeq.it`
   - Configurare redirect HTTP → HTTPS
   - Impostare certificato valido

3. Verificare che:
   - `https://app.meeq.it` funzioni
   - `https://app.meeq.it/app.html` funzioni
   - Il server centrale riceva correttamente le richieste

**Dettagli tecnici:**
- IP VPS: `128.140.84.82`
- Porta server Node.js: `3002`
- Directory server: `/opt/meeq-central`
- Directory file statici: `/opt/meeq-central/public`
- Dominio: `app.meeq.it`
- Il server Node.js usa `app.set('trust proxy', true)` quindi Nginx deve passare gli header corretti

**Note:**
- Il server centrale è già in esecuzione come servizio systemd
- Non modificare la porta del server Node.js
- Assicurati che Nginx non interferisca con altre configurazioni esistenti sul VPS

Procedi con la configurazione completa di Nginx + SSL.











