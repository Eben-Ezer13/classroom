import type { Metadata } from 'next'
import { requirePageUser } from '@/lib/auth/guards'
import { switchClassAction, leaveClassAction } from '@/app/actions/classes'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, EmptyState } from '@/components/ui/feedback'
import { ConfirmForm } from '@/components/ui/confirm-form'
import { IconGraduation } from '@/components/ui/icons'
import { CLASS_ROLE_LABELS } from '@/lib/constants'
import { CreateClassForm, JoinClassForm } from './class-forms'

export const metadata: Metadata = { title: 'Mes classes' }

/**
 * Point d'entree du multi-classes : un compte peut administrer une classe,
 * etre etudiant dans une autre, et basculer entre les deux. Chaque bascule
 * passe par le serveur, qui verifie l'appartenance avant d'ouvrir l'espace.
 */
export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenue?: string }>
}) {
  const user = await requirePageUser()
  const params = await searchParams
  const welcome = params.bienvenue === '1'

  return (
    <>
      <PageHeader
        title="Mes classes"
        description="Créez votre espace de classe ou rejoignez celui de votre délégué."
      />

      {welcome ? (
        <Alert tone="success" className="mb-4">
          Votre compte est créé. Créez maintenant votre classe si vous êtes délégué,
          ou rejoignez la votre avec le code fourni.
        </Alert>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader
              title="Espaces auxquels vous appartenez"
              description={
                user.memberships.length > 0
                  ? "Les données de chaque classe sont totalement indépendantes."
                  : undefined
              }
            />
            {user.memberships.length === 0 ? (
              <EmptyState
                icon={<IconGraduation />}
                title="Aucune classe pour le moment"
                description="Créez votre classe si vous êtes délégué, ou saisissez le code d’invitation reçu."
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {user.memberships.map((membership) => {
                  const active = membership.classGroupId === user.classGroupId
                  return (
                    <li
                      key={membership.classGroupId}
                      className="flex flex-wrap items-center gap-3 px-5 py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[14px] font-medium text-[var(--text-1)] truncate">
                            {membership.className}
                          </p>
                          <Badge tone={membership.role === 'ADMIN' ? 'accent' : 'neutral'}>
                            {CLASS_ROLE_LABELS[membership.role]}
                          </Badge>
                          {active ? <Badge tone="success">Espace ouvert</Badge> : null}
                        </div>
                        <p className="text-[12.5px] text-[var(--text-3)] mt-0.5 truncate">
                          {membership.schoolName}
                          {membership.programName ? ` · ${membership.programName}` : ''}
                          {membership.levelName ? ` · ${membership.levelName}` : ''}
                          {` · ${membership.memberCount} membre(s)`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {active ? null : (
                          <form action={switchClassAction}>
                            <input
                              type="hidden"
                              name="classGroupId"
                              value={membership.classGroupId}
                            />
                            <Button type="submit" size="sm" variant="secondary">
                              Ouvrir
                            </Button>
                          </form>
                        )}
                        <ConfirmForm
                          action={leaveClassAction}
                          hidden={{ classGroupId: membership.classGroupId }}
                          message={`Quitter la classe ${membership.className} ? Vous perdrez l acces a ses donnees.`}
                        >
                          <Button type="submit" size="sm" variant="ghost">
                            Quitter
                          </Button>
                        </ConfirmForm>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Créer une classe"
              description="Vous devenez automatiquement delegue (administrateur) de cet espace."
            />
            <CardBody>
              <CreateClassForm />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Rejoindre une classe"
              description="Avec le code de classe ou un lien d’invitation."
            />
            <CardBody>
              <JoinClassForm />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2 text-[13px] text-[var(--text-3)] leading-relaxed">
              <p className="font-medium text-[var(--text-2)]">Comment ca marche</p>
              <p>
                Chaque classe possede son propre espace : membres, programme, ressources,
                annonces et notifications. Aucune donnee n est partagee entre deux classes,
                meme si elles appartiennent a la meme ecole.
              </p>
              <p>
                Le délégué qui crée la classe en devient l’administrateur : il invite les
                etudiants, gere le programme et les ressources.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
