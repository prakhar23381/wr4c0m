import { createContext, useContext } from 'react'

/** The chapter a component sits in; charts use it to pick matching colours. */
export type Tone = 'hero' | 'light' | 'white'

export const ToneContext = createContext<Tone>('white')

export const useTone = () => useContext(ToneContext)

export const TONE_CLASS: Record<Tone, string> = {
  hero: 'chapter-hero',
  light: 'chapter-light',
  white: 'chapter-white',
}
