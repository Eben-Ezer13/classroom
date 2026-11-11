/**
 * @typedef {{
 *   maxSize: number,
 *   mimeTypes: Record<string, string[]>,
 *   formats: string
 * }} UploadRule
 * @typedef {(bytes: number) => string} FormatSize
 */

/**
 * @param {string} name
 */
function fileExtension(name) {
  const parts = name.split(/[\\/]/)
  const base = parts[parts.length - 1] ?? ''
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot).toLowerCase() : ''
}

/**
 * @param {{ name: string, size: number }} file
 * @param {UploadRule} rule
 * @param {FormatSize} formatSize
 * @returns {{ ok: true, mimeType: string } | { ok: false, message: string }}
 */
export function checkUploadFile(file, rule, formatSize) {
  if (file.size <= 0) return { ok: false, message: 'Le fichier est vide.' }
  if (file.size > rule.maxSize) {
    return {
      ok: false,
      message:
        `Fichier trop volumineux (${formatSize(file.size)}). ` +
        `Maximum autorisé : ${formatSize(rule.maxSize)}.`,
    }
  }
  const extension = fileExtension(file.name)
  const mimeType = Object.keys(rule.mimeTypes).find((type) =>
    rule.mimeTypes[type].includes(extension),
  )
  if (!mimeType) {
    return {
      ok: false,
      message: `Format non autorisé (${extension || 'sans extension'}). Formats acceptés : ${rule.formats}.`,
    }
  }
  return { ok: true, mimeType }
}
