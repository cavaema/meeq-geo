# MEEQ-GEO

Fork di MEEQ con landing page stile meeq-events: **QR unico per locale** → logo + "Accedi al menù" | "Gioca con MEEQ" → registrazione → inserimento numero tavolo → chat (dinamiche MEEQ).

## Flusso utente

1. **Scansiona QR** → arriva su landing page
2. **Landing**: logo del locale in alto, poi:
   - **Accedi al menù** → apre il PDF/URL del menù
   - **Gioca con MEEQ** → va all'app
3. **App MEEQ**:
   - Se non registrato: email → PIN → registrazione
   - Se già registrato: inserimento numero tavolo
4. **Da qui in poi**: stesse dinamiche di MEEQ (chat, rivelazione tavolo/nome, ecc.)

## Differenze da MEEQ Local

| MEEQ Local | MEEQ-GEO |
|------------|----------|
| Entry: index diretto | Entry: landing → Gioca |
| QR per tavolo | QR unico per locale |
| Grid tavoli | Grid + input manuale numero tavolo |
| - | Logo locale + pulsante Menù in landing |

## Configurazione Venue

Imposta nel file `.env` o nelle variabili d'ambiente:

```
VENUE_NAME=Nome del locale
VENUE_LOGO_URL=https://... (URL immagine logo)
VENUE_MENU_URL=https://... (URL PDF menù)

# Geolocalizzazione - disconnessione automatica quando esci dal locale
VENUE_LATITUDE=45.4642
VENUE_LONGITUDE=9.1900
VENUE_RADIUS_METERS=80
```

**Geolocalizzazione**: se imposti latitudine e longitudine, l'app chiederà il permesso di localizzazione e disconnetterà automaticamente l'utente quando esce dal raggio configurato (default 80m) per oltre 3 minuti.

## Avvio

```bash
npm install
node server.js
```

- **Landing**: http://localhost:3000/ oppure http://localhost:3000/venue  
- **App MEEQ**: http://localhost:3000/app  
- **Admin**: http://localhost:3000/admin  

## QR Code

Genera un QR che punta a: `http://TUO_IP:3000/` oppure `http://TUO_IP:3000/venue`
