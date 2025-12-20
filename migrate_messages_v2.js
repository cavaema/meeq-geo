const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./meeq.db');
const chatDb = new sqlite3.Database('./chat.db');

console.log('🔄 Inizio migrazione conversation_id...');
console.log('📁 Database: meeq.db (messages) + chat.db (conversations)');

chatDb.all('SELECT id, user1_id, user2_id FROM conversations', [], (err, conversations) => {
  if (err) {
    console.error('❌ Errore lettura conversazioni:', err);
    db.close();
    chatDb.close();
    return;
  }

  console.log(`📊 Trovate ${conversations.length} conversazioni`);

  if (conversations.length === 0) {
    console.log('✅ Nessuna conversazione da migrare');
    db.close();
    chatDb.close();
    return;
  }

  let processed = 0;
  
  conversations.forEach(conv => {
    console.log(`🔄 Conv ${conv.id}: User ${conv.user1_id} ↔ User ${conv.user2_id}`);
    
    db.run(
      'UPDATE messages SET conversation_id = ? WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
      [conv.id, conv.user1_id, conv.user2_id, conv.user2_id, conv.user1_id],
      function(err) {
        if (err) {
          console.error(`❌ Errore conv ${conv.id}:`, err);
        } else {
          console.log(`✅ Conv ${conv.id}: ${this.changes} messaggi aggiornati`);
        }
        
        processed++;
        if (processed === conversations.length) {
          console.log('\n🎉 Migrazione completata!');
          
          db.get('SELECT COUNT(*) as total FROM messages WHERE conversation_id IS NOT NULL', [], (err, row) => {
            if (!err) {
              console.log(`✅ Totale messaggi: ${row.total}`);
            }
            db.close();
            chatDb.close();
          });
        }
      }
    );
  });
});
