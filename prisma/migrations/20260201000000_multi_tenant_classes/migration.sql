-- =====================================================================
-- Passage au multi-tenant : la CLASSE devient l'espace de donnees.
--
-- Cette migration est ADDITIVE : aucune donnee existante n'est supprimee.
-- Elle cree la table d'appartenance (memberships), denormalise l'identite
-- academique sur la classe, rattache les annees academiques a une classe
-- et prepare les invitations, l'emploi du temps televerse et les mentions.
--
-- Hypothese de reprise : les installations anterieures au multi-tenant
-- avaient une seule classe par etablissement (structure creee par un
-- administrateur unique). Chaque annee academique est donc rattachee a la
-- classe qui exploite reellement ses semestres.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Nouveaux types
-- ---------------------------------------------------------------------
CREATE TYPE "ClassRole" AS ENUM ('ADMIN', 'MEMBER');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MENTION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEMBRE';

-- ---------------------------------------------------------------------
-- 2. La classe porte son identite academique et son quota de stockage
-- ---------------------------------------------------------------------
ALTER TABLE "classes"
  ADD COLUMN "schoolName"   TEXT,
  ADD COLUMN "programName"  TEXT,
  ADD COLUMN "levelName"    TEXT,
  ADD COLUMN "description"  TEXT,
  ADD COLUMN "createdById"  TEXT,
  ADD COLUMN "storageUsed"  BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "storageQuota" BIGINT NOT NULL DEFAULT 2147483648;

-- Reprise depuis la hierarchie Etablissement > Filiere > Niveau.
UPDATE "classes" c
SET "schoolName"  = i."name",
    "programName" = p."name",
    "levelName"   = l."name"
FROM "levels" l
JOIN "programs" p    ON p."id" = l."programId"
JOIN "institutions" i ON i."id" = p."institutionId"
WHERE c."levelId" = l."id";

UPDATE "classes" SET "schoolName" = 'Etablissement' WHERE "schoolName" IS NULL;

ALTER TABLE "classes" ALTER COLUMN "schoolName" SET NOT NULL;

-- Le rattachement hierarchique devient facultatif : une classe creee par
-- un delegue n'a plus besoin d'un niveau, d'une filiere ni d'un etablissement.
ALTER TABLE "classes" DROP CONSTRAINT "classes_levelId_fkey";
ALTER TABLE "classes" ALTER COLUMN "levelId" DROP NOT NULL;
ALTER TABLE "classes" ADD CONSTRAINT "classes_levelId_fkey"
  FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- 3. Table d'appartenance
-- ---------------------------------------------------------------------
CREATE TABLE "memberships" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "role"         "ClassRole" NOT NULL DEFAULT 'MEMBER',
    "studentId"    TEXT,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "joinedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "memberships_userId_classGroupId_key" ON "memberships"("userId", "classGroupId");
CREATE UNIQUE INDEX "memberships_classGroupId_studentId_key" ON "memberships"("classGroupId", "studentId");
CREATE INDEX "memberships_classGroupId_role_idx"     ON "memberships"("classGroupId", "role");
CREATE INDEX "memberships_classGroupId_isActive_idx" ON "memberships"("classGroupId", "isActive");
CREATE INDEX "memberships_userId_isActive_idx"       ON "memberships"("userId", "isActive");

ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_classGroupId_fkey"
  FOREIGN KEY ("classGroupId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise : tout compte rattache a une classe devient membre de cette
-- classe. Les anciens roles globaux ADMIN et DELEGUE deviennent des
-- delegues (ADMIN) de leur classe ; les etudiants deviennent MEMBER.
INSERT INTO "memberships" ("id", "userId", "classGroupId", "role", "studentId", "isActive", "joinedAt", "updatedAt")
SELECT
  'mgr_' || replace(gen_random_uuid()::text, '-', ''),
  u."id",
  u."classGroupId",
  CASE WHEN u."role" IN ('ADMIN', 'DELEGUE') THEN 'ADMIN'::"ClassRole" ELSE 'MEMBER'::"ClassRole" END,
  u."studentId",
  (u."isActive" AND u."deletedAt" IS NULL),
  u."createdAt",
  CURRENT_TIMESTAMP
FROM "users" u
WHERE u."classGroupId" IS NOT NULL;

-- Le numero etudiant devient propre a la classe : la contrainte globale
-- portee par users n'a plus de sens.
DROP INDEX IF EXISTS "users_classGroupId_studentId_key";

-- Createur de la classe : le premier delegue connu.
UPDATE "classes" c
SET "createdById" = m."userId"
FROM (
  SELECT DISTINCT ON ("classGroupId") "classGroupId", "userId"
  FROM "memberships"
  WHERE "role" = 'ADMIN'
  ORDER BY "classGroupId", "joinedAt" ASC
) m
WHERE m."classGroupId" = c."id";

ALTER TABLE "classes" ADD CONSTRAINT "classes_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "classes_createdById_idx" ON "classes"("createdById");

-- ---------------------------------------------------------------------
-- 4. Presence et classe active
-- ---------------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
CREATE INDEX "users_lastSeenAt_idx" ON "users"("lastSeenAt");

-- ---------------------------------------------------------------------
-- 5. Les annees academiques appartiennent a une classe
-- ---------------------------------------------------------------------
ALTER TABLE "academic_years" ADD COLUMN "classGroupId" TEXT;

-- Rattachement a la classe qui exploite reellement les semestres de l'annee.
UPDATE "academic_years" y
SET "classGroupId" = src."classGroupId"
FROM (
  SELECT DISTINCT ON (s."academicYearId") s."academicYearId", m."classGroupId"
  FROM "semesters" s
  JOIN "modules" m ON m."semesterId" = s."id"
  GROUP BY s."academicYearId", m."classGroupId"
  ORDER BY s."academicYearId", COUNT(*) DESC
) src
WHERE src."academicYearId" = y."id";

-- A defaut : la plus ancienne classe de l'etablissement d'origine.
UPDATE "academic_years" y
SET "classGroupId" = fallback."id"
FROM (
  SELECT DISTINCT ON (p."institutionId") p."institutionId", c."id"
  FROM "classes" c
  JOIN "levels" l   ON l."id" = c."levelId"
  JOIN "programs" p ON p."id" = l."programId"
  ORDER BY p."institutionId", c."createdAt" ASC
) fallback
WHERE y."classGroupId" IS NULL AND fallback."institutionId" = y."institutionId";

-- Une annee qui ne peut etre rattachee a aucune classe n'est exploitable
-- par personne : elle est retiree (aucun contenu ne la reference, sinon
-- l'etape precedente l'aurait rattachee).
DELETE FROM "academic_years" WHERE "classGroupId" IS NULL;

ALTER TABLE "academic_years" ALTER COLUMN "classGroupId" SET NOT NULL;
ALTER TABLE "academic_years" ALTER COLUMN "institutionId" DROP NOT NULL;

ALTER TABLE "academic_years" DROP CONSTRAINT "academic_years_institutionId_fkey";
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_classGroupId_fkey"
  FOREIGN KEY ("classGroupId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "academic_years_institutionId_isCurrent_idx";
DROP INDEX IF EXISTS "academic_years_institutionId_label_key";
CREATE UNIQUE INDEX "academic_years_classGroupId_label_key" ON "academic_years"("classGroupId", "label");
CREATE INDEX "academic_years_classGroupId_isCurrent_idx" ON "academic_years"("classGroupId", "isCurrent");

-- ---------------------------------------------------------------------
-- 6. Invitations
-- ---------------------------------------------------------------------
CREATE TABLE "invitations" (
    "id"           TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "code"         TEXT NOT NULL,
    "role"         "ClassRole" NOT NULL DEFAULT 'MEMBER',
    "email"        TEXT,
    "label"        TEXT,
    "maxUses"      INTEGER NOT NULL DEFAULT 0,
    "usedCount"    INTEGER NOT NULL DEFAULT 0,
    "expiresAt"    TIMESTAMP(3),
    "revokedAt"    TIMESTAMP(3),
    "createdById"  TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invitations_code_key" ON "invitations"("code");
CREATE INDEX "invitations_classGroupId_createdAt_idx" ON "invitations"("classGroupId", "createdAt");

ALTER TABLE "invitations" ADD CONSTRAINT "invitations_classGroupId_fkey"
  FOREIGN KEY ("classGroupId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- 7. Emploi du temps televerse (image / PDF)
-- ---------------------------------------------------------------------
CREATE TABLE "schedule_documents" (
    "id"           TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "semesterId"   TEXT,
    "title"        TEXT NOT NULL,
    "note"         TEXT,
    "fileName"     TEXT NOT NULL,
    "filePath"     TEXT NOT NULL,
    "fileSize"     INTEGER NOT NULL,
    "mimeType"     TEXT NOT NULL,
    "isCurrent"    BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "deletedAt"    TIMESTAMP(3),

    CONSTRAINT "schedule_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "schedule_documents_classGroupId_createdAt_idx" ON "schedule_documents"("classGroupId", "createdAt");

ALTER TABLE "schedule_documents" ADD CONSTRAINT "schedule_documents_classGroupId_fkey"
  FOREIGN KEY ("classGroupId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "schedule_documents" ADD CONSTRAINT "schedule_documents_semesterId_fkey"
  FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "schedule_documents" ADD CONSTRAINT "schedule_documents_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- 8. Mentions dans les annonces
-- ---------------------------------------------------------------------
ALTER TABLE "announcements" ADD COLUMN "mentionsAll" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "announcement_mentions" (
    "id"             TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_mentions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "announcement_mentions_announcementId_userId_key" ON "announcement_mentions"("announcementId", "userId");
CREATE INDEX "announcement_mentions_userId_idx" ON "announcement_mentions"("userId");

ALTER TABLE "announcement_mentions" ADD CONSTRAINT "announcement_mentions_announcementId_fkey"
  FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_mentions" ADD CONSTRAINT "announcement_mentions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- 9. Notifications rattachees a leur classe
-- ---------------------------------------------------------------------
ALTER TABLE "notifications" ADD COLUMN "classGroupId" TEXT;

CREATE INDEX "notifications_userId_classGroupId_readAt_idx" ON "notifications"("userId", "classGroupId", "readAt");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_classGroupId_fkey"
  FOREIGN KEY ("classGroupId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Les notifications existantes appartiennent a la classe de leur destinataire.
UPDATE "notifications" n
SET "classGroupId" = u."classGroupId"
FROM "users" u
WHERE u."id" = n."userId" AND u."classGroupId" IS NOT NULL;

-- ---------------------------------------------------------------------
-- 10. Index de lecture supplementaires
-- ---------------------------------------------------------------------
CREATE INDEX "resources_classGroupId_kind_idx" ON "resources"("classGroupId", "kind");

-- La suppression d'une classe emporte son journal d'audit.
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_classGroupId_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_classGroupId_fkey"
  FOREIGN KEY ("classGroupId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
