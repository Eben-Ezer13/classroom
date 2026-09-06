import 'server-only'

/**
 * Acces centralise et valide aux variables d'environnement.
 * Aucune valeur secrete n'est jamais ecrite en dur dans le code, et aucune
 * n'est prefixee NEXT_PUBLIC_ : rien ne fuit vers le navigateur.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        `Copiez .env.example vers .env et renseignez-la.`,
    )
  }
  return value
}

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback
}

export const env = {
  get databaseUrl() {
    return required('DATABASE_URL')
  },
  get appUrl() {
    const explicit = optional('NEXT_PUBLIC_APP_URL')
    if (explicit) return explicit.replace(/\/$/, '')
    // Vercel fournit l'URL du deploiement : evite un lien d'invitation
    // pointant vers localhost si la variable n'a pas ete renseignee.
    const vercel = optional('VERCEL_PROJECT_PRODUCTION_URL') || optional('VERCEL_URL')
    if (vercel) return `https://${vercel}`
    return 'http://localhost:3000'
  },
  /**
   * Driver de stockage.
   * Deduit du jeton disponible plutot que d'un reglage a ne pas oublier :
   * un deploiement Vercel avec BLOB_READ_WRITE_TOKEN bascule tout seul.
   */
  get storageDriver(): 'local' | 'vercel-blob' {
    const explicit = optional('STORAGE_DRIVER')
    if (explicit === 'vercel-blob') return 'vercel-blob'
    if (explicit === 'local') return 'local'
    return optional('BLOB_READ_WRITE_TOKEN') ? 'vercel-blob' : 'local'
  },
  get blobToken() {
    return required('BLOB_READ_WRITE_TOKEN')
  },
  get isProduction() {
    return process.env.NODE_ENV === 'production'
  },
}
