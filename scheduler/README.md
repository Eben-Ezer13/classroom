# Déclencheur des rappels Classroom

Cette option laisse l'application sur Vercel Hobby et fait appeler sa route de rappels chaque minute par Cloudflare Workers. Le Worker ne contient aucune donnée d'étudiant ; il transmet uniquement l'en-tête d'autorisation au endpoint Vercel. Le cron quotidien déjà configuré sur Vercel reste actif ; il est compatible avec Hobby et sert de rappel de secours.

## Mise en service

1. Dans les paramètres Vercel du projet, crée une variable `CRON_SECRET` avec une valeur longue et aléatoire, puis redéploie l'application. La route `/api/cron/reminders` refusera les appels sans ce secret.
2. Dans `wrangler.toml`, remplace `https://REMPLACER-DOMAINE` par le domaine de production de Classroom.
3. Installe Wrangler et connecte ton compte Cloudflare depuis un terminal : `npm install -g wrangler`, puis `wrangler login`.
4. Depuis le dossier `scheduler`, enregistre le même secret dans Cloudflare : `wrangler secret put CRON_SECRET`.
5. Déploie le Worker depuis ce dossier : `wrangler deploy`.
6. Dans Cloudflare, ouvre le Worker **classroom-reminder-cron**, puis **Settings → Triggers → Cron Triggers**. Vérifie qu'il affiche `* * * * *`. Les premières exécutions commencent après la propagation du déclencheur.

Le Worker appelle la route chaque minute en UTC. L'application vérifie ensuite les horaires dans le fuseau `Africa/Casablanca` avant d'envoyer les rappels. Les alertes push nécessitent aussi que chaque membre ait activé les notifications sur son appareil.

Pour vérifier le fonctionnement, consulte les journaux du Worker dans Cloudflare et cherche `rappels vérifiés`. Une réponse HTTP 401 indique que les valeurs `CRON_SECRET` de Vercel et Cloudflare ne correspondent pas.
