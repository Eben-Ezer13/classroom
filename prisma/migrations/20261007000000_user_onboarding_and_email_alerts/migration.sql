-- Preferences personnelles : guide de premiere connexion et consentement
-- explicite pour les alertes e-mail de classe.
ALTER TABLE "users"
  ADD COLUMN "emailAlerts" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "onboardingSeenAt" TIMESTAMP(3);
