#!/bin/bash
# verifica_installazione.sh

echo "🔍 VERIFICA INSTALLAZIONE MEEQ"
echo "=============================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Checksum locali
echo "📦 Checksum file NUOVI:"
md5sum index.html server.js

echo ""
echo "📦 Checksum file INSTALLATI:"
ssh meeq@172.16.0.10 "cd ~/meeq && md5sum public/index.html server.js"

echo ""
echo "🔍 Verifiche modifiche specifiche:"
echo ""

# Test 1
COUNT=$(ssh meeq@172.16.0.10 "grep -c 'CREATE TABLE.*blocked_users' ~/meeq/server.js")
if [ "$COUNT" -eq "1" ]; then
    echo -e "${GREEN}✅ Tabella blocked_users: OK${NC}"
else
    echo -e "${RED}❌ Tabella blocked_users: MANCANTE${NC}"
fi

# Test 2
COUNT=$(ssh meeq@172.16.0.10 "grep -c 'datetime.*localtime' ~/meeq/server.js")
if [ "$COUNT" -eq "2" ]; then
    echo -e "${GREEN}✅ Timestamp locale: OK${NC}"
else
    echo -e "${RED}❌ Timestamp locale: MANCANTE${NC}"
fi

# Test 3
COUNT=$(ssh meeq@172.16.0.10 "grep -c 'SPAM' ~/meeq/server.js")
if [ "$COUNT" -ge "1" ]; then
    echo -e "${GREEN}✅ Avviso SPAM: OK${NC}"
else
    echo -e "${RED}❌ Avviso SPAM: MANCANTE${NC}"
fi

# Test 4
COUNT=$(ssh meeq@172.16.0.10 "grep -c 'user-select: none' ~/meeq/public/index.html")
if [ "$COUNT" -ge "1" ]; then
    echo -e "${GREEN}✅ Blocco screenshot: OK${NC}"
else
    echo -e "${RED}❌ Blocco screenshot: MANCANTE${NC}"
fi

# Test 5
COUNT=$(ssh meeq@172.16.0.10 "grep -c 'Segnala utente' ~/meeq/public/index.html")
if [ "$COUNT" -ge "1" ]; then
    echo -e "${GREEN}✅ Testo Segnala utente: OK${NC}"
else
    echo -e "${RED}❌ Testo Segnala utente: MANCANTE${NC}"
fi

# Test 6
COUNT=$(ssh meeq@172.16.0.10 "grep -c 'otherUserNameRevealed' ~/meeq/public/index.html")
if [ "$COUNT" -ge "4" ]; then
    echo -e "${GREEN}✅ Fix nome rivelato: OK${NC}"
else
    echo -e "${RED}❌ Fix nome rivelato: MANCANTE${NC}"
fi

echo ""
echo "🗄️ Verifica database:"
ssh meeq@172.16.0.10 "sqlite3 ~/meeq/chat.db '.tables' | grep -q blocked_users"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Tabella blocked_users nel DB: OK${NC}"
else
    echo -e "${RED}❌ Tabella blocked_users nel DB: MANCANTE${NC}"
fi

echo ""
echo "=============================="
echo "Verifica completata!"
