ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AUTORISATION';

CREATE TYPE "PermissionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "memberships"
  ADD COLUMN "isDeputy" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "delegatedPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE UNIQUE INDEX "memberships_one_deputy_per_class_key"
  ON "memberships"("classGroupId") WHERE "isDeputy" = true AND "isActive" = true;

CREATE TABLE "exams" (
  "id" TEXT NOT NULL,
  "classGroupId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "moduleId" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "exams_classGroupId_startsAt_idx" ON "exams"("classGroupId", "startsAt");
ALTER TABLE "exams" ADD CONSTRAINT "exams_classGroupId_fkey"
  FOREIGN KEY ("classGroupId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exams" ADD CONSTRAINT "exams_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "permission_requests" (
  "id" TEXT NOT NULL,
  "classGroupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "message" TEXT,
  "status" "PermissionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permission_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "permission_requests_classGroupId_status_createdAt_idx"
  ON "permission_requests"("classGroupId", "status", "createdAt");
CREATE INDEX "permission_requests_userId_status_idx"
  ON "permission_requests"("userId", "status");
ALTER TABLE "permission_requests" ADD CONSTRAINT "permission_requests_classGroupId_fkey"
  FOREIGN KEY ("classGroupId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "permission_requests" ADD CONSTRAINT "permission_requests_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "reminder_deliveries" (
  "id" TEXT NOT NULL,
  "classGroupId" TEXT NOT NULL,
  "reminderKey" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reminder_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reminder_deliveries_reminderKey_key" ON "reminder_deliveries"("reminderKey");
CREATE INDEX "reminder_deliveries_classGroupId_sentAt_idx" ON "reminder_deliveries"("classGroupId", "sentAt");
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_classGroupId_fkey"
  FOREIGN KEY ("classGroupId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
