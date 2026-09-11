'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import {
  UPLOAD_RULES,
  UPLOAD_TOKEN_ROUTE,
  checkFile,
  directUploadField,
  storageFileName,
  uploadPrefix,
  type UploadKind,
} from '@/lib/uploads'

/**
 * Envoi des fichiers depuis le navigateur.
 *
 * En production (Vercel Blob), le fichier part directement vers le stockage :
 * une requete vers une fonction Vercel est plafonnee a 4,5 Mo. Le
 * formulaire ne transmet ensuite a la Server Action que la reference du
 * fichier, que le serveur revalide entierement.
 *
 * En developpement (stockage local), le formulaire est envoye tel quel.
 */

export type UploadConfig = {
  mode: 'direct' | 'server'
  access: 'public' | 'private'
  userId: string
  /** Classe active : dossier de depot par defaut. */
  classGroupId: string | null
}

const UploadConfigContext = createContext<UploadConfig | null>(null)

export function UploadConfigProvider({
  value,
  children,
}: {
  value: UploadConfig
  children: ReactNode
}) {
  return <UploadConfigContext.Provider value={value}>{children}</UploadConfigContext.Provider>
}

/** Au-dela, l'envoi est decoupe en parties envoyees en parallele et relancees. */
const MULTIPART_THRESHOLD = 8 * 1024 * 1024

async function requestToken(
  pathname: string,
  payload: { kind: UploadKind; classGroupId: string; size: number },
  multipart: boolean,
): Promise<string> {
  const response = await fetch(UPLOAD_TOKEN_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: { pathname, clientPayload: JSON.stringify(payload), multipart },
    }),
  })
  const data = (await response.json().catch(() => null)) as
    | { clientToken?: string; error?: string }
    | null
  if (!response.ok || !data?.clientToken) {
    throw new Error(data?.error ?? 'Envoi refusé par le serveur.')
  }
  return data.clientToken
}

function describeUploadError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/access/i.test(message) && /(private|public)/i.test(message)) {
    return (
      'Le stockage refuse ce mode d’accès : vérifiez que BLOB_ACCESS correspond ' +
      'au mode (privé ou public) choisi à la création du store Vercel Blob.'
    )
  }
  if (/network|failed to fetch|load failed/i.test(message)) {
    return 'Connexion interrompue pendant l’envoi. Vérifiez votre réseau et réessayez.'
  }
  return message ? `Échec de l’envoi : ${message}` : 'Échec de l’envoi du fichier.'
}

export type PrepareOptions = {
  /** Nom du champ <input type="file"> dans le formulaire. */
  field: string
  kind: UploadKind
  /** Classe de rattachement, si differente de la classe active. */
  classGroupId?: string | null
}

/**
 * Prepare les fichiers d'un formulaire avant l'appel a la Server Action.
 * Renvoie un message d'erreur, ou null si le formulaire peut partir.
 */
export function useDirectUploads() {
  const config = useContext(UploadConfigContext)
  const [progress, setProgress] = useState<number | null>(null)

  const prepare = useCallback(
    async (formData: FormData, options: PrepareOptions): Promise<string | null> => {
      const rule = UPLOAD_RULES[options.kind]
      const files = formData
        .getAll(options.field)
        .filter((file): file is File => file instanceof File && file.size > 0)

      // Controle immediat, avant tout transfert : le serveur refera le sien.
      if (files.length > rule.maxFiles) return `${rule.maxFiles} fichier(s) maximum.`
      const checks = files.map((file) => checkFile(file, rule))
      const invalid = checks.find((check) => !check.ok)
      if (invalid && !invalid.ok) return invalid.message

      if (!config || config.mode !== 'direct' || files.length === 0) return null

      const classGroupId = options.classGroupId || config.classGroupId
      if (!classGroupId) return 'Aucune classe active : rechargez la page.'
      const prefix = uploadPrefix(options.kind, classGroupId, config.userId)

      const total = files.reduce((sum, file) => sum + file.size, 0)
      let sent = 0
      setProgress(0)
      try {
        // Charge a la demande : inutile de l'embarquer sur chaque page.
        const { put } = await import('@vercel/blob/client')
        const refs: string[] = []
        for (const [index, file] of files.entries()) {
          const check = checks[index]
          if (!check.ok) return check.message
          const pathname = `${prefix}/${storageFileName(file.name)}`
          const multipart = file.size > MULTIPART_THRESHOLD
          const token = await requestToken(
            pathname,
            { kind: options.kind, classGroupId, size: file.size },
            multipart,
          )
          const blob = await put(pathname, file, {
            access: config.access,
            token,
            contentType: check.mimeType,
            multipart,
            onUploadProgress: ({ loaded }) => {
              setProgress(Math.min(99, Math.round(((sent + loaded) / total) * 100)))
            },
          })
          sent += file.size
          refs.push(JSON.stringify({ url: blob.url, name: file.name }))
        }
        // Les fichiers ne transitent plus par la Server Action : seules leurs
        // references sont transmises.
        formData.delete(options.field)
        for (const ref of refs) formData.append(directUploadField(options.field), ref)
        return null
      } catch (error) {
        return describeUploadError(error)
      } finally {
        setProgress(null)
      }
    },
    [config],
  )

  return { prepare, progress }
}

/** Libelle du bouton pendant l'envoi. */
export function uploadPendingLabel(progress: number | null, fallback: string): string {
  return progress === null ? fallback : `Envoi du fichier… ${progress} %`
}
