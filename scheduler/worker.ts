interface Env {
  APP_CRON_URL: string
  CRON_SECRET: string
}

interface ScheduledContext {
  waitUntil(promise: Promise<unknown>): void
}

async function callReminderEndpoint(env: Env): Promise<void> {
  const endpoint = new URL(env.APP_CRON_URL)
  if (endpoint.protocol !== 'https:') {
    throw new Error('APP_CRON_URL doit utiliser HTTPS.')
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    signal: AbortSignal.timeout(55_000),
  })

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500)
    console.error(`[reminder-cron] HTTP ${response.status}: ${detail}`)
    throw new Error(`Le cron de Classroom a répondu ${response.status}.`)
  }

  console.log('[reminder-cron] rappels vérifiés', await response.text())
}

const worker = {
  scheduled(_controller: { cron: string; scheduledTime: number }, env: Env, context: ScheduledContext) {
    context.waitUntil(callReminderEndpoint(env))
  },
}

export default worker
