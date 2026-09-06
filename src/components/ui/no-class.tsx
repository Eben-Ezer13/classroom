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
        description="Créez votre classe si vous êtes délégué, ou rejoignez votre classe avec le code d’invitation fourni."
        action={
          <LinkButton href="/classes" size="sm">
            Créer ou rejoindre une classe
          </LinkButton>
        }
      />
    </Card>
  )
}
