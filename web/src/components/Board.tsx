import { useState, useCallback, useMemo, useRef } from 'react'
import { Chess, type Square } from 'chess.js'

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
  previewFen?: string | null
  previewArrow?: { from: Square; to: Square } | null
}

export function Board({ chess, flipped, playerColor, onMove, lastMove, selectedSquare, onSquareClick, previewFen, previewArrow }: BoardProps) {
  const [dragFrom, setDragFrom] = useState<Square | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [dragPiece, setDragPiece] = useState<string | null>(null)

  const isPreview = !!previewFen
  const displayChess = isPreview ? new Chess(previewFen!) : chess
  const board = displayChess.board()
  const ranks = flipped ? [...RANKS].reverse() : RANKS
  const files = flipped ? [...FILES].reverse() : FILES

  const isInCheck = !isPreview && chess.isCheck()
  const kingInCheck = isInCheck ? findKing(chess, chess.turn()) : null

  // Get legal moves for selected square
  const legalTargets = useMemo(
    () => (selectedSquare
      ? chess.moves({ square: selectedSquare, verbose: true }).map((move) => move.to)
      : []),
    [chess, selectedSquare],
  )

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
                    fill={piece.color === 'w' ? '#fff' : '#1a1a1a'}
                    stroke={piece.color === 'w' ? '#333' : 'none'}
                    strokeWidth={piece.color === 'w' ? 0.8 : 0}
                    paintOrder="stroke"
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

        {/* Preview arrow for best move */}
        {isPreview && previewArrow && (() => {
          const fromCol = files.indexOf(previewArrow.from[0])
          const fromRow = ranks.indexOf(previewArrow.from[1])
          const toCol = files.indexOf(previewArrow.to[0])
          const toRow = ranks.indexOf(previewArrow.to[1])
          if (fromCol < 0 || fromRow < 0 || toCol < 0 || toRow < 0) return null
          const x1 = fromCol * 100 + 50
          const y1 = fromRow * 100 + 50
          const x2 = toCol * 100 + 50
          const y2 = toRow * 100 + 50
          return (
            <g style={{ pointerEvents: 'none' }}>
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="rgba(85, 160, 255, 0.85)" />
                </marker>
              </defs>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(85, 160, 255, 0.7)" strokeWidth={14} strokeLinecap="round"
                markerEnd="url(#arrowhead)"
              />
            </g>
          )
        })()}

        {/* Preview overlay label */}
        {isPreview && (
          <rect x={0} y={0} width={800} height={32} fill="rgba(85, 160, 255, 0.85)" rx={0} style={{ pointerEvents: 'none' }} />
        )}
        {isPreview && (
          <text x={400} y={22} textAnchor="middle" fontSize={14} fontWeight={700} fill="white" style={{ pointerEvents: 'none' }}>
            Best alternative
          </text>
        )}

        {/* Dragged piece */}
        {!isPreview && dragPos && dragPiece && dragFrom && (() => {
          const dp = chess.get(dragFrom)
          return (
            <text
              x={dragPos.x}
              y={dragPos.y + 18}
              textAnchor="middle"
              fontSize={80}
              fill={dp?.color === 'w' ? '#fff' : '#1a1a1a'}
              stroke={dp?.color === 'w' ? '#333' : 'none'}
              strokeWidth={dp?.color === 'w' ? 0.8 : 0}
              paintOrder="stroke"
              style={{ pointerEvents: 'none', opacity: 0.9 }}
            >
              {dragPiece}
            </text>
          )
        })()}
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
