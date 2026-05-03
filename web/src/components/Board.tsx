import { useState, useCallback, useRef } from 'react'
import type { Chess, Square } from 'chess.js'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

const PIECE_CHARS: Record<string, Record<string, string>> = {
  w: { k: '\u2654', q: '\u2655', r: '\u2656', b: '\u2657', n: '\u2658', p: '\u2659' },
  b: { k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F' },
}

interface BoardProps {
  chess: Chess
  flipped: boolean
  playerColor: 'w' | 'b'
  onMove: (from: Square, to: Square, promotion?: string) => boolean
  lastMove?: { from: Square; to: Square } | null
  selectedSquare?: Square | null
  onSquareClick?: (sq: Square | null) => void
}

export function Board({ chess, flipped, playerColor, onMove, lastMove, selectedSquare, onSquareClick }: BoardProps) {
  const [dragFrom, setDragFrom] = useState<Square | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [dragPiece, setDragPiece] = useState<string | null>(null)

  const board = chess.board()
  const ranks = flipped ? [...RANKS].reverse() : RANKS
  const files = flipped ? [...FILES].reverse() : FILES

  const isInCheck = chess.isCheck()
  const kingInCheck = isInCheck ? findKing(chess, chess.turn()) : null

  // Get legal moves for selected square
  const legalTargets = selectedSquare
    ? chess.moves({ square: selectedSquare, verbose: true }).map(m => m.to)
    : []

  const handleSquareClick = useCallback((sq: Square) => {
    if (selectedSquare) {
      if (legalTargets.includes(sq)) {
        const piece = chess.get(selectedSquare)
        const isPromotion = piece?.type === 'p' && (sq[1] === '8' || sq[1] === '1')
        onMove(selectedSquare, sq, isPromotion ? 'q' : undefined)
        onSquareClick?.(null)
        return
      }
      // Clicked same square = deselect, clicked another own piece = reselect
      if (sq === selectedSquare) {
        onSquareClick?.(null)
      } else {
        const piece = chess.get(sq)
        onSquareClick?.(piece && piece.color === playerColor ? sq : null)
      }
    } else {
      const piece = chess.get(sq)
      if (piece && piece.color === playerColor && chess.turn() === playerColor) {
        onSquareClick?.(sq)
      }
    }
  }, [chess, playerColor, selectedSquare, legalTargets, onMove, onSquareClick])

  const dragStartRef = useRef<{ sq: Square; x: number; y: number; started: boolean } | null>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent, sq: Square) => {
    const piece = chess.get(sq)
    if (!piece || piece.color !== playerColor || chess.turn() !== playerColor) return

    dragStartRef.current = { sq, x: e.clientX, y: e.clientY, started: false }
  }, [chess, playerColor])

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    const start = dragStartRef.current
    if (!start) return

    // Only begin visual drag after moving 8px (distinguishes tap from drag)
    if (!start.started) {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (dx * dx + dy * dy < 64) return
      start.started = true
      const piece = chess.get(start.sq)
      if (piece) {
        setDragFrom(start.sq)
        setDragPiece(PIECE_CHARS[piece.color][piece.type])
        onSquareClick?.(start.sq)
      }
    }

    if (!dragFrom) return
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragPos({ x: (e.clientX - rect.left) * 800 / rect.width, y: (e.clientY - rect.top) * 800 / rect.height })
  }, [chess, dragFrom, onSquareClick])

  const handleDragEnd = useCallback((e: React.PointerEvent) => {
    const start = dragStartRef.current
    dragStartRef.current = null

    if (!dragFrom || !start?.started) {
      // Not a drag — it was a tap, handled by onClick
      setDragFrom(null)
      setDragPos(null)
      setDragPiece(null)
      return
    }

    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const sqSize = rect.width / 8
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const col = Math.floor(x / sqSize)
    const row = Math.floor(y / sqSize)

    if (col >= 0 && col < 8 && row >= 0 && row < 8) {
      const file = files[col]
      const rank = ranks[row]
      const to = `${file}${rank}` as Square

      if (to !== dragFrom) {
        const piece = chess.get(dragFrom)
        const isPromotion = piece?.type === 'p' && (to[1] === '8' || to[1] === '1')
        onMove(dragFrom, to, isPromotion ? 'q' : undefined)
        onSquareClick?.(null)
      }
    }

    setDragFrom(null)
    setDragPos(null)
    setDragPiece(null)
  }, [dragFrom, chess, files, ranks, onMove, onSquareClick])

  return (
    <div className="relative w-full aspect-square select-none">
      <svg
        className="chess-board w-full h-full rounded-[0.5rem] shadow-[var(--shadow-soft)] overflow-hidden"
        viewBox="0 0 800 800"
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerLeave={handleDragEnd}
      >
        {/* Board squares */}
        {ranks.map((rank, row) =>
          files.map((file, col) => {
            const sq = `${file}${rank}` as Square
            const isLight = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 0
            const isSelected = selectedSquare === sq
            const isLastMove = lastMove && (lastMove.from === sq || lastMove.to === sq)
            const isCheckSquare = kingInCheck === sq
            const isLegalTarget = legalTargets.includes(sq)
            const piece = board[RANKS.indexOf(rank)][FILES.indexOf(file)]

            return (
              <g key={sq}>
                {/* Square background */}
                <rect
                  x={col * 100}
                  y={row * 100}
                  width={100}
                  height={100}
                  fill={isLight ? 'var(--board-light)' : 'var(--board-dark)'}
                />

                {/* Highlight last move */}
                {isLastMove && (
                  <rect
                    x={col * 100}
                    y={row * 100}
                    width={100}
                    height={100}
                    fill="var(--board-highlight)"
                  />
                )}

                {/* Selected square */}
                {isSelected && (
                  <rect
                    x={col * 100}
                    y={row * 100}
                    width={100}
                    height={100}
                    fill="var(--board-highlight)"
                  />
                )}

                {/* Check highlight */}
                {isCheckSquare && (
                  <rect
                    x={col * 100}
                    y={row * 100}
                    width={100}
                    height={100}
                    fill="var(--board-check)"
                  />
                )}

                {/* Legal move hint */}
                {isLegalTarget && !piece && (
                  <circle
                    cx={col * 100 + 50}
                    cy={row * 100 + 50}
                    r={16}
                    fill="var(--board-move-hint)"
                  />
                )}
                {isLegalTarget && piece && (
                  <circle
                    cx={col * 100 + 50}
                    cy={row * 100 + 50}
                    r={46}
                    fill="none"
                    stroke="var(--board-move-hint)"
                    strokeWidth={6}
                  />
                )}

                {/* Click target */}
                <rect
                  x={col * 100}
                  y={row * 100}
                  width={100}
                  height={100}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSquareClick(sq)}
                  onPointerDown={(e) => handlePointerDown(e, sq)}
                />

                {/* Piece */}
                {piece && !(dragFrom === sq && dragPos) && (
                  <text
                    x={col * 100 + 50}
                    y={row * 100 + 72}
                    textAnchor="middle"
                    fontSize={72}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {PIECE_CHARS[piece.color][piece.type]}
                  </text>
                )}
              </g>
            )
          })
        )}

        {/* File labels */}
        {files.map((file, col) => (
          <text
            key={`file-${file}`}
            x={col * 100 + 90}
            y={792}
            fontSize={13}
            fontWeight={600}
            fill={(col + (flipped ? 1 : 0)) % 2 === 0 ? 'var(--board-dark)' : 'var(--board-light)'}
            style={{ pointerEvents: 'none' }}
          >
            {file}
          </text>
        ))}

        {/* Rank labels */}
        {ranks.map((rank, row) => (
          <text
            key={`rank-${rank}`}
            x={4}
            y={row * 100 + 16}
            fontSize={13}
            fontWeight={600}
            fill={(row + (flipped ? 1 : 0)) % 2 === 0 ? 'var(--board-dark)' : 'var(--board-light)'}
            style={{ pointerEvents: 'none' }}
          >
            {rank}
          </text>
        ))}

        {/* Dragged piece */}
        {dragPos && dragPiece && (
          <text
            x={dragPos.x}
            y={dragPos.y + 18}
            textAnchor="middle"
            fontSize={80}
            style={{ pointerEvents: 'none', opacity: 0.9 }}
          >
            {dragPiece}
          </text>
        )}
      </svg>
    </div>
  )
}

function findKing(chess: Chess, color: 'w' | 'b'): Square | null {
  const board = chess.board()
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.type === 'k' && p.color === color) {
        return `${FILES[c]}${RANKS[r]}` as Square
      }
    }
  }
  return null
}
