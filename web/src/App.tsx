import { useState, useEffect, useCallback } from 'react'
import { GameShell, GameTopbar, GameAuth } from '@freegamestore/games'
import { Puzzle as PuzzleIcon, Settings2 } from 'lucide-react'
import { useApplySettings, useSettings } from './hooks.ts'
import { PlayTab } from './components/PlayTab.tsx'
import { PreferencesTab } from './components/PreferencesTab.tsx'
import { PuzzleTab } from './components/PuzzleTab.tsx'
import type { Mode } from './types.ts'

const PATH_TO_MODE: Record<string, Mode> = {
  '/': 'play',
  '/play': 'play',
  '/puzzles': 'puzzles',
  '/preferences': 'preferences',
}

const MODE_TO_PATH: Record<Mode, string> = {
  play: '/',
  puzzles: '/puzzles',
  preferences: '/preferences',
}

function parseRoute(): { mode: Mode } {
  const path = window.location.pathname
  return { mode: PATH_TO_MODE[path] ?? 'play' }
}

function RulesPanel() {
  const section = { marginTop: '0.75rem', fontWeight: 700 }
  const list = { margin: '0.25rem 0 0 1.1rem', paddingLeft: 0, listStyleType: 'disc' as const }
  return (
    <div style={{ lineHeight: 1.55 }}>
      <h3 style={{ fontWeight: 700, fontSize: '1.05rem' }}>Chess</h3>
      <p style={{ marginTop: '0.25rem' }}>
        Play against the engine, train with puzzles, control by voice.
      </p>

      <h4 style={section}>Playing</h4>
      <ul style={list}>
        <li>Tap a piece, then tap a destination to move</li>
        <li>Drag and drop works too</li>
        <li>Choose your color (White or Black) and difficulty (1 = Beginner, 5 = Stockfish Max)</li>
        <li>Undo takes back your move and the engine's reply</li>
        <li>Eval bar on the left shows position advantage</li>
        <li>Click any move in the move list to see the engine's recommended alternative</li>
      </ul>

      <h4 style={section}>Puzzles</h4>
      <ul style={list}>
        <li>1000 curated puzzles from Lichess, sorted by rating</li>
        <li>Solve the position with the strongest move; wrong moves revert</li>
        <li>"Today's Puzzle" pulls Lichess's daily puzzle live</li>
        <li>Hint highlights the correct piece</li>
        <li>Progress saved locally on this device</li>
      </ul>

      <h4 style={section}>Voice control</h4>
      <ul style={list}>
        <li>Toggle the "Mic Off" button to enable</li>
        <li>Say moves like "e4", "knight to f3", "bishop c4", "castle kingside"</li>
        <li>"Undo", "new game", or "resign" also work</li>
      </ul>

      <h4 style={section}>Online multiplayer?</h4>
      <p style={{ margin: '0.25rem 0 0 0' }}>
        Coming to <a href="https://progamestore.online" target="_blank" rel="noopener">ProGameStore</a>.
        Real-time multiplayer is a Pro-tier feature; the free version on
        FreeGameStore is single-player + puzzles only.
      </p>
    </div>
  )
}

export default function App() {
  const initial = parseRoute()
  const [mode, setMode] = useState<Mode>(initial.mode)
  const { settings, updateSettings } = useSettings()
  useApplySettings(settings)

  const navigate = useCallback((m: Mode) => {
    setMode(m)
    window.history.pushState(null, '', MODE_TO_PATH[m])
  }, [])

  useEffect(() => {
    const onPop = () => {
      const r = parseRoute()
      setMode(r.mode)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Chess"
          rules={<RulesPanel />}
          actions={
            <>
              <button
                aria-label="Puzzles"
                className={`flex items-center gap-1 rounded-lg px-3 py-2 min-h-[2.75rem] min-w-[2.75rem] text-xs font-bold transition ${
                  mode === 'puzzles'
                    ? 'bg-[var(--ink)] text-[var(--paper)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
                onClick={() => navigate(mode === 'puzzles' ? 'play' : 'puzzles')}
              >
                <PuzzleIcon className="h-4 w-4" strokeWidth={1.7} />
              </button>
              <button
                aria-label="Preferences"
                className={`flex items-center gap-1 rounded-lg px-3 py-2 min-h-[2.75rem] min-w-[2.75rem] text-xs font-bold transition ${
                  mode === 'preferences'
                    ? 'bg-[var(--ink)] text-[var(--paper)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
                onClick={() => navigate(mode === 'preferences' ? 'play' : 'preferences')}
              >
                <Settings2 className="h-4 w-4" strokeWidth={1.7} />
              </button>
              <GameAuth />
            </>
          }
        />
      }
    >
      <div className="relative w-full h-full">
        {mode === 'play' && <PlayTab settings={settings} updateSettings={updateSettings} />}
        {mode === 'puzzles' && (
          <PuzzleTab
            flipped={settings.boardFlipped}
            onFlip={() => updateSettings({ boardFlipped: !settings.boardFlipped })}
          />
        )}
        {mode === 'preferences' && (
          <section className="rounded-[1.25rem] bg-[var(--panel-quiet)] p-3 sm:p-4 lg:rounded-[1.5rem] lg:p-5">
            <PreferencesTab settings={settings} updateSettings={updateSettings} />
          </section>
        )}
      </div>
    </GameShell>
  )
}
