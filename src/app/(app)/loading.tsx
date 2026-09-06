/**
 * Squelette affiche pendant le chargement d'une page du groupe applicatif.
 * Evite l'ecran vide entre deux navigations sur une connexion lente.
 */
export default function Loading() {
  return (
    <div className="animate-fade-in">
      <div className="mb-5 space-y-2">
        <div className="skeleton h-7 w-56" />
        <div className="skeleton h-4 w-80" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-[92px] rounded-2xl" />
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
        <div className="space-y-4">
          <div className="skeleton h-56 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
