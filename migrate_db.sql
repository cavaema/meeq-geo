-- MIGRAZIONE DATABASE MEEQ
-- Aggiunge colonna conversation_id alla tabella messages

-- 1. Aggiungi colonna conversation_id
ALTER TABLE messages ADD COLUMN conversation_id INTEGER;

-- 2. Crea indice per performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- 3. Verifica
SELECT COUNT(*) as total_messages FROM messages;
SELECT COUNT(*) as messages_without_conversation FROM messages WHERE conversation_id IS NULL;

-- Fine migrazione
