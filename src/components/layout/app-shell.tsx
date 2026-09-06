'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CLASS_ROLE_LABELS } from '@/lib/constants'
import { Avatar } from '@/components/ui/avatar'
import { ThemeToggle } from './theme'
import {
  IconClose,
  IconGraduation,
  IconLogout,
  IconMenu,
  IconSearch,
  IconUser,
} from '@/components/ui/icons'
import { MOBILE_NAV, navForRole, type NavItem, type Role } from './nav-config'

export type ShellClass = {
  classGroupId: string
  className: string
  schoolName: string
  role: Role
}

export type ShellUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  /** Role dans la classe active. */
  role: Role
  avatarUrl: string | null
  activeClassId: string | null
  className: string | null
  schoolName: string | null
  levelName: string | null
  programName: string | null
  /** Toutes les classes de l'utilisateur : alimente le selecteur d'espace. */
  classes: ShellClass[]
}

/**
 * Coque applicative : barre laterale sur desktop, tiroir + barre inferieure
 * sur mobile. Les enfants restent rendus cote serveur.
 */
export function AppShell({
  user,
  unreadCount,
  logout,
  switchClass,
  children,
}: {
  user: ShellUser
  unreadCount: number
  logout: () => Promise<void>
  switchClass: (formData: FormData) => Promise<void>
  children: ReactNode
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const sections = navForRole(user.role)

  // Toute navigation ferme le tiroir : sans cela il resterait ouvert
  // par-dessus la nouvelle page sur mobile.
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  return (
    <div className="min-h-dvh">
      {/* ---------- Barre laterale (desktop) ---------- */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[264px] flex-col border-r border-[var(--border)] bg-[var(--surface-1)] z-30">
        <SidebarContent
          user={user}
          sections={sections}
          unreadCount={unreadCount}
          pathname={pathname}
          switchClass={switchClass}
        />
      </aside>

      {/* ---------- Tiroir (mobile) ---------- */}
      {drawerOpen ? (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/45 animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-[280px] max-w-[85vw] bg-[var(--surface-1)] border-r border-[var(--border)] flex flex-col animate-fade-in">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Fermer le menu"
              className="absolute top-3.5 right-3 size-8 grid place-items-center rounded-lg text-[var(--text-3)] hover:bg-[var(--surface-3)]"
            >
              <IconClose className="size-4" />
            </button>
            <SidebarContent
              user={user}
              sections={sections}
              unreadCount={unreadCount}
              pathname={pathname}
              switchClass={switchClass}
            />
          </aside>
        </div>
      ) : null}

      {/* ---------- Colonne principale ---------- */}
      <div className="lg:pl-[264px] flex flex-col min-h-dvh">
        <header className="sticky top-0 z-20 h-14 flex items-center gap-2 px-3 sm:px-5 border-b border-[var(--border)] bg-[var(--surface-1)]/85 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le menu"
            className="lg:hidden size-9 grid place-items-center rounded-lg text-[var(--text-2)] hover:bg-[var(--surface-3)]"
          >
            <IconMenu />
          </button>

          <Link
            href="/dashboard"
            className="lg:hidden flex items-center gap-2 font-semibold text-[15px] text-[var(--text-1)]"
          >
            <span className="size-7 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] grid place-items-center">
              <IconGraduation className="size-4" />
            </span>
            Classe
          </Link>

          <div className="hidden lg:block min-w-0">
            <p className="text-[13px] text-[var(--text-3)] truncate">
              {user.schoolName ?? 'Aucune classe'}
              {user.programName ? ` · ${user.programName}` : ''}
              {user.levelName ? ` · ${user.levelName}` : ''}
              {user.className ? ` · ${user.className}` : ''}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/recherche"
              aria-label="Recherche globale"
              className="size-9 grid place-items-center rounded-lg text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
            >
              <IconSearch />
            </Link>
            <ThemeToggle />
            <UserMenu user={user} logout={logout} />
          </div>
        </header>

        <main className="flex-1 px-3 sm:px-5 lg:px-7 py-5 pb-24 lg:pb-10 max-w-[1320px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* ---------- Barre inferieure (mobile) ---------- */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border)] bg-[var(--surface-1)]/95 backdrop-blur-md">
        <ul className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon
            const count = item.badge === 'notifications' ? unreadCount : 0
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'relative flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-medium transition-colors',
                    active ? 'text-[var(--accent)]' : 'text-[var(--text-3)]',
                  )}
                >
                  <span className="relative">
                    <Icon className="size-5" />
                    {count > 0 ? (
                      <span className="absolute -top-1 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--danger)] text-white text-[9.5px] font-semibold grid place-items-center">
                        {count > 9 ? '9+' : count}
                      </span>
                    ) : null}
                  </span>
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard' || href === '/admin') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarContent({
  user,
  sections,
  unreadCount,
  pathname,
  switchClass,
}: {
  user: ShellUser
  sections: ReturnType<typeof navForRole>
  unreadCount: number
  pathname: string
  switchClass: (formData: FormData) => Promise<void>
}) {
  return (
    <>
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-[var(--border)] shrink-0">
        <span className="size-8 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] grid place-items-center shrink-0">
          <IconGraduation className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[var(--text-1)] leading-tight truncate">
            Gestion de classe
          </p>
          <p className="text-[11.5px] text-[var(--text-3)] truncate">
            {user.className ?? 'Aucune classe'}
          </p>
        </div>
      </div>

      <ClassSwitcher user={user} switchClass={switchClass} />

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-2.5 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-3)]">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item: NavItem) => {
                const active = isActive(pathname, item.href)
                const Icon = item.icon
                const count = item.badge === 'notifications' ? unreadCount : 0
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors',
                        active
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                          : 'text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]',
                      )}
                    >
                      <Icon
                        className={cn(
                          'size-[18px] shrink-0',
                          active ? 'text-[var(--accent)]' : 'text-[var(--text-3)]',
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                      {count > 0 ? (
                        <span className="ml-auto min-w-[19px] h-[19px] px-1.5 rounded-full bg-[var(--danger)] text-white text-[10.5px] font-semibold grid place-items-center">
                          {count > 99 ? '99+' : count}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-[var(--border)] shrink-0">
        <Link
          href="/profil"
          className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-[var(--surface-3)] transition-colors"
        >
          <Avatar
            firstName={user.firstName}
            lastName={user.lastName}
            src={user.avatarUrl}
            size="md"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[var(--text-1)] truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-[11.5px] text-[var(--text-3)] truncate">
              {CLASS_ROLE_LABELS[user.role]}
            </p>
          </div>
        </Link>
      </div>
    </>
  )
}

function UserMenu({ user, logout }: { user: ShellUser; logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu du compte"
        className="ml-1 rounded-full focus-visible:outline-2"
      >
        <Avatar
          firstName={user.firstName}
          lastName={user.lastName}
          src={user.avatarUrl}
          size="sm"
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] shadow-[var(--shadow-lg)] p-1.5 animate-scale-in"
        >
          <div className="px-2.5 py-2 border-b border-[var(--border)] mb-1">
            <p className="text-[13px] font-medium text-[var(--text-1)] truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-[11.5px] text-[var(--text-3)] truncate">{user.email}</p>
          </div>
          <Link
            href="/profil"
            role="menuitem"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
          >
            <IconUser className="size-4" />
            Mon profil
          </Link>
          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors"
            >
              <IconLogout className="size-4" />
              Se deconnecter
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Selecteur d'espace de classe.
 *
 * Le changement passe par une Server Action : le serveur verifie
 * l'appartenance avant de basculer, et la page est entierement re-rendue.
 * Aucune donnee de l'ancienne classe ne subsiste a l'ecran.
 */
function ClassSwitcher({
  user,
  switchClass,
}: {
  user: ShellUser
  switchClass: (formData: FormData) => Promise<void>
}) {
  if (user.classes.length === 0) {
    return (
      <div className="px-3 pt-3">
        <Link
          href="/classes"
          className="block rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-2.5 text-[12.5px] text-[var(--text-2)] hover:bg-[var(--surface-3)] transition-colors"
        >
          Creer ou rejoindre une classe
        </Link>
      </div>
    )
  }

  return (
    <div className="px-3 pt-3 space-y-1.5">
      {user.classes.length > 1 ? (
        <form action={switchClass}>
          <label htmlFor="class-switcher" className="sr-only">
            Changer d espace de classe
          </label>
          <select
            id="class-switcher"
            name="classGroupId"
            defaultValue={user.activeClassId ?? undefined}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="w-full h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] px-2.5 text-[12.5px] text-[var(--text-1)] cursor-pointer focus:border-[var(--accent)] focus:outline-none"
          >
            {user.classes.map((item) => (
              <option key={item.classGroupId} value={item.classGroupId}>
                {item.className} — {item.schoolName}
              </option>
            ))}
          </select>
          <noscript>
            <button type="submit" className="mt-1 text-[12px] underline">
              Changer
            </button>
          </noscript>
        </form>
      ) : null}
      <Link
        href="/classes"
        className="block text-[11.5px] text-[var(--text-3)] hover:text-[var(--text-1)] px-1 transition-colors"
      >
        Mes classes ({user.classes.length})
      </Link>
    </div>
  )
}
