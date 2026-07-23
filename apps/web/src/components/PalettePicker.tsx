import { CheckIcon, PlusIcon } from '@radix-ui/react-icons'
import type { PaletteColor, PaletteSummary } from '../lib/palette'
import styles from './PalettePicker.module.css'

interface PalettePickerProps {
  palettes: PaletteSummary[]
  selectedSlug: string | null // null = Custom colors
  onSelect: (slug: string | null) => void
  // Create shows a hint to finish setup in Manage; Manage passes null to suppress it (it IS Manage).
  customNote?: string | null
}

const CUSTOM_NOTE = "Create the neighborhood first — you'll add and reorder your custom colors in Manage."

function Row({
  selected,
  onClick,
  name,
  description,
  children,
}: {
  selected: boolean
  onClick: () => void
  name: string
  description: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={[styles.row, selected ? styles.rowSelected : ''].filter(Boolean).join(' ')}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        <span className={styles.desc}>{description}</span>
      </span>
      {selected && (
        <span className={styles.badge} aria-hidden>
          <CheckIcon />
        </span>
      )}
    </button>
  )
}

function Swatches({ colors }: { colors: PaletteColor[] }) {
  return (
    <span className={styles.swatches} aria-hidden>
      {colors.map((c) => (
        <span key={`${c.hex}-${c.name ?? ''}`} className={styles.swatch} style={{ background: c.hex }} />
      ))}
    </span>
  )
}

export function PalettePicker({ palettes, selectedSlug, onSelect, customNote = CUSTOM_NOTE }: PalettePickerProps) {
  return (
    <div className={styles.picker}>
      {palettes.map((p) => (
        <Row
          key={p.slug}
          selected={selectedSlug === p.slug}
          onClick={() => onSelect(p.slug)}
          name={p.name}
          description={p.description ?? ''}
        >
          <Swatches colors={p.colors} />
        </Row>
      ))}

      <Row
        selected={selectedSlug === null}
        onClick={() => onSelect(null)}
        name="Custom colors"
        description="Define your own set"
      >
        <span className={styles.customTile} aria-hidden>
          <PlusIcon />
        </span>
      </Row>

      {selectedSlug === null && customNote && <p className={styles.note}>{customNote}</p>}
    </div>
  )
}
