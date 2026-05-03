import { useState, useEffect, useCallback } from 'react'
import { LayoutGrid, Settings2 } from 'lucide-react'
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
    <div className="relative min-h-[100dvh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-18%] top-[-8%] h-72 w-72 rounded-full bg-[var(--accent-soft)]/35 blur-3xl lg:h-[34rem] lg:w-[34rem]" />
        <div className="absolute right-[-14%] top-[18%] h-72 w-72 rounded-full bg-[var(--sky-soft)]/30 blur-3xl lg:top-[-2%] lg:h-[28rem] lg:w-[28rem]" />
        <div className="absolute bottom-[-10%] left-[10%] h-80 w-80 rounded-full bg-[var(--mint-soft)]/25 blur-3xl lg:left-[45%] lg:h-[26rem] lg:w-[26rem]" />
      </div>

      <div className="relative mx-auto max-w-[1540px] px-1 pt-1 sm:px-4 lg:px-8 lg:py-8 min-h-[100dvh] pb-14">
        <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-7">
          {/* Desktop sidebar */}
          <aside className="hidden lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:gap-5 lg:rounded-[2rem] lg:border lg:border-[var(--line)] lg:bg-[var(--glass-strong)] lg:p-6 lg:shadow-[var(--shadow-soft)] lg:backdrop-blur-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[var(--glass)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[var(--accent-deep)]">
              <span className="text-base">&#9816;</span>
              FreeChessApp.online
            </div>

            <nav className="space-y-1">
              <SidebarButton
                label="Play"
                active={mode === 'play'}
                onClick={() => navigate('play')}
              />
              <SidebarButton
                label="Preferences"
                active={mode === 'preferences'}
                onClick={() => navigate('preferences')}
              />
            </nav>

            {mode === 'play' && (
              <div className="mt-auto space-y-3">
                <div className="space-y-1 rounded-[1rem] border border-[var(--line)] bg-[var(--glass-soft)] p-3 text-[0.7rem] text-[var(--muted)]">
                  <div className="font-bold uppercase tracking-[0.15em]">How to play</div>
                  <div className="flex justify-between"><span>Click/drag</span><span>Move pieces</span></div>
                  <div className="flex justify-between"><span>Voice</span><span>"knight f3"</span></div>
                  <div className="flex justify-between"><span>Undo</span><span>Take back move</span></div>
                  <div className="flex justify-between"><span>Coach</span><span>Auto-analysis</span></div>
                </div>
              </div>
            )}
          </aside>

          {/* Mobile header */}
          <header className="mb-2 flex items-center gap-2 lg:hidden">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-strong)] bg-[var(--glass)] px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[var(--accent-deep)]">
              <span className="text-sm">&#9816;</span>
              FreeChess
            </div>
          </header>

          {/* Content */}
          <main className="min-w-0">
            {mode === 'play' && <PlayTab settings={settings} update={update} />}
            {mode === 'preferences' && (
              <section className="rounded-[1.25rem] bg-[var(--panel-quiet)] p-3 sm:p-4 lg:rounded-[1.5rem] lg:p-5">
                <PreferencesTab settings={settings} update={update} />
              </section>
            )}
          </main>
        </div>
      </div>

      {/* Mobile dock */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--dock)]/92 px-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1 backdrop-blur-2xl lg:hidden">
        <div className="mx-auto grid max-w-sm grid-cols-2">
          <TabButton
            icon={<LayoutGrid className="h-5 w-5" strokeWidth={1.7} />}
            label="Play"
            active={mode === 'play'}
            onClick={() => navigate('play')}
          />
          <TabButton
            icon={<Settings2 className="h-5 w-5" strokeWidth={1.7} />}
            label="Settings"
            active={mode === 'preferences'}
            onClick={() => navigate('preferences')}
          />
        </div>
      </nav>
    </div>
  )
}

function SidebarButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`w-full rounded-[1rem] px-4 py-3 text-left text-sm font-semibold transition duration-200 ${
        active
          ? 'border border-[var(--accent-soft)] bg-[var(--accent-gradient)] text-[var(--ink)] shadow-[var(--shadow-card)]'
          : 'border border-transparent text-[var(--muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--ink)]'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function TabButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`relative flex flex-col items-center gap-1 rounded-[1rem] px-2 py-2 text-center ${
        active
          ? 'bg-[var(--ink)] text-[var(--paper)] shadow-[var(--shadow-card)]'
          : 'text-[var(--muted)]'
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em]">{label}</span>
    </button>
  )
}
