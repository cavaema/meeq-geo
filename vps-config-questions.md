# Domande per Configurazione VPS Condiviso

Per configurare correttamente il server centrale su un VPS condiviso, ho bisogno di queste informazioni:

## 1. Nginx e Reverse Proxy

- ✅ Nginx è già installato e configurato?
- Se sì, quale dominio/sottodominio vuoi usare? (es: `api.meeq.it`, `central.meeq.it`, `meeq.it/api`)
- Preferisci un path specifico? (es: `/meeq-central` invece della root)

## 2. Porte

- Quale porta vuoi usare per il server centrale?
  - Default: `3001`
  - Alternativa: `3002`, `3003`, o altra porta disponibile?
- Ci sono altre applicazioni Node.js in esecuzione? Quali porte usano?

## 3. Dominio e SSL

- Hai già un dominio configurato? (es: `meeq.it`)
- Vuoi usare un sottodominio? (es: `api.meeq.it`)
- SSL/HTTPS è già configurato? (Let's Encrypt, Cloudflare, etc.)

## 4. Directory e Permessi

- Dove preferisci installare il server centrale?
  - Default: `/opt/meeq-central`
  - Alternativa: `/var/www/meeq-central`, `/home/meeq/central`, etc.
- Quale utente dovrebbe eseguire il servizio? (root, www-data, utente dedicato)

## 5. Database

- Preferisci SQLite (più semplice) o PostgreSQL/MySQL (se già configurato)?
- Se hai già un database, vuoi usare quello o uno separato?

## 6. Firewall

- Quale firewall usi? (UFW, iptables, Cloudflare, etc.)
- Le porte sono già aperte o devo configurare le regole?

---

**Rispondi a queste domande e creerò una configurazione personalizzata per il tuo VPS!**

