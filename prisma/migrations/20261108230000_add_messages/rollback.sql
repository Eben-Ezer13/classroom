DROP TABLE IF EXISTS "message_reads";
DROP TABLE IF EXISTS "message_attachments";
DROP TABLE IF EXISTS "message_mentions";
DROP TABLE IF EXISTS "messages";
DROP TABLE IF EXISTS "conversation_members";
DROP TABLE IF EXISTS "conversations";
DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261108230000_add_messages';
