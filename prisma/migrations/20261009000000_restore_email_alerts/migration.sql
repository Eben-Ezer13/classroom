-- Les alertes e-mail sont une preference individuelle, desactivee par defaut.
ALTER TABLE "users" ADD COLUMN "emailAlerts" BOOLEAN NOT NULL DEFAULT false;
