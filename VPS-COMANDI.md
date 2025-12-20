# Comandi da Eseguire sul VPS

## Opzione 1: Script Completo (Consigliato)

### 1. Trasferisci lo script sul VPS:

Dal Raspberry Pi:
```bash
scp vps-diagnostic.sh root@your-vps-ip:/tmp/
```

### 2. Connettiti al VPS:

```bash
ssh root@your-vps-ip
```

### 3. Esegui lo script:

```bash
cd /tmp
chmod +x vps-diagnostic.sh
bash vps-diagnostic.sh > vps-info.txt
```

### 4. Copia l'output:

```bash
cat vps-info.txt
```

Copia tutto l'output e invialo per la configurazione personalizzata.

---

## Opzione 2: Check Rapido

### 1. Trasferisci lo script:

```bash
scp vps-quick-check.sh root@your-vps-ip:/tmp/
```

### 2. Esegui sul VPS:

```bash
bash /tmp/vps-quick-check.sh
```

---

## Opzione 3: Comandi Manuali

Esegui questi comandi uno per uno sul VPS e copia l'output:

### 1. Informazioni Base

```bash
# OS e versione
cat /etc/os-release

# Node.js
node --version 2>/dev/null || echo "Node.js non installato"
npm --version 2>/dev/null || echo "npm non installato"

# Nginx
nginx -v 2>&1 || echo "Nginx non installato"
systemctl status nginx --no-pager | head -5
```

### 2. Porte e Servizi

```bash
# Porte in ascolto
sudo netstat -tlnp | grep LISTEN | head -20
# Oppure (se netstat non disponibile)
sudo ss -tlnp | grep LISTEN | head -20

# Processi Node.js
ps aux | grep node | grep -v grep

# Porte usate da Node.js
sudo netstat -tlnp | grep node
```

### 3. Nginx

```bash
# Configurazioni attive
ls -la /etc/nginx/sites-enabled/

# Contenuto configurazioni (se vuoi vedere)
cat /etc/nginx/sites-enabled/* 2>/dev/null | head -50
```

### 4. Firewall

```bash
# UFW
sudo ufw status verbose 2>/dev/null || echo "UFW non installato"

# iptables
sudo iptables -L -n --line-numbers | head -20

# firewalld
sudo firewall-cmd --list-all 2>/dev/null || echo "firewalld non installato"
```

### 5. SSL/Certificati

```bash
# Let's Encrypt
ls -la /etc/letsencrypt/live/ 2>/dev/null || echo "Let's Encrypt non trovato"
```

### 6. Directory e Permessi

```bash
# Directory disponibili
ls -ld /opt /var/www /home /srv 2>/dev/null

# Utente corrente
whoami
groups
```

### 7. IP e Domini

```bash
# IP pubblico
curl -s ifconfig.me
# Oppure
curl -s ipinfo.io/ip

# Hostname
hostname
hostname -I
```

### 8. Servizi Systemd

```bash
# Servizi Node.js
systemctl list-units --type=service | grep -i node

# Tutti i servizi attivi
systemctl list-units --type=service --state=running | head -20
```

### 9. Spazio e Memoria

```bash
# Spazio disco
df -h

# Memoria
free -h
```

---

## Output da Inviare

Dopo aver eseguito i comandi, invia:

1. ✅ Output completo dello script diagnostico (Opzione 1)
2. ✅ OPPURE risposte a queste domande:

### Domande Rapide:

1. **Node.js installato?** Sì/No - Versione: _______
2. **Nginx installato?** Sì/No - Versione: _______
3. **Porte Node.js in uso:** _______
4. **Firewall:** UFW/iptables/firewalld/Nessuno
5. **SSL/Let's Encrypt:** Sì/No
6. **Dominio configurato:** _______
7. **Porta preferita per server centrale:** _______
8. **Directory preferita:** /opt/meeq-central /var/www/meeq-central /altro: _______

---

## Esempio Output Atteso

```
🔍 Diagnostica Configurazione VPS
==================================

📊 INFORMAZIONI SISTEMA
-----------------------
OS: Ubuntu 22.04.3 LTS
Kernel: 5.15.0-91-generic
...

📦 NODE.JS
----------
✅ Node.js installato: v18.17.0
✅ npm installato: 9.6.7

🌐 NGINX
--------
✅ Nginx installato: nginx/1.22.1
...
```

Copia tutto l'output e invialo!

