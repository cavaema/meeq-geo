# Workspace Unificato MEEQ

## Come Usare

### Opzione 1: Apri il Workspace (Consigliato)
1. In Cursor, vai su **File → Open Workspace from File...**
2. Seleziona `meeq.code-workspace`
3. Ora hai tutto in una sola finestra!

### Opzione 2: Apri la Directory Diretta
1. In Cursor, vai su **File → Open Folder...**
2. Seleziona `/home/meeq/meeq`
3. Tutti i file sono già qui!

## Struttura Progetto

```
/home/meeq/meeq/
├── server.js              # Server locale (Raspberry Pi)
├── central-server.js      # Server centrale (VPS)
├── public/
│   ├── index.html        # PWA locale
│   ├── app.html          # PWA centrale
│   ├── admin.html        # Admin locale
│   └── central-admin.html # Admin centrale
└── ...
```

## File Principali

### Server Locale
- **`server.js`**: Server Node.js locale (porta 3000)
- **`public/index.html`**: PWA locale
- **`public/admin.html`**: Dashboard admin locale

### Server Centrale
- **`central-server.js`**: Server Node.js centrale (porta 3002 sul VPS)
- **`public/app.html`**: PWA centrale (https://app.meeq.it)
- **`public/central-admin.html`**: Dashboard admin centrale

## Sviluppo

Ora puoi:
- ✅ Vedere entrambi i server nella stessa finestra
- ✅ Modificare `server.js` e `central-server.js` insieme
- ✅ Modificare `app.html` e `index.html` insieme
- ✅ Usare la ricerca globale per trovare codice in entrambi i file
- ✅ Evitare problemi di sincronizzazione tra finestre

## Note

- Il server centrale è sul VPS (`/opt/meeq-central`)
- Il server locale è sul Raspberry Pi (`/home/meeq/meeq`)
- Quando modifichi `app.html`, devi trasferirlo sul VPS
- Quando modifichi `central-server.js`, devi trasferirlo sul VPS











