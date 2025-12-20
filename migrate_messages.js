const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/meeq.db');
const chatDb = new sqlite3.Database('./database/chat.db');

console.log('🔄 Inizio migrazione conversation_id...');
console.log('📁 Database: meeq.db (messages) + chat.db (conversations)');

// 1. Prendi tutte le conversazioni da chat.db
chatDb.all('SELECT id, user1_id, user2_id FROM conversations', [], (err, conversations) => {
  if (err) {
    console.error('❌ Errore lettura conversazioni da chat.db:', err);
    db.close();
    chatDb.close();
    return;
  }

  console.log(`📊 Trovate ${conversations.length} conversazioni in chat.db`);

  if (conversations.length === 0) {
    console.log('✅ Nessuna conversazione da migrare');
    db.close();
    chatDb.close();
    return;
  }

  let processed = 0;
  
  conversations.forEach(conv => {
    // 2. Aggiorna messaggi in meeq.db per questa conversazione
    console.log(`🔄 Elaboro conversazione ${conv.id}: User ${conv.user1_id} ↔ User ${conv.user2_id}`);
    
    db.run(`
      UPDATE messages 
      SET conversation_id = ?
      WHERE (sender_id = ? AND receiver_id = ?)
         OR (sender_id = ? AND receiver_id = ?)
    `, [conv.id, conv.user1_id, conv.user2_id, conv.user2_id, conv.user1_id], function(err) {
      if (err) {
        console.error(`❌ Errore aggiornamento conv ${conv.id}:`, err);
      } else {
        console.log(`✅ Conv ${conv.id}: ${this.changes} messaggi aggiornati`);
      }
      
      processed++;
      if (processed === conversations.length) {
        console.log('\n🎉 Migrazione completata!');
        
        // Verifica finale
        db.get('SELECT COUNT(*) as total FROM messages WHERE conversation_id IS NOT NULL', [], (err, row) => {
          if (err) {
            console.error('❌ Errore verifica:', err);
          } else {
            console.log(`✅ Totale messaggi con conversation_id: ${row.total}`);
          }
          db.close();
          chatDb.close();
        });
      }
    });
  });
});

});
});
