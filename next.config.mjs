const isDev = process.env.NODE_ENV !== 'production'

/**
 * Politique de securite du contenu volontairement ciblee : elle interdit
 * l'integration du site dans une page tierce (clickjacking), les balises
 * <base> et <object> detournees et l'envoi de formulaires vers un autre
 * domaine, sans toucher aux scripts de Next.js (qui exigeraient des nonces).
 */
const contentSecurityPolicy = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  experimental: {
    serverActions: {
      // En production, les fichiers volumineux partent directement du
      // navigateur vers Vercel Blob : une Server Action ne recoit que des
      // formulaires et la photo de profil (2 Mo). Vercel plafonne de toute
      // facon une requete a 4,5 Mo. En developpement (stockage local), les
      // fichiers transitent par l'action : la limite suit MAX_FILE_SIZE.
      bodySizeLimit: isDev ? '110mb' : '4mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          ...(isDev
            ? []
            : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000' }]),
        ],
      },
    ]
  },
}

export default nextConfig
