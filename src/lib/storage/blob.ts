import 'server-only'
import {
  BlobAccessError,
  BlobNotFoundError,
  BlobStoreNotFoundError,
  del,
  get,
  head,
  put as blobPut,
} from '@vercel/blob'
import { env } from '@/lib/env'
import { AppError } from '@/lib/errors'

/**
 * Driver Vercel Blob (production).
 *
 * Deux modes de store, fixes a sa creation :
 *   - "private" (recommande) : toute lecture exige le jeton du serveur. Une
 *     URL qui fuiterait ne donne acces a rien ;
 *   - "public" : l'URL suffit a lire le fichier. La confidentialite repose
 *     alors sur le suffixe aleatoire de la cle et sur le fait que l'URL
 *     n'est jamais affichee.
 *
 * Dans les deux cas, le telechargement passe par une route applicative qui
 * verifie l'appartenance a la classe avant de relayer le contenu en flux.
 * Le mode de lecture est deduit de l'URL : un store peut ainsi changer de
 * mode sans rendre illisibles les fichiers deja enregistres.
 */

const BLOB_HOST = /\.blob\.vercel-storage\.com$/

function accessOf(url: string): 'public' | 'private' {
  return new URL(url).hostname.includes('.private.') ? 'private' : 'public'
}

/** URL de Vercel Blob bien formee : refuse tout autre hote (anti-SSRF). */
export function isBlobUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && BLOB_HOST.test(url.hostname)
  } catch {
    return false
  }
}

export async function put(key: string, data: Buffer, contentType: string): Promise<string> {
  const result = await blobPut(key, data, {
    access: env.blobAccess,
    contentType,
    token: env.blobToken,
    // Rend l'URL non devinable meme si l'on connait la classe et le nom.
    addRandomSuffix: true,
  })
  return result.url
}

export type BlobMetadata = {
  url: string
  pathname: string
  size: number
  contentType: string
}

/**
 * Metadonnees reelles d'un fichier envoye directement par le navigateur.
 * Taille et type viennent du stockage, jamais du formulaire. Renvoie null si
 * le fichier n'existe pas dans NOTRE store.
 */
export async function inspect(url: string): Promise<BlobMetadata | null> {
  if (!isBlobUrl(url)) return null
  try {
    const meta = await head(url, { token: env.blobToken })
    return {
      url: meta.url,
      pathname: meta.pathname,
      size: meta.size,
      contentType: meta.contentType.split(';')[0].trim().toLowerCase(),
    }
  } catch (error) {
    if (
      error instanceof BlobNotFoundError ||
      error instanceof BlobAccessError ||
      error instanceof BlobStoreNotFoundError
    ) {
      return null
    }
    throw error
  }
}

/**
 * Flux de lecture relaye tel quel : un fichier de 100 Mo n'est jamais charge
 * en memoire, et une reponse diffusee en flux echappe a la limite de 4,5 Mo
 * des reponses de fonctions Vercel.
 */
export async function stream(filePath: string): Promise<ReadableStream<Uint8Array>> {
  if (!isBlobUrl(filePath)) {
    throw new AppError('Fichier introuvable dans le stockage.', 404)
  }
  const result = await get(filePath, { access: accessOf(filePath), token: env.blobToken })
  if (!result || result.statusCode !== 200) {
    throw new AppError('Fichier introuvable dans le stockage.', 404)
  }
  return result.stream
}

export async function remove(filePath: string): Promise<void> {
  await del(filePath, { token: env.blobToken })
}
