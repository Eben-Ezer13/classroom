import { Card } from './card'
import { EmptyState } from './feedback'
import { LinkButton } from './button'
import { IconGraduation } from './icons'

/**
 * Etat affiche lorsque le compte n'appartient a aucune classe.
 * Plutot qu'une page vide, on renvoie vers l'ecran ou l'on cree son espace
 * ou l'on rejoint celui de son delegue.
 */
export function NoClassState() {
  return (
    <Card>
      <EmptyState
        icon={<IconGraduation />}
        title="Aucune classe active"
        description="Creez votre classe si vous etes delegue, ou rejoignez celle de votre classe avec le code d invitation fourni."
        action={
          <LinkButton href="/classes" size="sm">
            Creer ou rejoindre une classe
          </LinkButton>
        }
      />
    </Card>
  )
}
