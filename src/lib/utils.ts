/**
 * Utilitaires partages client + serveur.
 * Aucune dependance a Prisma ni a Node ici : ce module est importable
 * depuis un composant client.
 */

/** Concatene des classes conditionnelles sans dependance externe. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** 510 -> "08:30" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "08:30" -> 510 */
export function timeToMinutes(value: string): number {
  const [h, m] = value.split(':')
  return Number(h) * 60 + Number(m)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

const DATE_SHORT_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const DATETIME_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const WEEKDAY_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function formatDate(date: Date | string): string {
  return DATE_FMT.format(new Date(date))
}

export function formatDateShort(date: Date | string): string {
  return DATE_SHORT_FMT.format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return DATETIME_FMT.format(new Date(date))
}

export function formatWeekday(date: Date | string): string {
  return WEEKDAY_FMT.format(new Date(date))
}

/** "dans 3 jours", "il y a 2 heures", "aujourd'hui" */
export function formatRelative(date: Date | string): string {
  const target = new Date(date).getTime()
  const diffMs = target - Date.now()
  const abs = Math.abs(diffMs)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  const rtf = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' })

  if (abs < minute) return "a l'instant"
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), 'minute')
  if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour')
  if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), 'day')
  if (abs < 365 * day) return rtf.format(Math.round(diffMs / (30 * day)), 'month')
  return rtf.format(Math.round(diffMs / (365 * day)), 'year')
}

/** Compte a rebours lisible : "3 j 4 h restants" / "Depassee". */
export function formatCountdown(dueAt: Date | string): string {
  const diff = new Date(dueAt).getTime() - Date.now()
  if (diff <= 0) return 'Depassee'
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  if (days > 0) return `${days} j ${hours} h restants`
  if (hours > 0) return `${hours} h ${minutes} min restantes`
  return `${minutes} min restantes`
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function fullName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`
}

/** Debut de journee locale (00:00:00.000). */
export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/** Lundi de la semaine contenant `date`. */
export function startOfWeek(date: Date = new Date()): Date {
  const d = startOfDay(date)
  const day = d.getDay() // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Convertit une date locale en date "pure" UTC minuit, pour les colonnes
 * PostgreSQL de type DATE (schedule_entries.date). Evite le decalage d'un
 * jour lie au fuseau horaire du serveur.
 */
export function toDateOnly(date: Date | string): Date {
  const d = new Date(date)
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

/** Inverse de toDateOnly : rend une date locale a partir d'une colonne DATE. */
export function fromDateOnly(date: Date | string): Date {
  const d = new Date(date)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function truncate(text: string, max = 140): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/** Normalise une chaine de recherche (trim + limite de longueur). */
export function normalizeSearch(value: string | undefined | null): string {
  return (value ?? '').trim().slice(0, 120)
}
