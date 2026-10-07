-- Affiche une fois le nouveau guide pas a pas aux etudiants deja inscrits.
UPDATE "users"
SET "onboardingSeenAt" = NULL
WHERE "role" = 'ETUDIANT';
