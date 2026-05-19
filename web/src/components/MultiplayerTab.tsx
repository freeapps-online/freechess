import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Board } from './Board.tsx'
import { GameOverBanner } from './GameOverBanner.tsx'
import { PlayerRow } from './PlayerRow.tsx'
import type { GameStatus } from '../types.ts'

type Color = 'w' | 'b'

interface ServerMsg {
  type: string
  fen?: string
  history?: string[]
  yourColor?: Color | 'spectator'
  opponentConnected?: boolean
  gameOver?: { reason: 'checkmate' | 'stalemate' | 'draw' | 'resigned'; winner: Color | null } | null
  uci?: string
  san?: string
  message?: string
}

interface MultiplayerTabProps {
  gameId: string | null
  onCreateGame: () => Promise<string>
  onLoadGame: (id: string) => void
  flipped: boolean
  onFlip: () => void
}

export function MultiplayerTab({ gameId, onCreateGame, onLoadGame, flipped, onFlip }: MultiplayerTabProps) {
  const [chess] = useState(() => new Chess())
  const [, setFen] = useState(chess.fen())
  const [yourColor, setYourColor] = useState<Color | 'spectator' | null>(null)
  const [opponentConnected, setOpponentConnected] = useState(false)
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [gameOver, setGameOver] = useState<ServerMsg['gameOver']>(null)
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'open' | 'closed' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const shareUrl = useMemo(
    () => (gameId ? `${window.location.origin}/g/${gameId}` : null),
    [gameId],
  )

  const sendMessage = useCallback((msg: object) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
      return true
    }
    return false
  }, [])

  // Connect when we have a gameId
  useEffect(() => {
    if (!gameId) {
      setConnectionState('idle')
      return
    }

    let cancelled = false
    const connect = () => {
      if (cancelled) return
      setConnectionState('connecting')
      setError(null)
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${proto}//${window.location.host}/api/game/${gameId}/ws`)
      wsRef.current = ws

      ws.addEventListener('open', () => {
        if (cancelled) return
        setConnectionState('open')
      })

      ws.addEventListener('message', (e) => {
        if (cancelled) return
        let msg: ServerMsg
        try { msg = JSON.parse(e.data) } catch { return }

        if (msg.type === 'state') {
          if (msg.fen) {
            chess.load(msg.fen)
            setFen(chess.fen())
          }
          if (msg.yourColor !== undefined) setYourColor(msg.yourColor)
          if (msg.opponentConnected !== undefined) setOpponentConnected(msg.opponentConnected)
          setGameOver(msg.gameOver ?? null)
        } else if (msg.type === 'move') {
          if (msg.uci && msg.uci.length >= 4) {
            const from = msg.uci.slice(0, 2)
            const to = msg.uci.slice(2, 4)
            const promotion = msg.uci.length > 4 ? msg.uci[4] : undefined
            try {
              chess.move({ from, to, promotion })
              setFen(chess.fen())
              setLastMove({ from: from as Square, to: to as Square })
            } catch {}
          }
          setGameOver(msg.gameOver ?? null)
        } else if (msg.type === 'opponent_joined') {
          setOpponentConnected(true)
        } else if (msg.type === 'opponent_left') {
          setOpponentConnected(false)
        } else if (msg.type === 'new_game') {
          chess.reset()
          setFen(chess.fen())
          setLastMove(null)
          setGameOver(null)
        } else if (msg.type === 'error') {
          setError(msg.message ?? 'Server error')
        }
      })

      ws.addEventListener('close', () => {
        if (cancelled) return
        setConnectionState('closed')
        wsRef.current = null
        // Auto-reconnect after 2s
        reconnectTimer.current = setTimeout(connect, 2000)
      })

      ws.addEventListener('error', () => {
        if (cancelled) return
        setConnectionState('error')
      })
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [gameId, chess])

  const handleMove = useCallback((from: Square, to: Square, promotion?: string): boolean => {
    if (yourColor !== 'w' && yourColor !== 'b') return false
    if (chess.turn() !== yourColor) return false
    if (gameOver) return false

    const uci = `${from}${to}${promotion ?? ''}`
    // Validate locally first for a snappy UX; server will re-validate.
    let move
    try { move = chess.move({ from, to, promotion }) } catch { return false }
    if (!move) return false

    setFen(chess.fen())
    setLastMove({ from, to })
    setSelectedSquare(null)
    sendMessage({ type: 'move', uci })
    return true
  }, [chess, yourColor, gameOver, sendMessage])

  const handleNewGame = useCallback(async () => {
    const id = await onCreateGame()
    onLoadGame(id)
  }, [onCreateGame, onLoadGame])

  const handleResign = useCallback(() => {
    sendMessage({ type: 'resign' })
  }, [sendMessage])

  const handleRematch = useCallback(() => {
    sendMessage({ type: 'new_game' })
  }, [sendMessage])

  const copyShareUrl = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Older browsers: select-and-copy fallback
      const el = document.createElement('textarea')
      el.value = shareUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [shareUrl])

  if (!gameId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md rounded-[1rem] border border-[var(--line)] bg-[var(--glass-soft)] p-6 text-center">
          <h2 className="text-xl font-bold text-[var(--ink)]">Play with a friend</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Create a game, share the link, play side-by-side. No accounts, no clocks, no fuss.
          </p>
          <button
            className="mt-5 rounded-full bg-[var(--accent)] px-6 min-h-[2.75rem] text-sm font-semibold text-white"
            onClick={handleNewGame}
          >
            Create game
          </button>
        </div>
      </div>
    )
  }

  const isPlayer = yourColor === 'w' || yourColor === 'b'
  const isYourTurn = isPlayer && chess.turn() === yourColor && !gameOver
  const boardFlipped = flipped !== (yourColor === 'b')
  const status: GameStatus =
    !gameOver ? 'playing'
    : gameOver.reason === 'checkmate' ? 'checkmate'
    : gameOver.reason === 'stalemate' ? 'stalemate'
    : gameOver.reason === 'resigned' ? 'resigned'
    : 'draw'

  return (
    <div className="flex flex-col gap-1 landscape:flex-row landscape:gap-3 lg:flex-row lg:gap-6 h-full overflow-hidden">
      <div className="flex flex-col gap-1 lg:gap-2 landscape:w-[min(55%,560px)] lg:w-[min(60%,560px)] min-h-0 shrink-0">
        <PlayerRow
          variant="opponent"
          kingGlyph={yourColor === 'w' ? '♚' : '♔'}
          label={opponentConnected ? 'Opponent' : 'Waiting for opponent...'}
          right={!opponentConnected && (
            <span className="ml-auto text-xs text-[var(--muted)] animate-pulse">share the link →</span>
          )}
        />

        <div className="flex-1 min-h-0">
          <Board
            chess={chess}
            flipped={boardFlipped}
            playerColor={isPlayer ? yourColor : 'w'}
            onMove={handleMove}
            lastMove={lastMove}
            selectedSquare={selectedSquare}
            onSquareClick={(sq) => setSelectedSquare(sq)}
          />
        </div>

        <PlayerRow
          variant="player"
          kingGlyph={yourColor === 'w' ? '♔' : yourColor === 'b' ? '♚' : '♔'}
          label={yourColor === 'spectator' ? 'Spectating' : `You (${yourColor === 'w' ? 'White' : 'Black'})`}
          right={isYourTurn && (
            <span className="ml-1 rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-[var(--success)]">
              Your turn
            </span>
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5 lg:gap-3 flex-1 lg:min-w-[240px] min-h-0 min-w-0 overflow-y-auto">
        {shareUrl && !opponentConnected && (
          <div className="rounded-[1rem] border border-[var(--accent)]/30 bg-[var(--glass-soft)] p-3 text-sm">
            <div className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">
              Share this link
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 truncate rounded-[0.5rem] border border-[var(--line)] bg-[var(--glass)] px-2 py-1.5 text-xs text-[var(--ink)]"
                onClick={(e) => e.currentTarget.select()}
              />
              <button
                className="rounded-[0.5rem] bg-[var(--accent)] px-3 min-h-[2.25rem] text-xs font-semibold text-white"
                onClick={copyShareUrl}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-1.5 shrink-0">
          <ActionButton onClick={handleNewGame}>New Game</ActionButton>
          <ActionButton onClick={onFlip}>Flip</ActionButton>
          {isPlayer && !gameOver && (
            <ActionButton onClick={handleResign}>Resign</ActionButton>
          )}
          {gameOver && isPlayer && (
            <ActionButton onClick={handleRematch}>Rematch</ActionButton>
          )}
        </div>

        <div className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass-soft)] px-3 py-2 text-xs">
          <span className="font-bold text-[var(--ink)]">Status:</span>{' '}
          <span className="text-[var(--muted)]">
            {connectionState === 'connecting' && 'Connecting...'}
            {connectionState === 'open' && (opponentConnected ? 'Connected · 2 players' : 'Connected · waiting')}
            {connectionState === 'closed' && 'Disconnected · reconnecting...'}
            {connectionState === 'error' && 'Connection error'}
          </span>
        </div>

        {error && (
          <div className="rounded-[0.75rem] border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <GameOverBanner
          status={status}
          playerLost={!!gameOver && gameOver.winner !== null && gameOver.winner !== yourColor}
          onPlayAgain={handleRematch}
        />

        <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--glass-soft)] p-3 text-xs">
          <div className="mb-1 font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Move list</div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[var(--ink)]">
            {chess.history().map((san, i) => (
              <span key={i}>
                {i % 2 === 0 && <span className="text-[var(--muted)]">{Math.floor(i / 2) + 1}.</span>} {san}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass)] px-3 min-h-[2.75rem] min-w-[2.75rem] text-xs font-semibold text-[var(--muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--ink)]"
      onClick={onClick}
    >
      {children}
    </button>
  )
}
