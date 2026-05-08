import { useState, useEffect, useCallback } from 'react'
import { GameShell, GameTopbar } from '@freeappstore/games'
import { Settings2 } from 'lucide-react'
import { useApplySettings, useSettings } from './hooks.ts'
import { PlayTab } from './components/PlayTab.tsx'
import { PreferencesTab } from './components/PreferencesTab.tsx'
import type { Mode } from './types.ts'

const PATH_TO_MODE: Record<string, Mode> = {
  '/': 'play',
  '/play': 'play',
  '/preferences': 'preferences',
}

const MODE_TO_PATH: Record<Mode, string> = {
  play: '/',
  preferences: '/preferences',
}

function getModeFromPath(): Mode {
  return PATH_TO_MODE[window.location.pathname] ?? 'play'
}

export default function App() {
  const [mode, setMode] = useState<Mode>(getModeFromPath)
  const { settings, update } = useSettings()
  useApplySettings(settings)

  const navigate = useCallback((m: Mode) => {
    setMode(m)
    window.history.pushState(null, '', MODE_TO_PATH[m])
  }, [])

  useEffect(() => {
    const onPop = () => setMode(getModeFromPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Chess"
          actions={
            <button
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition ${
                mode === 'preferences'
                  ? 'bg-[var(--ink)] text-[var(--paper)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
              onClick={() => navigate(mode === 'preferences' ? 'play' : 'preferences')}
            >
              <Settings2 className="h-4 w-4" strokeWidth={1.7} />
            </button>
          }
        />
      }
    >
      <div className="relative w-full h-full">
        {mode === 'play' && <PlayTab settings={settings} update={update} />}
        {mode === 'preferences' && (
          <section className="rounded-[1.25rem] bg-[var(--panel-quiet)] p-3 sm:p-4 lg:rounded-[1.5rem] lg:p-5">
            <PreferencesTab settings={settings} update={update} />
          </section>
        )}
      </div>
    </GameShell>
  )
}
