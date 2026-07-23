import type { ManageConfig, PublicNeighborhood } from '@neighborhue/api/types'
import { EyeOpenIcon, LockClosedIcon } from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { formatHourLabel } from '../lib/hour'
import type { CustomColor, ManagePatch } from '../lib/manage'
import { type PaletteColor, type PaletteSummary, resolvePalette } from '../lib/palette'
import { validateTimezone } from '../lib/timezone'
import { CopyButton } from './CopyButton'
import { CustomColorsEditor } from './CustomColorsEditor'
import { DeleteDialog } from './DeleteDialog'
import { HaPanel } from './HaPanel'
import styles from './ManageView.module.css'
import { PalettePicker } from './PalettePicker'
import { RotationHourStepper } from './RotationHourStepper'
import { SaveIndicator } from './SaveIndicator'
import { ShareCard } from './ShareCard'
import { TimezoneField } from './TimezoneField'

interface ManageViewProps {
  id: string
  config: ManageConfig
  neighborhood: PublicNeighborhood
  palettes: PaletteSummary[]
  onSave: (patch: ManagePatch) => void
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  onRetrySave: () => void
  onDelete: () => void
  deleteStatus: 'idle' | 'deleting' | 'error'
}

export function ManageView({
  id,
  config,
  neighborhood,
  palettes,
  onSave,
  saveStatus,
  onRetrySave,
  onDelete,
  deleteStatus,
}: ManageViewProps) {
  const nameId = useId()
  const defaultSlug = palettes.find((p) => p.is_default)?.slug ?? palettes[0]?.slug ?? null
  const startCustom = (config.custom_colors?.length ?? 0) > 0

  const [name, setName] = useState(config.name ?? '')
  const [timezone, setTimezone] = useState(config.timezone)
  const [hour, setHour] = useState(config.rotation_hour)
  // palette=null with no custom colors means the neighborhood rides the default
  // palette (spec M2 / Create C3) — seed the default slug, not "Custom".
  const [paletteSlug, setPaletteSlug] = useState<string | null>(startCustom ? null : (config.palette ?? defaultSlug))
  const [custom, setCustom] = useState<CustomColor[]>(config.custom_colors ?? [])
  const [customMode, setCustomMode] = useState(startCustom)

  const shareUrl = `https://neighborhue.app/n/${id}`

  // Discrete commits (spec M1/M2).
  function pickPalette(slug: string | null) {
    if (slug === null) {
      setCustomMode(true) // transient — no PATCH until the first custom color (M2)
      return
    }
    setCustomMode(false)
    setPaletteSlug(slug)
    setCustom([])
    onSave({ palette: slug, custom_colors: null })
  }

  function commitCustom(next: CustomColor[]) {
    setCustom(next)
    if (next.length === 0) {
      onSave({ custom_colors: null })
    } else {
      setPaletteSlug(null)
      onSave({ palette: null, custom_colors: next })
    }
  }

  function commitHour(next: number) {
    setHour(next)
    onSave({ rotation_hour: next })
  }

  // Preview: swatches reflect the local edit; the big color is the server's real
  // today-color (props), which the container refetches after a palette/custom save (M6).
  const resolved = resolvePalette(paletteSlug, palettes)
  const previewColors: PaletteColor[] = customMode
    ? custom.map((c) => ({ hex: c.hex, name: c.name ?? null }))
    : resolved.kind === 'curated'
      ? resolved.colors
      : []
  const previewPaletteName = customMode || resolved.kind !== 'curated' ? 'Custom colors' : resolved.name
  const selectedSlug = customMode ? null : paletteSlug

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" aria-label="Neighborhue home" className={styles.logo} />
        <Link to="/n/$id" params={{ id }} className={styles.viewPublic}>
          <EyeOpenIcon aria-hidden /> View public page
        </Link>
      </header>

      <main className={styles.main}>
        <div className={styles.titleRow}>
          <h1 className={styles.h1}>Manage</h1>
          <span className={styles.secretChip}>
            <LockClosedIcon aria-hidden /> Secret link
          </span>
          <SaveIndicator status={saveStatus} onRetry={onRetrySave} />
        </div>
        <p className={styles.subtitle}>
          You're editing <b>{name.trim() || 'Untitled'}</b> via its private link. Changes are live for everyone immediately.
        </p>

        <div className={styles.columns}>
          <div className={styles.left}>
            <section className={styles.card}>
              <h2 className={styles.cardHeading}>Details</h2>
              <div className={styles.field}>
                <label htmlFor={nameId} className={styles.label}>
                  Neighborhood name
                </label>
                <input
                  id={nameId}
                  className={styles.input}
                  value={name}
                  maxLength={120}
                  placeholder="Untitled"
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => name.trim() !== (config.name ?? '') && onSave({ name: name.trim() || null })}
                />
              </div>
              {/* The fieldset's onBlur fires when focus leaves the tz input; save a valid, changed zone. */}
              <fieldset
                className={styles.tzGroup}
                onBlur={() => timezone !== config.timezone && validateTimezone(timezone) && onSave({ timezone })}
              >
                <TimezoneField value={timezone} detectedZone={timezone} hideValidHint onChange={setTimezone} />
              </fieldset>
              <div className={styles.field}>
                <span className={styles.label}>Rotation hour</span>
                <RotationHourStepper hour={hour} onChange={commitHour} />
              </div>
            </section>

            <section className={styles.card}>
              <h2 className={styles.cardHeading}>Palette</h2>
              <PalettePicker palettes={palettes} selectedSlug={selectedSlug} onSelect={pickPalette} />
              {customMode && <CustomColorsEditor colors={custom} onChange={commitCustom} />}
            </section>

            <section className={styles.card}>
              <h2 className={styles.cardHeading}>Share &amp; connect</h2>
              <p className={styles.label}>Public share link</p>
              <div className={styles.linkRow}>
                <span className={styles.url}>{shareUrl}</span>
                <CopyButton value={shareUrl} label="Copy share link" />
              </div>
              <HaPanel neighborhoodId={id} />
            </section>

            <section className={styles.dangerCard}>
              <div>
                <h2 className={styles.dangerHeading}>Delete neighborhood</h2>
                <p className={styles.dangerBody}>Permanently removes it. Neighbors' lights stop updating.</p>
              </div>
              <DeleteDialog name={config.name} status={deleteStatus} onConfirm={onDelete} />
            </section>
          </div>

          <div className={styles.right}>
            <p className={styles.previewEyebrow}>Live preview · today</p>
            <ShareCard
              name={name}
              activeColor={neighborhood.color}
              colors={previewColors}
              paletteName={previewPaletteName}
              rotationLabel={formatHourLabel(hour)}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
