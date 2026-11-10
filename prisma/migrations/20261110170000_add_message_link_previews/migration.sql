CREATE TABLE "message_link_previews" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_link_previews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "message_link_previews_messageId_key" ON "message_link_previews"("messageId");

ALTER TABLE "message_link_previews"
ADD CONSTRAINT "message_link_previews_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
