// pokersolver ships without types. We only use Hand.solve / Hand.winners, and
// evaluate.ts narrows the shape itself, so a minimal ambient declaration is enough.
declare module 'pokersolver' {
  const value: unknown
  export default value
  export const Hand: unknown
}
