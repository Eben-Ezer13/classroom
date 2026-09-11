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

const SIZE_FMT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

/** 1536 -> "2 Ko", 1572864 -> "1,5 Mo", 10737418240 -> "10 Go". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  if (bytes < 1024 * 1024 * 1024) return `${SIZE_FMT.format(bytes / (1024 * 1024))} Mo`
  return `${SIZE_FMT.format(bytes / (1024 * 1024 * 1024))} Go`
}

// ---------------------------------------------------------------------------
// Fuseau horaire de reference
// ---------------------------------------------------------------------------

/**
 * Toutes les heures sont saisies, enregistrees et affichees dans CE fuseau,
 * cote serveur comme cote navigateur. Sans reference commune, le serveur
 * (UTC sur Vercel) et le navigateur (fuseau de l'utilisateur) lisaient
 * differemment une meme saisie "14:00" : chaque modification d'echeance la
 * decalait du fuseau de l'utilisateur.
 *
 * Deux sortes de dates coexistent :
 *   - les INSTANTS (echeances, publications...) : formates dans APP_TIMEZONE ;
 *   - les JOURS CALENDAIRES (colonne DATE du programme, bornes d'annee) :
 *     stockes a minuit UTC et formates en UTC, pour ne jamais changer de jour.
 */
const DEFAULT_TIMEZONE = 'Africa/Casablanca'

function resolveTimeZone(value: string | undefined): string {
  const candidate = value?.trim() || DEFAULT_TIMEZONE
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: candidate })
    return candidate
  } catch {
    return 'UTC'
  }
}

export const APP_TIMEZONE = resolveTimeZone(process.env.NEXT_PUBLIC_APP_TIMEZONE)

const PARTS_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** Composantes d'un instant, lues dans le fuseau de reference. */
function zonedParts(date: Date): ZonedParts {
  const out: Record<string, string> = {}
  for (const part of PARTS_FMT.formatToParts(date)) out[part.type] = part.value
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
  }
}

function zoneOffsetMs(date: Date): number {
  const p = zonedParts(date)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/**
 * Heure murale du fuseau de reference -> instant UTC.
 * Deux passes : la seconde corrige le cas ou l'heure demandee tombe de
 * l'autre cote d'un changement d'heure.
 */
function zonedTimeToUtc(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const first = zoneOffsetMs(new Date(guess))
  let result = guess - first
  const second = zoneOffsetMs(new Date(result))
  if (second !== first) result = guess - second
  return new Date(result)
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Lit la valeur d'un champ date. "2026-09-11T14:00" (datetime-local, sans
 * fuseau) est interprete dans le fuseau de reference ; une date seule
 * "2026-09-11" reste un jour calendaire a minuit UTC.
 */
export function parseDateInput(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value.trim())
  if (match) {
    return zonedTimeToUtc(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
    )
  }
  return new Date(value)
}

/** Valeur d'un <input type="datetime-local">, exprimee dans le fuseau de reference. */
export function toDateTimeInputValue(date: Date | string | null | undefined): string {
  if (!date) return ''
  const p = zonedParts(new Date(date))
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

// ---------------------------------------------------------------------------
// Formatage
// ---------------------------------------------------------------------------

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: APP_TIMEZONE,
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

const DATE_SHORT_FMT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: APP_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const DATETIME_FMT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: APP_TIMEZONE,
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const WEEKDAY_FMT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: APP_TIMEZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const CALENDAR_DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

const CALENDAR_DATE_SHORT_FMT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const CALENDAR_WEEKDAY_FMT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** Jour d'un instant ("11 septembre 2026"), dans le fuseau de reference. */
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

/** Jour calendaire (colonne DATE, minuit UTC) : jamais decale d'un jour. */
export function formatCalendarDate(date: Date | string): string {
  return CALENDAR_DATE_FMT.format(new Date(date))
}

export function formatCalendarDateShort(date: Date | string): string {
  return CALENDAR_DATE_SHORT_FMT.format(new Date(date))
}

export function formatCalendarWeekday(date: Date | string): string {
  return CALENDAR_WEEKDAY_FMT.format(new Date(date))
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

  if (abs < minute) return "à l'instant"
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), 'minute')
  if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour')
  if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), 'day')
  if (abs < 365 * day) return rtf.format(Math.round(diffMs / (30 * day)), 'month')
  return rtf.format(Math.round(diffMs / (365 * day)), 'year')
}

/** Compte a rebours lisible : "3 j 4 h restants" / "Dépassée". */
export function formatCountdown(dueAt: Date | string): string {
  const diff = new Date(dueAt).getTime() - Date.now()
  if (diff <= 0) return 'Dépassée'
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

// ---------------------------------------------------------------------------
// Journees (instants) et jours calendaires
// ---------------------------------------------------------------------------

/** Instant de debut de la journee (00:00 dans le fuseau de reference). */
export function startOfDay(date: Date = new Date()): Date {
  const p = zonedParts(date)
  return zonedTimeToUtc(p.year, p.month, p.day)
}

/** Dernier instant de la journee (23:59:59.999 dans le fuseau de reference). */
export function endOfDay(date: Date = new Date()): Date {
  const p = zonedParts(date)
  return new Date(zonedTimeToUtc(p.year, p.month, p.day + 1).getTime() - 1)
}

/** Minutes ecoulees depuis minuit, dans le fuseau de reference. */
export function minutesOfDay(date: Date = new Date()): number {
  const p = zonedParts(date)
  return p.hour * 60 + p.minute
}

/**
 * Jour calendaire "pur" (minuit UTC), pour les colonnes PostgreSQL de type
 * DATE (schedule_entries.date). Une valeur d'<input type="date"> est deja a
 * minuit UTC : la normalisation ne change jamais le jour.
 */
export function toDateOnly(date: Date | string): Date {
  const d = new Date(date)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/** Jour calendaire courant dans le fuseau de reference. */
export function todayDateOnly(now: Date = new Date()): Date {
  const p = zonedParts(now)
  return new Date(Date.UTC(p.year, p.month - 1, p.day))
}

/** Decale un jour calendaire (arithmetique UTC : pas de changement d'heure). */
export function addDays(date: Date, days: number): Date {
  return new Date(toDateOnly(date).getTime() + days * 86_400_000)
}

/** Lundi de la semaine contenant ce jour calendaire. */
export function startOfWeek(date: Date = todayDateOnly()): Date {
  const day = toDateOnly(date)
  const weekday = day.getUTCDay() // 0 = dimanche
  return addDays(day, weekday === 0 ? -6 : 1 - weekday)
}

export function truncate(text: string, max = 140): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/** Normalise une chaine de recherche (trim + limite de longueur). */
export function normalizeSearch(value: string | undefined | null): string {
  return (value ?? '').trim().slice(0, 120)
}

/**
 * Destination de retour apres connexion ("?next=/rejoindre?code=..."),
 * acceptee uniquement si elle reste sur le site : un chemin absolu local,
 * jamais "//autre-site" ni une URL complete (redirection ouverte).
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const path = value.trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null
  if (path.length > 500 || /[\u0000-\u001f\u007f]/.test(path)) return null
  try {
    const url = new URL(path, 'http://localhost')
    if (url.origin !== 'http://localhost') return null
    // Les ecrans d'entree ne sont jamais une destination utile.
    if (['/login', '/register'].includes(url.pathname)) return null
    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}

/** Code d'invitation contenu dans une destination "/rejoindre?code=...". */
export function inviteCodeFromNext(next: string | null): string | null {
  if (!next) return null
  try {
    const url = new URL(next, 'http://localhost')
    if (url.pathname !== '/rejoindre') return null
    const code = url.searchParams.get('code')?.trim().toUpperCase()
    return code && /^[A-Z0-9]{4,40}$/.test(code) ? code : null
  } catch {
    return null
  }
}
