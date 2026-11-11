'use client'

import {
  useActionState,
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type PointerEvent,
} from 'react'
import Image from 'next/image'
import {
  changePasswordAction,
  updateEmailAlertsAction,
  updateAvatarAction,
  updateProfileAction,
} from '@/app/actions/auth'
import { emptyActionState } from '@/lib/errors'
import { Checkbox, Field, Input } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Spinner, SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/feedback'
import { useFormAction, useRefreshOnSuccess } from '@/components/ui/use-form-action'
import { AVATAR_MAX_SIZE, AVATAR_MIME_TYPES } from '@/lib/constants'
import { formatFileSize } from '@/lib/utils'

export function ProfileForm({
  defaults,
}: {
  defaults: {
    firstName: string
    lastName: string
    phone: string | null
    studentId: string | null
  }
}) {
  const { state, formAction, value } = useFormAction(updateProfileAction)

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Prénom" htmlFor="firstName" error={state.fieldErrors?.firstName} required>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={value('firstName', defaults.firstName)}
            required
            maxLength={60}
            autoComplete="given-name"
          />
        </Field>
        <Field label="Nom" htmlFor="lastName" error={state.fieldErrors?.lastName} required>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={value('lastName', defaults.lastName)}
            required
            maxLength={60}
            autoComplete="family-name"
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field
          label="Numéro étudiant"
          htmlFor="studentId"
          error={state.fieldErrors?.studentId}
        >
          <Input
            id="studentId"
            name="studentId"
            maxLength={40}
            defaultValue={value('studentId', defaults.studentId)}
          />
        </Field>
        <Field label="Téléphone" htmlFor="phone" error={state.fieldErrors?.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            maxLength={30}
            defaultValue={value('phone', defaults.phone)}
            autoComplete="tel"
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Enregistrement...">Enregistrer</SubmitButton>
      </div>
    </form>
  )
}

export function AvatarForm() {
  const [state, formAction, pending] = useActionState(updateAvatarAction, emptyActionState)
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [cropError, setCropError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [drag, setDrag] = useState<{
    pointerId: number
    x: number
    y: number
    offsetX: number
    offsetY: number
  } | null>(null)
  useRefreshOnSuccess(state)

  const previewSize = 240
  const scale = selectedImage
    ? Math.max(
        previewSize / selectedImage.naturalWidth,
        previewSize / selectedImage.naturalHeight,
      ) * zoom
    : 1
  const imageWidth = selectedImage ? selectedImage.naturalWidth * scale : previewSize
  const imageHeight = selectedImage ? selectedImage.naturalHeight * scale : previewSize

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    setOffset((current) => {
      const x = Math.max(
        -Math.max(0, (imageWidth - previewSize) / 2),
        Math.min(Math.max(0, (imageWidth - previewSize) / 2), current.x),
      )
      const y = Math.max(
        -Math.max(0, (imageHeight - previewSize) / 2),
        Math.min(Math.max(0, (imageHeight - previewSize) / 2), current.y),
      )
      return x === current.x && y === current.y ? current : { x, y }
    })
  }, [imageHeight, imageWidth, previewSize])

  function moveCrop(x: number, y: number) {
    setOffset({
      x: Math.max(
        -Math.max(0, (imageWidth - previewSize) / 2),
        Math.min(Math.max(0, (imageWidth - previewSize) / 2), x),
      ),
      y: Math.max(
        -Math.max(0, (imageHeight - previewSize) / 2),
        Math.min(Math.max(0, (imageHeight - previewSize) / 2), y),
      ),
    })
  }

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (!selectedImage) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    })
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return
    moveCrop(drag.offsetX + event.clientX - drag.x, drag.offsetY + event.clientY - drag.y)
  }

  async function submitAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || isPending) return
    setCropError(null)
    if (!selectedImage) {
      setCropError('Choisissez une image à recadrer.')
      return
    }
    const formData = new FormData(event.currentTarget)
    const sourceSize = previewSize / scale

    const canvas = document.createElement('canvas')
    const outputSize = Math.max(1, Math.min(2048, Math.floor(sourceSize)))
    canvas.width = outputSize
    canvas.height = outputSize
    const context = canvas.getContext('2d')
    if (!context) {
      setCropError('Le recadrage de cette image est impossible sur cet appareil.')
      return
    }

    const sourceX = selectedImage.naturalWidth / 2 - offset.x / scale - sourceSize / 2
    const sourceY = selectedImage.naturalHeight / 2 - offset.y / scale - sourceSize / 2
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      selectedImage,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize,
    )

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.98),
    )
    if (!blob) {
      setCropError('La photo n’a pas pu être préparée. Réessaie avec une autre image.')
      return
    }

    formData.set('avatar', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={submitAvatar} className="space-y-3">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}
      {cropError ? <Alert tone="danger">{cropError}</Alert> : null}

      <Field
        label="Nouvelle photo"
        htmlFor="avatar"
        hint={`${formatFileSize(AVATAR_MAX_SIZE)} maximum · PNG, JPEG ou WEBP`}
      >
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept={AVATAR_MIME_TYPES.join(',')}
          className="w-full text-[13px] text-[var(--text-2)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-[var(--accent-strong)] hover:file:brightness-95 cursor-pointer"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            setSelectedImage(null)
            setPreviewUrl(null)
            setZoom(1)
            setOffset({ x: 0, y: 0 })
            setCropError(null)
            if (!file) return
            const url = URL.createObjectURL(file)
            setPreviewUrl(url)
            const image = new window.Image()
            image.onload = () => setSelectedImage(image)
            image.onerror = () => setCropError('Cette image ne peut pas être ouverte.')
            image.src = url
          }}
        />
      </Field>

      {previewUrl ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div
            role="img"
            aria-label="Aperçu circulaire de la photo recadrée"
            className="relative size-60 touch-none overflow-hidden rounded-full border-2 border-[var(--accent)] bg-[var(--surface-3)] shadow-[0_0_0_4px_var(--accent-soft)]"
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={() => setDrag(null)}
            onPointerCancel={() => setDrag(null)}
            style={{ cursor: selectedImage ? (drag ? 'grabbing' : 'grab') : 'wait' }}
          >
            {selectedImage ? (
              <Image
                src={previewUrl}
                alt=""
                width={Math.round(imageWidth)}
                height={Math.round(imageHeight)}
                unoptimized
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{
                  width: imageWidth,
                  height: imageHeight,
                  left: `calc(50% + ${offset.x}px)`,
                  top: `calc(50% + ${offset.y}px)`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ) : (
              <span className="grid size-full place-items-center text-sm text-[var(--text-3)]">
                Chargement…
              </span>
            )}
          </div>
          <p className="text-center text-xs text-[var(--text-2)]">
            Faites glisser la photo dans le cercle pour choisir le cadrage.
          </p>
          <label className="flex w-full max-w-xs items-center gap-3 text-xs text-[var(--text-2)]">
            <span>Zoom</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(event) => setZoom(Number(event.currentTarget.value))}
              aria-label="Zoom de la photo"
              className="min-w-0 flex-1 accent-[var(--accent)]"
            />
          </label>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={!selectedImage || pending || isPending}
        >
          {pending || isPending ? (
            <>
              <Spinner />
              Envoi...
            </>
          ) : (
            'Mettre à jour la photo'
          )}
        </Button>
      </div>
    </form>
  )
}

/** Preference individuelle : les alertes sont toujours desactivees par defaut. */
export function EmailAlertsForm({ enabled }: { enabled: boolean }) {
  const { state, formAction, checked } = useFormAction(updateEmailAlertsAction)

  return (
    <form action={formAction} className="space-y-3">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <Checkbox
        name="emailAlerts"
        defaultChecked={checked('emailAlerts', enabled)}
        label="M’envoyer un e-mail lors d’une nouvelle ressource, annonce ou modification du délégué."
        className="items-start leading-5"
      />
      <p className="text-[12.5px] text-[var(--text-3)]">
        Ces alertes complètent les notifications de la plateforme. Vous pouvez les désactiver à tout moment.
      </p>

      <div className="flex justify-end">
        <SubmitButton size="sm" variant="secondary" pendingLabel="Enregistrement...">
          Enregistrer les alertes
        </SubmitButton>
      </div>
    </form>
  )
}

export function PasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, emptyActionState)

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
      ) : null}

      <Field
        label="Mot de passe actuel"
        htmlFor="currentPassword"
        error={state.fieldErrors?.currentPassword}
        required
      >
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          required
        />
      </Field>

      <Field
        label="Nouveau mot de passe"
        htmlFor="password"
        error={state.fieldErrors?.password}
        hint="10 caractères minimum, avec majuscule, minuscule et chiffre"
        required
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <Field
        label="Confirmer"
        htmlFor="confirmPassword"
        error={state.fieldErrors?.confirmPassword}
        required
      >
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
        />
      </Field>

      <p className="text-[12.5px] text-[var(--text-3)]">
        Toutes vos sessions seront fermées : vous devrez vous reconnecter.
      </p>

      <div className="flex justify-end">
        <SubmitButton variant="secondary" pendingLabel="Mise à jour...">
          Changer le mot de passe
        </SubmitButton>
      </div>
    </form>
  )
}
