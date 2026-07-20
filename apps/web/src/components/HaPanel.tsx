import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDownIcon, DownloadIcon } from '@radix-ui/react-icons'
import { API_URL } from '../lib/config'
import { CopyButton } from './CopyButton'
import styles from './HaPanel.module.css'

interface HaPanelProps {
  neighborhoodId: string
}

// Verbatim from the project README's "Home Assistant" section, with the id
// substituted. color.rgb is a drop-in for rgb_color — no parsing needed.
function snippet(id: string): string {
  return `sensor:
  - platform: rest
    name: neighborhue
    resource: ${API_URL}/v1/neighborhoods/${id}
    value_template: "{{ value_json.color.hex }}"
    json_attributes_path: "$.color"
    json_attributes: [hex, rgb, hsl]
    scan_interval: 900

automation:
  - alias: "Neighborhue — apply daily color"
    trigger:
      - platform: state
        entity_id: sensor.neighborhue
    action:
      - service: light.turn_on
        target: { entity_id: light.porch }
        data:
          rgb_color: "{{ state_attr('sensor.neighborhue','rgb') }}"`
}

export function HaPanel({ neighborhoodId }: HaPanelProps) {
  const yaml = snippet(neighborhoodId)
  return (
    <Collapsible.Root>
      <Collapsible.Trigger className={styles.trigger}>
        <DownloadIcon aria-hidden />
        <span>Add to Home Assistant</span>
        <ChevronDownIcon aria-hidden style={{ marginLeft: 'auto' }} />
      </Collapsible.Trigger>
      <Collapsible.Content className={styles.panel}>
        <p className={styles.intro}>
          Add this to your Home Assistant <code>configuration.yaml</code>, then point the automation at your own light.
        </p>
        <div className={styles.idRow}>
          <span className={styles.id}>{neighborhoodId}</span>
          <CopyButton value={neighborhoodId} label="Copy neighborhood ID" />
        </div>
        <pre className={styles.code}>{yaml}</pre>
        <CopyButton value={yaml} label="Copy YAML" />
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
