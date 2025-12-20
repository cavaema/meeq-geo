# Setup PWA e Notifiche Push - Meeq

## ✅ Cosa è stato implementato

1. **Manifest.json** - Permette l'installazione come app
2. **Service Worker** - Gestisce le notifiche push (NON fa cache offline)
3. **Backend Push API** - Endpoint per registrare subscription e inviare notifiche
4. **Frontend Push Registration** - Richiesta permessi e registrazione automatica

## 📋 Cosa manca (da fare manualmente)

### 1. Creare le icone PWA

Devi creare due icone PNG:
- `public/icon-192.png` (192x192 pixel)
- `public/icon-512.png` (512x512 pixel)

**Come crearle:**
1. Crea un'icona quadrata con il logo Meeq
2. Usa un tool online come https://realfavicongenerator.net/ o https://www.pwabuilder.com/imageGenerator
3. Salva le icone nella cartella `public/`

**Note:**
- Le icone devono essere PNG
- Sfondo trasparente o colorato (consigliato: #E91E8C o #1a1625)
- Logo centrato e ben visibile

## 🔧 Configurazione completata

### Chiavi VAPID
✅ Chiavi VAPID già generate e configurate in `server.js`

### Database
✅ Tabella `push_subscriptions` creata automaticamente

### Endpoint API
- `GET /api/push/vapid-public-key` - Ottiene la chiave pubblica
- `POST /api/push/subscribe` - Registra una subscription
- `POST /api/push/unsubscribe` - Rimuove una subscription

## 🚀 Come funziona

1. **Installazione PWA:**
   - L'utente apre l'app nel browser
   - Il browser mostra un banner "Aggiungi alla schermata home"
   - L'utente può installare l'app come un'app nativa

2. **Notifiche Push:**
   - All'avvio, l'app richiede i permessi per le notifiche
   - Se l'utente accetta, la subscription viene registrata nel database
   - Quando arriva un nuovo messaggio, il server invia una notifica push
   - La notifica appare anche se l'app è chiusa

3. **Funzionamento solo server locale:**
   - ✅ L'app funziona SOLO quando connessa al server locale
   - ✅ Nessuna cache offline delle API
   - ✅ Tutte le chiamate vanno al server locale
   - ✅ Le notifiche funzionano sulla rete locale

## 🧪 Test

1. **Test installazione:**
   - Apri l'app nel browser mobile
   - Dovresti vedere il banner "Aggiungi alla schermata home"
   - Installa l'app

2. **Test notifiche:**
   - Accetta i permessi per le notifiche
   - Chiudi l'app completamente
   - Invia un messaggio da un altro utente
   - Dovresti ricevere una notifica

## 📱 Compatibilità

- ✅ Android Chrome/Edge (supporto completo)
- ✅ iOS Safari 11.3+ (supporto completo)
- ✅ Desktop Chrome/Edge (installabile)

## ⚠️ Note importanti

1. **HTTPS richiesto:** Le notifiche push funzionano solo su HTTPS o localhost
2. **Server locale:** L'app funziona solo quando connessa al server locale (come richiesto)
3. **Chiavi VAPID:** Le chiavi sono già generate, ma puoi rigenerarle con `node generate-vapid-keys.js` se necessario

## 🔄 Rigenerare chiavi VAPID

Se vuoi rigenerare le chiavi VAPID:

```bash
node generate-vapid-keys.js
```

Poi copia le nuove chiavi in `server.js` sostituendo `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`.


