import 'server-only'
import { NextResponse } from 'next/server'
import { readStream } from '@/lib/storage'

/**
 * En-tete Content-Disposition compatible avec tous les navigateurs : nom
 * ASCII de repli (sans guillemet ni antislash, qui casseraient l'en-tete)
 * et nom UTF-8 complet (RFC 5987) pour les accents.
 */
export function contentDisposition(type: 'inline' | 'attachment', fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

/**
 * Relaie un fichier stocke EN FLUX. Aucun fichier n'est charge en memoire,
 * et une reponse diffusee n'est pas soumise a la limite de 4,5 Mo des
 * reponses de fonctions Vercel.
 *
 * A n'appeler qu'APRES la verification des droits : cette fonction ne
 * controle rien elle-meme.
 */
export async function streamStoredFile(
  file: { filePath: string; fileName: string; mimeType: string | null },
  options: {
    disposition: 'inline' | 'attachment'
    cacheControl?: string
    logLabel: string
  },
): Promise<NextResponse> {
  let body: ReadableStream<Uint8Array>
  try {
    body = await readStream(file.filePath)
  } catch (error) {
    console.error(`[${options.logLabel}] fichier illisible`, error)
    return NextResponse.json({ error: 'Fichier indisponible dans le stockage.' }, { status: 502 })
  }

  return new NextResponse(body, {
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': contentDisposition(options.disposition, file.fileName),
      // Contenu servi sous condition de permission : jamais de cache partage.
      'Cache-Control': options.cacheControl ?? 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
