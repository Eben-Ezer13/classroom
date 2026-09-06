import 'server-only'
import fs from 'fs/promises'
import { createReadStream } from 'fs'
import { Readable } from 'stream'
import path from 'path'
import { AppError } from '@/lib/errors'

/**
 * Driver de developpement : ecrit sous ./storage, hors du dossier public.
 * Les fichiers ne sont donc jamais servis directement par Next.js ; ils
 * passent obligatoirement par la route de telechargement authentifiee.
 *
 * Inutilisable en production : le systeme de fichiers d'une fonction
 * serverless est en lecture seule et ephemere. `assertUsableDriver`
 * (storage/index.ts) refuse ce driver hors developpement.
 */

const ROOT = path.join(process.cwd(), 'storage')

/** Empeche toute remontee hors du dossier de stockage (path traversal). */
function resolveSafe(key: string): string {
  const target = path.resolve(ROOT, key)
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    throw new AppError('Chemin de fichier invalide.')
  }
  return target
}

export async function put(
  key: string,
  data: Buffer,
  _contentType: string,
): Promise<string> {
  const target = resolveSafe(key)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, data)
  return key
}

export async function read(filePath: string): Promise<Buffer> {
  return fs.readFile(resolveSafe(filePath))
}

/** Flux de lecture : le fichier n'est jamais charge entierement en memoire. */
export async function stream(filePath: string): Promise<ReadableStream<Uint8Array>> {
  const target = resolveSafe(filePath)
  await fs.access(target)
  return Readable.toWeb(createReadStream(target)) as ReadableStream<Uint8Array>
}

export async function remove(filePath: string): Promise<void> {
  await fs.unlink(resolveSafe(filePath))
}
