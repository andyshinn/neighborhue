/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  // Optional: unset means the Home hero shows its static fallback example and
  // withholds both "live example" links. See lib/config.ts.
  readonly VITE_DEMO_NEIGHBORHOOD_ID?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
