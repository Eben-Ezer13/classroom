# Plateforme de gestion de classe

Plateforme web permettant à un délégué de centraliser la vie académique d'une classe
(programme, ressources, annonces, projets, échéances, sondages, réclamations) et aux
étudiants d'y accéder depuis leur espace personnel.

L'architecture est prévue dès le départ pour passer d'**une classe** à
**plusieurs classes → plusieurs filières → plusieurs établissements** : toute donnée
est rattachée à une classe, et la hiérarchie académique complète vit en base de données.
Un étudiant ne peut rejoindre qu'une seule classe active ; une classe accepte jusqu'à
60 étudiants actifs. Les délégués peuvent administrer plusieurs classes.

---

## Stack

| Couche | Technologie |
|---|---|
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| Langage | TypeScript (mode strict) |
| UI | React 19 + Tailwind CSS 4, design system maison, thèmes clair/sombre |
| Base de données | PostgreSQL (Neon) via Prisma 6 |
| Authentification | Sessions opaques en base + cookie `httpOnly` (bcrypt) |
| Validation | Zod, à toutes les frontières serveur |
| Stockage fichiers | Vercel Blob en production, disque local en développement |
| Emails | Resend (ou driver `console` en développement) |
| Déploiement | Vercel (avec un Cron pour les rappels d'échéance) |

---

## Démarrage local

```bash
# 1. Dépendances
npm install

# 2. Variables d'environnement
cp .env.example .env      # puis renseigner DATABASE_URL, DIRECT_URL et les services utilisés

# 3. Schéma de base + client Prisma
npm run db:deploy         # applique prisma/migrations sur la base
npm run db:generate

# 4. Lancer (la base démarre volontairement vide)
npm run dev               # http://localhost:3000
```

### Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | `prisma generate` + build de production |
| `npm start` | Serveur de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Crée et applique une migration (développement) |
| `npm run db:deploy` | Applique les migrations existantes (production) |
| `npm run db:studio` | Prisma Studio |

---

## Configuration Neon

1. Créer un projet sur [neon.tech](https://neon.tech), puis une base.
2. Récupérer **deux** chaînes de connexion dans le tableau de bord Neon :
   - la connexion **poolée** (`...-pooler...`) → `DATABASE_URL`, utilisée au runtime ;
   - la connexion **directe** → `DIRECT_URL`, utilisée par `prisma migrate`.
   Les deux doivent contenir `?sslmode=require`.
3. Appliquer le schéma :
   ```bash
   npm run db:deploy
   ```

La base est intentionnellement vide après la migration. Le premier utilisateur
crée son compte puis sa classe depuis l'application ; aucun compte, code
d'inscription ou contenu de démonstration n'est installé.

Neon ne stocke que des métadonnées et des références de fichiers — **aucun binaire
n'est écrit en base**.

---

## Déploiement Vercel

1. Pousser le dépôt sur GitHub, puis importer le projet dans Vercel.
2. Renseigner les variables d'environnement (Production **et** Preview) :

   | Variable | Obligatoire | Détail |
   |---|---|---|
   | `DATABASE_URL` | oui | Connexion Neon poolée |
   | `DIRECT_URL` | oui | Connexion Neon directe |
   | `NEXT_PUBLIC_APP_URL` | oui | URL publique (liens des emails) |
   | `STORAGE_DRIVER` | oui | `vercel-blob` en production |
   | `BLOB_READ_WRITE_TOKEN` | oui | Fourni par le store Vercel Blob |
   | `MAIL_DRIVER` | oui | `resend` en production |
   | `RESEND_API_KEY`, `MAIL_FROM` | oui | Clé API et expéditeur Resend |
   | `CRON_SECRET` | oui | Généré par Vercel, protège `/api/cron/reminders` |

3. Créer un store **Vercel Blob** et le relier au projet (renseigne `BLOB_READ_WRITE_TOKEN`).
4. La commande de build par défaut (`npm run build`) exécute `prisma generate`.
   Appliquer les migrations depuis la machine locale ou en ajoutant
   `prisma migrate deploy &&` devant la commande de build.
5. Le Cron déclarée dans `vercel.json` appelle `/api/cron/reminders` chaque jour à 7h
   pour envoyer les rappels d'échéance. La route refuse tout appel sans en-tête
   `Authorization: Bearer $CRON_SECRET`.

---

## Architecture du code

```
prisma/
  schema.prisma            modèles, index et contraintes PostgreSQL
  migrations/              migration initiale SQL

src/
  app/
    (auth)/                connexion, inscription, mot de passe oublié / réinitialisation
    (app)/                 application authentifiée (coque avec sidebar + nav mobile)
      dashboard/ programme/ modules/ ressources/ recherche/
      projets/ echeances/ annonces/ sondages/
      notifications/ reclamations/ etudiants/ profil/
      admin/               structure, classes, années, utilisateurs, archives,
                           statistiques, journal d'audit
    actions/               Server Actions, une par domaine — toutes les écritures
    api/                   téléchargements autorisés, avatars, cron
  components/
    ui/                    design system (button, card, badge, table, modal…)
    layout/                coque applicative, navigation, thème
    features/              composants métier réutilisables
  lib/
    auth/                  sessions, mots de passe, gardes de rôle
    services/              accès en lecture, une par domaine
    permissions.ts         règles d'autorisation — point unique
    storage/               abstraction de stockage (local | vercel-blob)
    validation.ts          schémas Zod
    audit.ts               journalisation des actions sensibles
    notifications.ts       diffusion des notifications
  middleware.ts            aiguillage rapide sur la présence du cookie
```

### Séparation des responsabilités

- **Lecture** : les pages (Server Components) appellent `lib/services/*`.
- **Écriture** : uniquement via les Server Actions de `app/actions/*`.
- **Autorisation** : `lib/permissions.ts` et `lib/auth/guards.ts`, jamais dans l'UI.

---

## Modèle de sécurité

- **Tout est vérifié côté serveur.** Masquer un bouton n'est jamais considéré comme
  une protection : chaque Server Action commence par `requireUser()` / `requireRole()`.
- **Anti-IDOR par construction.** Toute donnée porte un `classGroupId`. Une lecture
  ou une écriture par identifiant est filtrée sur la classe de l'utilisateur ; un
  identifiant appartenant à une autre classe renvoie **404**, jamais 403 — l'existence
  de la ressource n'est pas révélée.
- **Réclamations** : un étudiant ne voit que les siennes, un délégué celles de sa
  classe, un administrateur toutes. La règle vit dans `lib/services/complaints.ts`.
- **Fichiers** : l'URL de stockage n'est jamais envoyée au navigateur. Les
  téléchargements passent par `/api/resources/[id]/download` et
  `/api/attachments/[id]/download`, qui vérifient les permissions avant de relayer
  le contenu.
- **Uploads** : taille, type MIME **et** extension sont contrôlés côté serveur
  (`lib/storage/index.ts`) ; le driver local interdit toute remontée de chemin.
- **Sessions** : jeton aléatoire de 256 bits, seul son SHA-256 est stocké. Une session
  est révocable instantanément — un changement de rôle, de classe, de mot de passe ou
  une désactivation ferme toutes les sessions du compte.
- **Connexion** : réponse et temps de réponse identiques que l'email existe ou non.
- **Injections** : toutes les requêtes passent par Prisma (requêtes paramétrées).
- **En-têtes** : `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` et
  `Permissions-Policy` sont posés dans `next.config.mjs`.

---

## Performance

- Pagination systématique (`PAGE_SIZE = 20`) — aucune requête ne charge une table entière.
- Compteur et page récupérés dans une seule transaction (`prisma.$transaction`).
- Index PostgreSQL sur tous les axes de filtrage (`classGroupId + date`,
  `classGroupId + dueAt`, `userId + readAt`, …).
- Requêtes indépendantes lancées en parallèle (`Promise.all`).
- `getCurrentUser()` est mémoïsé par rendu via `cache()` de React : une seule requête
  de session par page, quel que soit le nombre de composants qui la consultent.
- Aucune police téléchargée : pile système, donc pas de décalage de mise en page.

---

## Fonctionnement du stockage

`STORAGE_DRIVER` sélectionne le driver :

- `local` — écrit sous `./storage`, **hors du dossier public**. Pratique pour
  développer sans compte Vercel.
- `vercel-blob` — utilise Vercel Blob. L'URL retournée est conservée en base dans
  `filePath` et n'est jamais exposée : le téléchargement reste protégé par la route
  applicative.

Passer de l'un à l'autre ne demande aucune modification de code.
