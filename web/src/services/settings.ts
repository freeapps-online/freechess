import type { Difficulty, PlayerColor } from '../types.ts'

const STORAGE_KEY = 'freechess-settings'

export type ThemePreference = 'system' | 'light' | 'dark'
export type FontSizePreference = 'small' | 'medium' | 'large' | 'xlarge'
export type MotionPreference = 'full' | 'reduced'
export type SurfacePreference = 'soft' | 'bold'

export interface Settings {
  theme: ThemePreference
  labelSize: FontSizePreference
  contentSize: FontSizePreference
  motion: MotionPreference
  surface: SurfacePreference
  audio: boolean
  microphone: boolean
  difficulty: Difficulty
  playerColor: PlayerColor
  boardFlipped: boolean
  showCoaching: boolean
  showEvalBar: boolean
  autoSpeak: boolean
}

const defaults: Settings = {
  theme: 'dark',
  labelSize: 'medium',
  contentSize: 'medium',
  motion: 'full',
  surface: 'soft',
  audio: true,
  microphone: false,
  difficulty: 2,
  playerColor: 'w',
  boardFlipped: false,
  showCoaching: true,
  showEvalBar: true,
  autoSpeak: true,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return defaults
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
