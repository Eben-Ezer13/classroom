-- Limitation de debit (connexion, mot de passe oublie, inscription,
-- jetons d'envoi de fichiers). Une ligne par cle, fenetre fixe.
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- Purge quotidienne des compteurs expires (cron).
CREATE INDEX "rate_limits_expiresAt_idx" ON "rate_limits"("expiresAt");

-- Purge quotidienne des jetons de reinitialisation expires (cron).
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");
