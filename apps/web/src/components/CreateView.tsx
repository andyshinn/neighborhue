import type { CreatedNeighborhood } from '@neighborhue/api/types'
import { ArrowLeftIcon, ArrowRightIcon } from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'
import { useId, useMemo, useState } from 'react'
import { usePaletteCycle } from '../hooks/usePaletteCycle'
import { formatHourLabel } from '../lib/hour'
import type { CreateBody } from '../lib/neighborhood'
import type { PaletteColor, PaletteSummary } from '../lib/palette'
import { validateTimezone } from '../lib/timezone'
import { CreateSuccess } from './CreateSuccess'
import styles from './CreateView.module.css'
import { PalettePicker } from './PalettePicker'
import { RotationHourStepper } from './RotationHourStepper'
import { ShareCard } from './ShareCard'
import { SiteLogo } from './SiteLogo'
import { TimezoneField } from './TimezoneField'

interface CreateViewProps {
  palettes: PaletteSummary[]
  initialTimezone: string
  onCreate: (body: CreateBody) => void
  pending: boolean
  error: string | null
  created: CreatedNeighborhood | null
}

export function CreateView({ palettes, initialTimezone, onCreate, pending, error, created }: CreateViewProps) {
  const nameId = useId()
  const defaultSlug = useMemo(() => palettes.find((p) => p.is_default)?.slug ?? palettes[0]?.slug ?? null, [palettes])

  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState(initialTimezone)
  const [hour, setHour] = useState(7)
  const [paletteSlug, setPaletteSlug] = useState<string | null>(defaultSlug)
  const [hoveredHex, setHoveredHex] = useState<string | null>(null)

  const selected = paletteSlug ? palettes.find((p) => p.slug === paletteSlug) : undefined
  const colors: PaletteColor[] = selected?.colors ?? []
  const cycleIndex = usePaletteCycle(colors.length)
  const activeColor: PaletteColor | null =
    colors.length === 0 ? null : ((hoveredHex ? colors.find((c) => c.hex === hoveredHex) : colors[cycleIndex]) ?? colors[0])

  const tzValid = validateTimezone(timezone)

  function submit() {
    const body: CreateBody = { timezone, rotation_hour: hour }
    if (name.trim()) body.name = name.trim()
    if (paletteSlug) body.palette = paletteSlug
    onCreate(body)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <SiteLogo />
        <Link to="/" className={styles.back}>
          <ArrowLeftIcon aria-hidden /> Back
        </Link>
      </header>

      <main className={styles.main}>
        <h1 className={styles.h1}>Create a neighborhood</h1>
        <p className={styles.subhead}>
          Spin one up in under a minute. No account, no email — ownership is just the secret link you'll get at the end.
        </p>

        <div className={styles.columns}>
          <div className={styles.left}>
            {created ? (
              <CreateSuccess created={created} />
            ) : (
              <form
                className={styles.formCard}
                onSubmit={(e) => {
                  e.preventDefault()
                  submit()
                }}
              >
                <div className={styles.field}>
                  <label htmlFor={nameId} className={styles.label}>
                    Neighborhood name <span className={styles.optional}>optional</span>
                  </label>
                  <input
                    id={nameId}
                    className={styles.input}
                    value={name}
                    maxLength={120}
                    placeholder="e.g. Maple Street"
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <TimezoneField value={timezone} onChange={setTimezone} detectedZone={initialTimezone} />

                <div className={styles.field}>
                  <span className={styles.label}>Rotation hour</span>
                  <RotationHourStepper hour={hour} onChange={setHour} />
                  <p className={styles.help}>The color flips at this time each morning.</p>
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>Palette</span>
                  <PalettePicker palettes={palettes} selectedSlug={paletteSlug} onSelect={setPaletteSlug} />
                </div>

                {error && (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                )}

                <button type="submit" className={styles.submit} disabled={pending || !tzValid}>
                  {pending ? 'Creating…' : 'Create neighborhood'}
                  {!pending && <ArrowRightIcon aria-hidden />}
                </button>
              </form>
            )}
          </div>

          <div className={styles.right}>
            <p className={styles.previewEyebrow}>Live preview</p>
            <ShareCard
              name={name}
              activeColor={activeColor}
              colors={colors}
              paletteName={selected?.name ?? 'Custom colors'}
              rotationLabel={formatHourLabel(hour)}
              activeHex={activeColor?.hex}
              onPreviewColor={setHoveredHex}
            />
            <p className={styles.previewCaption}>
              Updates as you edit. The real color is deterministic from the neighborhood + the day.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
