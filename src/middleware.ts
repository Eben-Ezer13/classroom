import { NextResponse, type NextRequest } from 'next/server'

/**
 * Le middleware s'execute sur le runtime Edge : Prisma n'y est pas
 * disponible. Il ne fait donc QU'UN aiguillage rapide sur la presence du
 * cookie, pour eviter un aller-retour inutile vers une page protegee.
 *
 * L'autorisation reelle (session valide, compte actif, role, appartenance a
 * la classe) est verifiee dans chaque page, Server Action et route API via
 * lib/auth/guards.ts et lib/permissions.ts. Un cookie forge ne donne donc
 * acces a rien.
 *
 * Le middleware ne redirige JAMAIS un visiteur muni d'un cookie hors des
 * ecrans de connexion : il ne sait pas si la session est encore valide. Un
 * cookie perime (session revoquee, compte desactive) provoquait sinon une
 * boucle /login -> /dashboard -> /login. Ce sont les pages de connexion et
 * d'inscription qui renvoient un utilisateur reellement connecte.
 */

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
])

const SESSION_COOKIE = 'cp_session'

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const hasCookie = request.cookies.has(SESSION_COOKIE)

  if (!hasCookie && !PUBLIC_PATHS.has(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // La destination complete (avec ?code=... d'une invitation) est
    // conservee : l'utilisateur y revient apres s'etre connecte.
    url.search =
      pathname === '/dashboard' ? '' : `?next=${encodeURIComponent(`${pathname}${search}`)}`
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf :
     * - les fichiers statiques Next.js
     * - TOUTES les routes /api : chacune fait son propre controle et doit
     *   repondre un statut exploitable (401 JSON) plutot qu'une redirection.
     *   Indispensable pour /api/cron, appelee par Vercel sans cookie : une
     *   redirection vers /login empecherait le cron de s'executer.
     * - les fichiers a la racine (favicon, robots...)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt|xml|webmanifest)$).*)',
  ],
}
