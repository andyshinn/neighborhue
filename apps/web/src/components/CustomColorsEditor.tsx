import { BlendingModeIcon, ChevronDownIcon, ChevronUpIcon, Cross2Icon, PlusIcon } from '@radix-ui/react-icons'
import { useState } from 'react'
import { validateHex } from '../lib/hex'
import type { CustomColor } from '../lib/manage'
import styles from './CustomColorsEditor.module.css'

interface CustomColorsEditorProps {
  colors: CustomColor[]
  onChange: (next: CustomColor[]) => void
}

export function CustomColorsEditor({ colors, onChange }: CustomColorsEditorProps) {
  const [newHex, setNewHex] = useState('')
  const [newName, setNewName] = useState('')
  const hexInvalid = newHex.trim() !== '' && !validateHex(newHex.trim())

  function add() {
    const hex = newHex.trim()
    if (!validateHex(hex)) return
    onChange([...colors, { hex, name: newName.trim() || 'Custom' }])
    setNewHex('')
    setNewName('')
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= colors.length) return
    const next = [...colors]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  function remove(i: number) {
    onChange(colors.filter((_, k) => k !== i))
  }

  return (
    <div className={styles.editor}>
      <p className={styles.heading}>Custom colors</p>

      {colors.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden>
            <BlendingModeIcon />
          </span>
          <p className={styles.emptyTitle}>No custom colors yet</p>
          <p className={styles.emptyBody}>Add your first color below — it'll join the daily rotation.</p>
        </div>
      ) : (
        <ul className={styles.rows}>
          {colors.map((c, i) => {
            const label = c.name ?? c.hex
            return (
              <li key={`${c.hex}-${c.name ?? ''}`} className={styles.row}>
                <span className={styles.swatch} style={{ background: c.hex }} aria-hidden />
                <span className={styles.text}>
                  <span className={styles.name}>{c.name ?? 'Custom'}</span>
                  <span className={styles.hex}>{c.hex}</span>
                </span>
                <span className={styles.controls}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label={`Move ${label} up`}
                    onClick={() => move(i, -1)}
                  >
                    <ChevronUpIcon aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label={`Move ${label} down`}
                    onClick={() => move(i, 1)}
                  >
                    <ChevronDownIcon aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    aria-label={`Remove ${label}`}
                    onClick={() => remove(i)}
                  >
                    <Cross2Icon aria-hidden />
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <div className={styles.addRow}>
        <input
          className={styles.hexInput}
          value={newHex}
          placeholder="#FF6A00"
          aria-label="New color hex"
          aria-invalid={hexInvalid}
          spellCheck={false}
          autoCapitalize="off"
          onChange={(e) => setNewHex(e.target.value)}
        />
        <input
          className={styles.nameInput}
          value={newName}
          placeholder="Color name"
          aria-label="New color name"
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="button" className={styles.addBtn} onClick={add}>
          <PlusIcon aria-hidden /> Add
        </button>
      </div>
      {hexInvalid && <p className={styles.error}>Enter a valid hex like #FF6A00.</p>}
    </div>
  )
}
