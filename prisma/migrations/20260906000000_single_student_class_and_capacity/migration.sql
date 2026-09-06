-- Un etudiant (MEMBER) ne peut appartenir qu'a une seule classe active.
-- Les delegues (ADMIN) peuvent continuer a administrer plusieurs classes.
CREATE UNIQUE INDEX "memberships_one_active_student_per_user_key"
  ON "memberships" ("userId")
  WHERE "isActive" = TRUE AND "role" = 'MEMBER';

-- Une classe peut accueillir jusqu'a 60 etudiants actifs. Le verrou sur la
-- ligne de classe rend ce plafond fiable meme lorsque des inscriptions sont
-- envoyees simultanement.
CREATE OR REPLACE FUNCTION enforce_class_student_capacity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."isActive" = TRUE
     AND NEW."role" = 'MEMBER'
     AND (
       TG_OP = 'INSERT'
       OR OLD."isActive" IS DISTINCT FROM TRUE
       OR OLD."role" IS DISTINCT FROM 'MEMBER'
       OR OLD."classGroupId" IS DISTINCT FROM NEW."classGroupId"
     ) THEN
    PERFORM 1 FROM "classes" WHERE "id" = NEW."classGroupId" FOR UPDATE;

    IF (
      SELECT COUNT(*)
      FROM "memberships"
      WHERE "classGroupId" = NEW."classGroupId"
        AND "isActive" = TRUE
        AND "role" = 'MEMBER'
    ) >= 60 THEN
      RAISE EXCEPTION 'Cette classe a atteint sa capacite de 60 etudiants.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memberships_enforce_student_capacity
  BEFORE INSERT OR UPDATE OF "classGroupId", "role", "isActive"
  ON "memberships"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_class_student_capacity();
