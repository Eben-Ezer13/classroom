import 'server-only'
import { del, put as blobPut } from '@vercel/blob'
import { env } from '@/lib/env'
import { AppError } from '@/lib/errors'

/**
 * Driver Vercel Blob (production).
 *
 * Vercel Blob n'expose que des URL publiques : la confidentialite repose
 * donc sur trois garde-fous cumules.
 *   1. la cle contient un suffixe aleatoire (addRandomSuffix) : l'URL n'est
 *      pas devinable a partir du nom du fichier ni de l'identifiant de la
 *      classe ;
 *   2. l'URL n'est jamais transmise au navigateur : elle reste en base dans
 *      `filePath` et n'apparait dans aucune reponse ni dans aucun HTML ;
 *   3. le telechargement passe par une route applicative qui verifie
 *      l'appartenance a la classe avant de relayer le contenu.
 */

export async function put(
  key: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const result = await blobPut(key, data, {
    access: 'public',
    contentType,
    token: env.blobToken,
    // Rend l'URL non devinable meme si l'on connait la classe et le nom
    // du fichier.
    addRandomSuffix: true,
  })
  return result.url
}

export async function read(filePath: string): Promise<Buffer> {
  const response = await fetch(filePath, { cache: 'no-store' })
  if (!response.ok) {
    throw new AppError('Fichier introuvable dans le stockage.', 404)
  }
  return Buffer.from(await response.arrayBuffer())
}

/**
 * Flux de lecture relaye tel quel.
 * Evite de charger un fichier de 25 Mo en memoire dans la fonction
 * serverless : la reponse est diffusee au navigateur au fil de l'eau.
 */
export async function stream(filePath: string): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(filePath, { cache: 'no-store' })
  if (!response.ok || !response.body) {
    throw new AppError('Fichier introuvable dans le stockage.', 404)
  }
  return response.body
}

export async function remove(filePath: string): Promise<void> {
  await del(filePath, { token: env.blobToken })
}
