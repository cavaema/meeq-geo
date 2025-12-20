# Setup app.html sul VPS

## Metodo 1: Trasferimento diretto (se SSH funziona)

```bash
# Dal Raspberry Pi o dal tuo computer
scp public/app.html root@128.140.84.82:/opt/meeq-central/public/
```

## Metodo 2: Usando lo script Python

### Passo 1: Trasferisci i file sul VPS

```bash
# Dal Raspberry Pi o dal tuo computer
scp public/app.html root@128.140.84.82:/root/
scp create-app-html-vps.py root@128.140.84.82:/root/
```

### Passo 2: Sul VPS, esegui lo script

```bash
ssh root@128.140.84.82
cd /root
python3 create-app-html-vps.py
```

## Metodo 3: Copia manuale (se hai accesso via browser/Cloudflare)

1. Apri `public/app.html` sul Raspberry Pi
2. Copia tutto il contenuto (Ctrl+A, Ctrl+C)
3. Sul VPS, crea il file:
   ```bash
   nano /opt/meeq-central/public/app.html
   ```
4. Incolla il contenuto (Ctrl+Shift+V)
5. Salva (Ctrl+O, Enter, Ctrl+X)

## Metodo 4: Via Git (se il repo è su Git)

```bash
# Sul VPS
cd /opt/meeq-central
git pull origin main  # o il branch che usi
cp /path/to/repo/public/app.html public/
```

## Dopo il trasferimento

```bash
# Verifica che il file sia presente
ls -lh /opt/meeq-central/public/app.html

# Riavvia il central server
sudo systemctl restart meeq-central

# Verifica che sia attivo
sudo systemctl status meeq-central
```

## Test

Apri nel browser:
- `http://128.140.84.82:3002/app.html`


