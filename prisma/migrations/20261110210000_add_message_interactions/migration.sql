CREATE TABLE "message_shares" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "shareType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_shares_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "message_pins" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "pinnedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_pins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "message_reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "message_reports" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "message_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "message_shares_messageId_key" ON "message_shares"("messageId");
CREATE INDEX "message_shares_shareType_entityId_idx" ON "message_shares"("shareType", "entityId");
CREATE UNIQUE INDEX "message_pins_messageId_key" ON "message_pins"("messageId");
CREATE INDEX "message_pins_messageId_createdAt_idx" ON "message_pins"("messageId", "createdAt");
CREATE UNIQUE INDEX "message_reactions_messageId_userId_emoji_key" ON "message_reactions"("messageId", "userId", "emoji");
CREATE INDEX "message_reactions_messageId_emoji_idx" ON "message_reactions"("messageId", "emoji");
CREATE INDEX "message_reports_messageId_createdAt_idx" ON "message_reports"("messageId", "createdAt");
CREATE INDEX "message_reports_reporterId_createdAt_idx" ON "message_reports"("reporterId", "createdAt");
CREATE INDEX "message_reports_status_createdAt_idx" ON "message_reports"("status", "createdAt");

ALTER TABLE "message_shares"
ADD CONSTRAINT "message_shares_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_pins"
ADD CONSTRAINT "message_pins_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_pins"
ADD CONSTRAINT "message_pins_pinnedById_fkey"
FOREIGN KEY ("pinnedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_reactions"
ADD CONSTRAINT "message_reactions_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_reactions"
ADD CONSTRAINT "message_reactions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_reports"
ADD CONSTRAINT "message_reports_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_reports"
ADD CONSTRAINT "message_reports_reporterId_fkey"
FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_reports"
ADD CONSTRAINT "message_reports_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
