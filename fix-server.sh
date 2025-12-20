#!/bin/bash

# ============================================================================
# SCRIPT AUTOMATICO FIX SERVER MEEQ
# ============================================================================

set -e  # Exit on error

echo "============================================================"
echo "🔧 FIX AUTOMATICO SERVER MEEQ"
echo "============================================================"
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd ~/meeq

# ============================================================================
# 1. BACKUP
# ============================================================================
echo -e "${YELLOW}📦 Creazione backup...${NC}"
BACKUP_FILE="server.js.backup-$(date +%Y%m%d-%H%M%S)"
cp server.js "$BACKUP_FILE"
echo -e "${GREEN}✅ Backup creato: $BACKUP_FILE${NC}"
echo ""

# ============================================================================
# 2. FIX 1 - Aggiungi endpoint /api/table/:tableId/users
# ============================================================================
echo -e "${YELLOW}🔧 Fix 1: Aggiunta endpoint /api/table/:tableId/users...${NC}"

# Trova la linea dopo l'endpoint /api/users e inserisce il nuovo endpoint
# Cerchiamo la chiusura dell'endpoint /api/users (la sua });)

# Creo un file temporaneo con il nuovo endpoint
cat > /tmp/new_endpoint.txt << 'ENDPOINT'

// 🆕 Lista utenti di un tavolo specifico (formato alternativo per compatibilità frontend)
app.get('/api/table/:tableId/users', authenticateToken, (req, res) => {
  const { tableId } = req.params;
  const currentUserId = req.user.userId;

  const query = `
    SELECT 
      u.id,
      u.nome,
      u.cognome,
      u.gender,
      u.distinctive_sign,
      u.tavolo,
      u.last_activity
    FROM users u
    WHERE u.logged_in = 1
      AND u.id != ?
      AND u.tavolo = ?
      AND datetime(u.last_activity, '+30 minutes') > datetime('now')
    ORDER BY u.last_activity DESC
  `;

  db.all(query, [currentUserId, tableId], (err, users) => {
    if (err) {
      console.error('Errore query utenti tavolo:', err);
      return res.status(500).json({ error: 'Errore database' });
    }

    const formattedUsers = users.map(user => ({
      id: user.id,
      nome: user.nome,
      cognome: user.cognome,
      gender: user.gender,
      distinctive_sign: user.distinctive_sign,
      tavolo: user.tavolo,
      lastActivity: user.last_activity
    }));

    res.json(formattedUsers);
  });
});
ENDPOINT

# Trova la riga dove si chiude l'endpoint /api/users e inserisci dopo
awk '
/^app\.get\(.*\/api\/users.*authenticateToken/ {
    in_users_endpoint = 1
}
in_users_endpoint && /^}\);$/ {
    print
    while ((getline line < "/tmp/new_endpoint.txt") > 0) {
        print line
    }
    close("/tmp/new_endpoint.txt")
    in_users_endpoint = 0
    next
}
{print}
' server.js > server.js.tmp && mv server.js.tmp server.js

echo -e "${GREEN}✅ Endpoint /api/table/:tableId/users aggiunto${NC}"
echo ""

# ============================================================================
# 3. FIX 2 - Sostituisci endpoint /api/conversations
# ============================================================================
echo -e "${YELLOW}🔧 Fix 2: Correzione endpoint /api/conversations...${NC}"

# Creo il nuovo endpoint completo
cat > /tmp/new_conversations.txt << 'CONVERSATIONS'
// Lista conversazioni dell'utente
app.get('/api/conversations', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  const query = `
    SELECT 
      c.id,
      c.status,
      c.user1_id,
      c.user2_id,
      c.user1_revealed,
      c.user2_revealed,
      c.user1_table_revealed,
      c.user2_table_revealed,
      c.user1_name_revealed,
      c.user2_name_revealed,
      c.created_at,
      c.updated_at,
      u1.nome as user1_nome,
      u1.cognome as user1_cognome,
      u1.gender as user1_gender,
      u1.distinctive_sign as user1_sign,
      u1.tavolo as user1_tavolo,
      u2.nome as user2_nome,
      u2.cognome as user2_cognome,
      u2.gender as user2_gender,
      u2.distinctive_sign as user2_sign,
      u2.tavolo as user2_tavolo,
      (SELECT COUNT(*) FROM messages m 
       WHERE m.conversation_id = c.id 
       AND m.recipient_id = ?
       AND m.is_read = 0) as unread_count
    FROM conversations c
    LEFT JOIN users u1 ON c.user1_id = u1.id
    LEFT JOIN users u2 ON c.user2_id = u2.id
    WHERE c.user1_id = ? OR c.user2_id = ?
    ORDER BY c.updated_at DESC
  `;

  db.all(query, [userId, userId, userId], (err, conversations) => {
    if (err) {
      console.error('Errore recupero conversazioni:', err);
      return res.status(500).json({ error: 'Errore database' });
    }

    // ✅ Ritorna sempre un array, anche se vuoto
    if (!conversations || conversations.length === 0) {
      return res.json([]);
    }

    const formattedConversations = conversations.map(conv => {
      const isUser1 = conv.user1_id === userId;
      const otherUser = isUser1 ? {
        id: conv.user2_id,
        nome: conv.user2_nome,
        cognome: conv.user2_cognome,
        gender: conv.user2_gender,
        distinctive_sign: conv.user2_sign,
        tavolo: conv.user2_tavolo
      } : {
        id: conv.user1_id,
        nome: conv.user1_nome,
        cognome: conv.user1_cognome,
        gender: conv.user1_gender,
        distinctive_sign: conv.user1_sign,
        tavolo: conv.user1_tavolo
      };

      const myRevealed = isUser1 ? {
        name: conv.user1_name_revealed === 1,
        table: conv.user1_table_revealed === 1
      } : {
        name: conv.user2_name_revealed === 1,
        table: conv.user2_table_revealed === 1
      };

      const theirRevealed = isUser1 ? {
        name: conv.user2_name_revealed === 1,
        table: conv.user2_table_revealed === 1
      } : {
        name: conv.user1_name_revealed === 1,
        table: conv.user1_table_revealed === 1
      };

      return {
        id: conv.id,
        status: conv.status,
        user1_id: conv.user1_id,
        user2_id: conv.user2_id,
        otherUser: otherUser,
        myRevealed: myRevealed,
        theirRevealed: theirRevealed,
        unreadCount: conv.unread_count || 0,
        created_at: conv.created_at,
        updated_at: conv.updated_at
      };
    });

    res.json(formattedConversations);
  });
});
CONVERSATIONS

# Sostituisci dall'inizio dell'endpoint fino alla sua chiusura
awk '
/^\/\/ Lista conversazioni dell.*utente$/ {
    skip = 1
    while ((getline line < "/tmp/new_conversations.txt") > 0) {
        print line
    }
    close("/tmp/new_conversations.txt")
}
skip && /^}\);$/ {
    skip = 0
    next
}
!skip {print}
' server.js > server.js.tmp && mv server.js.tmp server.js

echo -e "${GREEN}✅ Endpoint /api/conversations corretto${NC}"
echo ""

# ============================================================================
# 4. VERIFICA SINTASSI
# ============================================================================
echo -e "${YELLOW}🔍 Verifica sintassi JavaScript...${NC}"
if node -c server.js 2>&1; then
    echo -e "${GREEN}✅ Sintassi corretta${NC}"
else
    echo -e "${RED}❌ ERRORE SINTASSI! Ripristino backup...${NC}"
    cp "$BACKUP_FILE" server.js
    echo -e "${YELLOW}Backup ripristinato. Il server originale è intatto.${NC}"
    exit 1
fi
echo ""

# ============================================================================
# 5. RIAVVIO SERVER
# ============================================================================
echo -e "${YELLOW}🔄 Riavvio server...${NC}"

# Ferma il server
pkill -f "node server.js" 2>/dev/null || true
sleep 2

# Avvia il server
nohup node server.js > server.log 2>&1 &
sleep 3

# Verifica che sia attivo
if pgrep -f "node server.js" > /dev/null; then
    echo -e "${GREEN}✅ Server riavviato con successo${NC}"
    PID=$(pgrep -f "node server.js")
    echo -e "   PID: $PID"
else
    echo -e "${RED}❌ Errore riavvio server!${NC}"
    echo -e "${YELLOW}Controlla i log: tail -50 ~/meeq/server.log${NC}"
    exit 1
fi
echo ""

# ============================================================================
# 6. CLEANUP
# ============================================================================
rm -f /tmp/new_endpoint.txt /tmp/new_conversations.txt

# ============================================================================
# 7. RIEPILOGO
# ============================================================================
echo "============================================================"
echo -e "${GREEN}✅ FIX COMPLETATI CON SUCCESSO!${NC}"
echo "============================================================"
echo ""
echo "📋 Modifiche applicate:"
echo "  1. ✅ Aggiunto endpoint GET /api/table/:tableId/users"
echo "  2. ✅ Corretto endpoint GET /api/conversations"
echo ""
echo "📦 Backup salvato in: $BACKUP_FILE"
echo ""
echo "🔍 Verifica log:"
echo "   tail -f ~/meeq/server.log"
echo ""
echo "🌐 Testa l'app:"
echo "   http://172.16.0.10:3000"
echo ""
echo "============================================================"
