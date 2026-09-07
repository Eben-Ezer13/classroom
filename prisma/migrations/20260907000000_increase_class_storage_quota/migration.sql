-- Increase the per-class storage quota from 2 GiB to 10 GiB.
ALTER TABLE "classes"
  ALTER COLUMN "storageQuota" SET DEFAULT 10737418240;

UPDATE "classes"
SET "storageQuota" = 10737418240
WHERE "storageQuota" = 2147483648;