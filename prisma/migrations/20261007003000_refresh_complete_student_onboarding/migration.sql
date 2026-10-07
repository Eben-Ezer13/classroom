-- Affiche une fois la visite complete aux etudiants ayant vu la version courte.
UPDATE "users"
SET "onboardingSeenAt" = NULL
WHERE "role" = 'ETUDIANT';
