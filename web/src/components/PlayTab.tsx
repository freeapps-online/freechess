import { useState, useCallback, useEffect, useRef } from 'react'
import { Chess, type Square } from 'chess.js'
import { Board } from './Board.tsx'
import { MoveList } from './MoveList.tsx'
import { findBestMove, evaluatePosition, findBestMoveSF, evaluatePositionSF, useStockfish } from '../services/engine.ts'
import { stockfish } from '../services/stockfish.ts'
import { analyzePlayerMove, describeMoveSpoken, getPositionAdvice } from '../services/analysis.ts'
import { parseVoiceMove } from '../services/voiceMoves.ts'
import { speech } from '../services/speech.ts'
import { useSpeech } from '../hooks.ts'
import type { Settings } from '../services/settings.ts'
import type { Difficulty, MoveAnalysis, GameStatus } from '../types.ts'

interface PlayTabProps {
  settings: Settings
  update: (patch: Partial<Settings>) => void
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: 'Beginner',
  2: 'Easy',
  3: 'Stockfish',
  4: 'Stockfish+',
  5: 'Stockfish Max',
}

export function PlayTab({ settings, update }: PlayTabProps) {
  const [chess] = useState(() => new Chess())
  const [fen, setFen] = useState(chess.fen())
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [analyses, setAnalyses] = useState<Record<number, MoveAnalysis>>({})
  const [coaching, setCoaching] = useState<string | null>(null)
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing')
  const [thinking, setThinking] = useState(false)
  const [evaluation, setEvaluation] = useState(0)
  const [heardText, setHeardText] = useState('')
  const speechState = useSpeech()
  const [sfReady, setSfReady] = useState(false)
  const listeningRef = useRef(false)
  const voiceRestartRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const playerColor = settings.playerColor
  const isPlayerTurn = chess.turn() === playerColor && gameStatus === 'playing'

  // Lazily load Stockfish when difficulty 3+
  useEffect(() => {
    if (settings.difficulty >= 3 && !stockfish.ready && !stockfish.failed) {
      stockfish.init().then((ok) => setSfReady(ok))
    }
  }, [settings.difficulty])

  // Evaluate position whenever it changes
  useEffect(() => {
    if (sfReady) {
      evaluatePositionSF(chess).then(setEvaluation)
    } else {
      setEvaluation(evaluatePosition(chess))
    }
  }, [fen, chess, sfReady])

  const updateGameStatus = useCallback(() => {
    if (chess.isCheckmate()) {
      const winner = chess.turn() === 'w' ? 'b' : 'w'
      setGameStatus('checkmate')
      const msg = winner === playerColor ? 'Checkmate! You win!' : "Checkmate. You lost."
      setCoaching(msg)
      if (settings.autoSpeak) speech.speak(msg)
    } else if (chess.isStalemate()) {
      setGameStatus('stalemate')
      const msg = "Stalemate! It's a draw."
      setCoaching(msg)
      if (settings.autoSpeak) speech.speak(msg)
    } else if (chess.isDraw()) {
      setGameStatus('draw')
      const msg = "Draw!"
      setCoaching(msg)
      if (settings.autoSpeak) speech.speak(msg)
    }
  }, [chess, playerColor, settings.autoSpeak])

  const makeEngineMove = useCallback(async () => {
    if (chess.isGameOver() || chess.turn() === playerColor) return

    setThinking(true)

    // Small delay so UI shows "Thinking..."
    await new Promise(r => setTimeout(r, 100))

    const useSF = useStockfish(settings.difficulty)
    const move = useSF
      ? await findBestMoveSF(chess, settings.difficulty)
      : findBestMove(chess, settings.difficulty)

    if (move) {
      chess.move(move)
      setFen(chess.fen())
      setLastMove({ from: move.from, to: move.to })
      setSelectedSquare(null)

      const desc = describeMoveSpoken(move.san, chess.turn() === 'w' ? 'b' : 'w')
      if (settings.autoSpeak) speech.speak(desc)

      const advice = getPositionAdvice(chess, playerColor)
      if (advice && settings.showCoaching) setCoaching(advice)

      updateGameStatus()
    }
    setThinking(false)
  }, [chess, playerColor, settings.difficulty, settings.autoSpeak, settings.showCoaching, updateGameStatus])

  // After state change, check if engine should move
  useEffect(() => {
    if (gameStatus !== 'playing') return
    if (chess.turn() !== playerColor && !thinking) {
      const timer = setTimeout(makeEngineMove, 300)
      return () => clearTimeout(timer)
    }
  }, [fen, gameStatus, chess, playerColor, thinking, makeEngineMove])

  const handleMove = useCallback((from: Square, to: Square, promotion?: string): boolean => {
    if (!isPlayerTurn) return false

    const moveBefore = chess.fen()
    try {
      const move = chess.move({ from, to, promotion })
      if (!move) return false

      const moveIndex = chess.history().length - 1
      setFen(chess.fen())
      setLastMove({ from, to })
      setSelectedSquare(null)
      updateGameStatus()

      // Analyze async (don't block the move)
      if (settings.showCoaching) {
        const tempChess = new Chess(moveBefore)
        analyzePlayerMove(tempChess, move.san, playerColor, settings.difficulty).then(analysis => {
          setAnalyses(prev => ({ ...prev, [moveIndex]: analysis }))
          if (analysis.category !== 'good' && settings.autoSpeak) {
            speech.speak(analysis.explanation)
          }
        })
      }

      return true
    } catch {
      return false
    }
  }, [chess, isPlayerTurn, playerColor, settings.showCoaching, settings.autoSpeak, settings.difficulty, updateGameStatus])

  const resetGame = useCallback(() => {
    chess.reset()
    setFen(chess.fen())
    setLastMove(null)
    setSelectedSquare(null)
    setAnalyses({})
    setCoaching(null)
    setGameStatus('playing')
    setEvaluation(0)
    setHeardText('')
    if (settings.autoSpeak) speech.speak('New game started.')
  }, [chess, settings.autoSpeak])

  // Voice control
  const startVoiceListening = useCallback(() => {
    if (listeningRef.current) return
    listeningRef.current = true

    speech.startListening('en-US', (text) => {
      setHeardText(text)
      const moveStr = parseVoiceMove(text, chess)

      if (moveStr === '__undo__') {
        // Undo both player and engine moves
        const lenBefore = chess.history().length
        chess.undo()
        chess.undo()
        setFen(chess.fen())
        setLastMove(null)
        setSelectedSquare(null)
        setAnalyses(prev => {
          const next = { ...prev }
          delete next[lenBefore - 1]
          delete next[lenBefore - 2]
          return next
        })
        setCoaching('Took back the last move.')
        if (settings.autoSpeak) speech.speak('Move taken back.')
        return
      }

      if (moveStr === '__resign__') {
        setGameStatus('resigned')
        setCoaching('You resigned.')
        if (settings.autoSpeak) speech.speak('You resigned.')
        return
      }

      if (moveStr === '__new_game__') {
        resetGame()
        return
      }

      if (moveStr && isPlayerTurn) {
        // Find the move object from legal moves
        const legalMoves = chess.moves({ verbose: true })
        const matchedMove = legalMoves.find(m => m.san === moveStr)
        if (matchedMove) {
          handleMove(matchedMove.from, matchedMove.to, matchedMove.promotion)
          if (settings.autoSpeak && !settings.showCoaching) {
            const desc = describeMoveSpoken(moveStr, playerColor)
            speech.speak(desc)
          }
        }
      } else if (!moveStr) {
        setCoaching(`Didn't understand "${text}". Try saying a move like "e4" or "knight f3".`)
      }
    }, {
      continuous: true,
      interimResults: true,
      onInterim: (text) => setHeardText(text),
      onEnd: () => {
        listeningRef.current = false
        // Auto-restart if mic is still on
        if (settings.microphone && gameStatus === 'playing') {
          voiceRestartRef.current = setTimeout(() => {
            startVoiceListening()
          }, 200)
        }
      },
    })
  }, [chess, isPlayerTurn, playerColor, settings.autoSpeak, settings.showCoaching, settings.microphone, gameStatus, handleMove, resetGame])

  // Start/stop voice listening when microphone setting changes
  useEffect(() => {
    if (settings.microphone && gameStatus === 'playing') {
      startVoiceListening()
    } else {
      speech.stopListening()
      listeningRef.current = false
      if (voiceRestartRef.current) {
        clearTimeout(voiceRestartRef.current)
        voiceRestartRef.current = null
      }
    }
    return () => {
      if (voiceRestartRef.current) {
        clearTimeout(voiceRestartRef.current)
        voiceRestartRef.current = null
      }
    }
  }, [settings.microphone, gameStatus, startVoiceListening])

  const handleUndo = useCallback(() => {
    const lenBefore = chess.history().length
    if (lenBefore < 2) return
    chess.undo()
    chess.undo()
    setFen(chess.fen())
    setLastMove(null)
    setSelectedSquare(null)
    setAnalyses(prev => {
      const next = { ...prev }
      delete next[lenBefore - 1]
      delete next[lenBefore - 2]
      return next
    })
    setCoaching(null)
    setGameStatus('playing')
  }, [chess])

  const flipBoard = useCallback(() => {
    update({ boardFlipped: !settings.boardFlipped })
  }, [settings.boardFlipped, update])

  const history = chess.history()

  // Evaluation bar (from white's perspective, clamped)
  const evalClamped = Math.max(-2000, Math.min(2000, evaluation))
  const evalPercent = 50 + (evalClamped / 2000) * 50
  const evalDisplay = evaluation > 0 ? `+${(evaluation / 100).toFixed(1)}` : (evaluation / 100).toFixed(1)

  const boardFlipped = settings.boardFlipped || playerColor === 'b'

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:gap-6">
      {/* Board area */}
      <div className="flex flex-col gap-2 lg:w-[min(60%,560px)]">
        {/* Top bar: opponent info */}
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--glass)] text-base">
            {playerColor === 'w' ? '\u265A' : '\u2654'}
          </div>
          <span className="text-sm font-semibold text-[var(--ink)]">
            Engine ({DIFFICULTY_LABELS[settings.difficulty]})
          </span>
          {thinking && (
            <span className="ml-auto text-xs text-[var(--muted)] animate-pulse">Thinking...</span>
          )}
        </div>

        {/* Eval bar + Board */}
        <div className="flex gap-1.5">
          {settings.showEvalBar && (
            <div className="w-4 shrink-0 rounded-full overflow-hidden bg-[var(--board-dark)] relative">
              <div
                className="absolute bottom-0 left-0 right-0 bg-[var(--board-light)] transition-all duration-500"
                style={{ height: `${evalPercent}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[8px] font-bold text-[var(--ink)] mix-blend-difference [writing-mode:vertical-rl] rotate-180">
                  {evalDisplay}
                </span>
              </div>
            </div>
          )}
          <div className="flex-1">
            <Board
              chess={chess}
              flipped={boardFlipped}
              playerColor={playerColor}
              onMove={handleMove}
              lastMove={lastMove}
              selectedSquare={selectedSquare}
              onSquareClick={setSelectedSquare}
            />
          </div>
        </div>

        {/* Bottom bar: player info */}
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)]/20 text-base">
            {playerColor === 'w' ? '\u2654' : '\u265A'}
          </div>
          <span className="text-sm font-semibold text-[var(--ink)]">You</span>

          {/* Mic status */}
          {settings.microphone && (
            <div className="ml-2 flex items-center gap-1">
              <div className={`h-2 w-2 rounded-full ${speechState.isListening ? 'bg-[var(--success)] pulse-ring' : 'bg-[var(--muted)]'}`} />
              <span className="text-xs text-[var(--muted)]">
                {speechState.isListening ? 'Listening' : 'Mic on'}
              </span>
            </div>
          )}
        </div>

        {/* Voice transcript */}
        {settings.microphone && heardText && (
          <div className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass-soft)] px-3 py-2 text-sm text-[var(--muted)]">
            Heard: "{heardText}"
          </div>
        )}
      </div>

      {/* Sidebar: moves, coaching, controls */}
      <div className="flex flex-col gap-3 lg:flex-1 lg:min-w-[240px]">
        {/* Game controls */}
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass)] px-3 py-2 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--ink)]"
            onClick={resetGame}
          >
            New Game
          </button>
          <button
            className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass)] px-3 py-2 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--ink)]"
            onClick={handleUndo}
            disabled={history.length < 2}
          >
            Undo
          </button>
          <button
            className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass)] px-3 py-2 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--ink)]"
            onClick={flipBoard}
          >
            Flip
          </button>
          <button
            className={`rounded-[0.75rem] border px-3 py-2 text-xs font-semibold ${
              settings.microphone
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                : 'border-[var(--line)] bg-[var(--glass)] text-[var(--muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--ink)]'
            }`}
            onClick={() => update({ microphone: !settings.microphone })}
          >
            {settings.microphone ? 'Mic On' : 'Mic Off'}
          </button>
          <button
            className={`rounded-[0.75rem] border px-3 py-2 text-xs font-semibold ${
              settings.audio
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                : 'border-[var(--line)] bg-[var(--glass)] text-[var(--muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--ink)]'
            }`}
            onClick={() => update({ audio: !settings.audio, autoSpeak: !settings.audio })}
          >
            {settings.audio ? 'Sound On' : 'Sound Off'}
          </button>
        </div>

        {/* Difficulty selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--muted)]">Difficulty:</span>
          <div className="flex gap-1">
            {([1, 2, 3, 4, 5] as Difficulty[]).map(d => (
              <button
                key={d}
                className={`rounded-[0.5rem] px-2 py-1 text-xs font-semibold ${
                  settings.difficulty === d
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--glass)] text-[var(--muted)] hover:bg-[var(--glass-hover)]'
                }`}
                onClick={() => update({ difficulty: d })}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--muted)]">Play as:</span>
          <div className="flex gap-1">
            <button
              className={`rounded-[0.5rem] px-3 py-1 text-sm ${
                playerColor === 'w'
                  ? 'bg-[var(--accent)] text-white font-semibold'
                  : 'bg-[var(--glass)] text-[var(--muted)]'
              }`}
              onClick={() => { update({ playerColor: 'w' }); resetGame() }}
            >
              White
            </button>
            <button
              className={`rounded-[0.5rem] px-3 py-1 text-sm ${
                playerColor === 'b'
                  ? 'bg-[var(--accent)] text-white font-semibold'
                  : 'bg-[var(--glass)] text-[var(--muted)]'
              }`}
              onClick={() => { update({ playerColor: 'b' }); resetGame() }}
            >
              Black
            </button>
          </div>
        </div>

        {/* Status message (voice feedback, game advice) */}
        {coaching && gameStatus === 'playing' && (
          <div className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass-soft)] px-3 py-2 text-sm text-[var(--ink)]">
            {coaching}
          </div>
        )}

        {/* Game over banner */}
        {gameStatus !== 'playing' && (
          <div className="rounded-[1rem] border border-[var(--accent)]/30 bg-[var(--accent-gradient)] p-4 text-center">
            <div className="text-lg font-bold text-[var(--ink)]">
              {gameStatus === 'checkmate' && (chess.turn() === playerColor ? 'You Lost' : 'You Won!')}
              {gameStatus === 'stalemate' && 'Stalemate'}
              {gameStatus === 'draw' && 'Draw'}
              {gameStatus === 'resigned' && 'You Resigned'}
            </div>
            <button
              className="mt-2 rounded-full bg-[var(--accent)] px-6 py-2 text-sm font-semibold text-white"
              onClick={resetGame}
            >
              Play Again
            </button>
          </div>
        )}

        {/* Move list */}
        <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--glass-soft)] p-3">
          <div className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Moves</div>
          <MoveList history={history} analyses={analyses} />
        </div>

        {/* Voice instructions */}
        {settings.microphone && (
          <div className="space-y-1 rounded-[1rem] border border-[var(--line)] bg-[var(--glass-soft)] p-3 text-[0.7rem] text-[var(--muted)]">
            <div className="font-bold uppercase tracking-[0.15em]">Voice Commands</div>
            <div className="flex justify-between"><span>"e4"</span><span>Pawn to e4</span></div>
            <div className="flex justify-between"><span>"knight f3"</span><span>Knight to f3</span></div>
            <div className="flex justify-between"><span>"bishop to c4"</span><span>Bishop to c4</span></div>
            <div className="flex justify-between"><span>"castle kingside"</span><span>Short castle</span></div>
            <div className="flex justify-between"><span>"takes on d5"</span><span>Capture on d5</span></div>
            <div className="flex justify-between"><span>"undo"</span><span>Take back move</span></div>
            <div className="flex justify-between"><span>"new game"</span><span>Start over</span></div>
          </div>
        )}
      </div>
    </div>
  )
}
