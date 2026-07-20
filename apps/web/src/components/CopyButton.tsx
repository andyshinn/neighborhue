import { CheckIcon, CopyIcon } from '@radix-ui/react-icons'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import styles from './CopyButton.module.css'

const RESET_MS = 1600 // handoff: "Copied!" shows for ~1.6s

interface CopyButtonProps {
  value: string
  label: string
  variant?: 'primary' | 'ghost'
  style?: CSSProperties
  className?: string
}

export function CopyButton({ value, label, variant = 'ghost', style, className }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setState('copied')
    } catch {
      // navigator.clipboard rejects in insecure contexts / denied permissions.
      setState('failed')
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), RESET_MS)
  }

  const text = state === 'copied' ? 'Copied!' : state === 'failed' ? 'Press ⌘C to copy' : label

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      style={style}
      className={[styles.button, variant === 'primary' ? styles.primary : '', className].filter(Boolean).join(' ')}
    >
      {state === 'copied' ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      <span>{text}</span>
    </button>
  )
}
