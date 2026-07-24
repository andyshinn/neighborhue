// Vite's ?raw suffix imports a file's text. Declared locally rather than
// pulling in ambient types, because tsconfig sets "types": [] on purpose —
// this app is browser-only and must not reach for Node APIs.
declare module '*?raw' {
  const content: string
  export default content
}
