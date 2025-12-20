// ============================================================================
// Script per Cancellare Utenti dal Server Centrale
// ============================================================================
// Esegui sul VPS: node delete-users-central.js
// ============================================================================

const sqlite3 = require('sqlite3').verbose();
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const db = new sqlite3.Database('./central.db', (err) => {
  if (err) {
    console.error('❌ Errore connessione database:', err);
    process.exit(1);
  }
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function listUsers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, email, nome, cognome, created_at FROM users ORDER BY created_at DESC', (err, users) => {
      if (err) {
        reject(err);
      } else {
        resolve(users);
      }
    });
  });
}

async function deleteUser(userId) {
  return new Promise((resolve, reject) => {
    // Prima verifica se esiste
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
      if (err) {
        return reject(err);
      }

      if (!user) {
        return reject(new Error('Utente non trovato'));
      }

      // Elimina dati correlati
      db.serialize(() => {
        db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId], (err1) => {
          if (err1) console.error('⚠️ Errore eliminazione refresh tokens:', err1);
        });

        db.run('DELETE FROM reports WHERE reporter_id = ? OR reported_user_id = ?', [userId, userId], (err2) => {
          if (err2) console.error('⚠️ Errore eliminazione reports:', err2);
        });

        db.run('DELETE FROM pending_registrations WHERE email = ?', [user.email], (err3) => {
          if (err3) console.error('⚠️ Errore eliminazione pending registrations:', err3);
        });

        db.run('DELETE FROM users WHERE id = ?', [userId], function(err4) {
          if (err4) {
            return reject(err4);
          }

          resolve({ success: true, user });
        });
      });
    });
  });
}

async function main() {
  console.log('🗑️  Cancellazione Utenti - Server Centrale');
  console.log('==========================================');
  console.log('');

  try {
    // Lista utenti
    const users = await listUsers();

    if (!users || users.length === 0) {
      console.log('ℹ️  Nessun utente trovato nel database');
      db.close();
      rl.close();
      return;
    }

    console.log(`📊 Trovati ${users.length} utenti:`);
    console.log('');
    users.forEach((user, index) => {
      console.log(`${index + 1}. [ID: ${user.id}] ${user.email} - ${user.nome} ${user.cognome}`);
    });
    console.log('');

    // Chiedi quale utente cancellare
    const answer = await question('Inserisci l\'ID dell\'utente da cancellare (o "all" per cancellare tutti, "exit" per uscire): ');

    if (answer.toLowerCase() === 'exit') {
      console.log('❌ Operazione annullata');
      db.close();
      rl.close();
      return;
    }

    if (answer.toLowerCase() === 'all') {
      const confirm = await question('⚠️  ATTENZIONE: Vuoi davvero cancellare TUTTI gli utenti? (scrivi "SI" per confermare): ');
      if (confirm !== 'SI') {
        console.log('❌ Operazione annullata');
        db.close();
        rl.close();
        return;
      }

      console.log('');
      console.log('🗑️  Cancellazione di tutti gli utenti...');
      
      let deleted = 0;
      for (const user of users) {
        try {
          await deleteUser(user.id);
          console.log(`   ✅ Cancellato: ${user.email} (ID: ${user.id})`);
          deleted++;
        } catch (error) {
          console.log(`   ❌ Errore cancellazione ${user.email}: ${error.message}`);
        }
      }

      console.log('');
      console.log(`✅ Completato: ${deleted}/${users.length} utenti cancellati`);
    } else {
      const userId = parseInt(answer);
      if (isNaN(userId)) {
        console.log('❌ ID non valido');
        db.close();
        rl.close();
        return;
      }

      const user = users.find(u => u.id === userId);
      if (!user) {
        console.log('❌ Utente non trovato');
        db.close();
        rl.close();
        return;
      }

      const confirm = await question(`⚠️  Vuoi davvero cancellare l'utente "${user.email}" (${user.nome} ${user.cognome})? (scrivi "SI" per confermare): `);
      if (confirm !== 'SI') {
        console.log('❌ Operazione annullata');
        db.close();
        rl.close();
        return;
      }

      console.log('');
      console.log('🗑️  Cancellazione in corso...');
      
      try {
        await deleteUser(userId);
        console.log(`✅ Utente cancellato con successo: ${user.email} (ID: ${userId})`);
      } catch (error) {
        console.log(`❌ Errore: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    db.close();
    rl.close();
  }
}

main();

