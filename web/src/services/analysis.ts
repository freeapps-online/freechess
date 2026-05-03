import { Chess } from 'chess.js'
import type { MoveAnalysis } from '../types.ts'
import { evaluateMove, evaluateMoveSF, shouldUseStockfish } from './engine.ts'
import type { Difficulty } from '../types.ts'

export async function analyzePlayerMove(chess: Chess, moveSan: string, playerColor: 'w' | 'b', difficulty: Difficulty = 2): Promise<MoveAnalysis> {
  const useSF = shouldUseStockfish(difficulty)
  const { evalAfter, bestMove, bestEval } = useSF
    ? await evaluateMoveSF(chess, moveSan)
    : evaluateMove(chess, moveSan)

  // Calculate evaluation swing from the player's perspective
  const sign = playerColor === 'w' ? 1 : -1
  const moveEval = evalAfter * sign
  const bestMoveEval = bestEval * sign
  const diff = bestMoveEval - moveEval  // how much worse is this move vs best

  let category: MoveAnalysis['category']
  let explanation: string

  if (diff <= 0) {
    category = 'brilliant'
    explanation = "Excellent move! This is the best or even better than expected."
  } else if (diff < 30) {
    category = 'great'
    explanation = "Great move! Very close to the best option."
  } else if (diff < 80) {
    category = 'good'
    explanation = "Solid move. A reasonable choice in this position."
  } else if (diff < 180) {
    category = 'inaccuracy'
    explanation = bestMove
      ? `An inaccuracy. ${bestMove} was slightly better here.`
      : "A small inaccuracy. There was a slightly better option."
  } else if (diff < 400) {
    category = 'mistake'
    explanation = bestMove
      ? `A mistake! ${bestMove} was much better. You lost about ${Math.round(diff / 100)} pawns of advantage.`
      : `A mistake. This costs about ${Math.round(diff / 100)} pawns of advantage.`
  } else {
    category = 'blunder'
    explanation = bestMove
      ? `A blunder! ${bestMove} was the right move. This loses significant material or position.`
      : "A serious blunder that loses significant material or position."
  }

  // Add tactical context
  const clone = new Chess(chess.fen())
  clone.move(moveSan)

  if (clone.isCheckmate()) {
    category = 'brilliant'
    explanation = "Checkmate! Brilliant finish!"
  } else if (clone.isCheck()) {
    if (category === 'good' || category === 'great') {
      explanation += " The check adds pressure."
    }
  }

  // Detect if the move captures material
  const moveObj = chess.moves({ verbose: true }).find(m => m.san === moveSan)
  if (moveObj?.captured && category === 'good') {
    explanation = "Good capture, winning material."
  }

  return {
    move: moveSan,
    evaluation: evalAfter,
    bestMove: bestMove === moveSan ? null : bestMove,
    bestEval,
    category,
    explanation,
  }
}

export function getPositionAdvice(chess: Chess, playerColor: 'w' | 'b'): string {
  if (chess.isCheckmate()) return playerColor === chess.turn() ? "You've been checkmated!" : "Checkmate! You win!"
  if (chess.isDraw()) return "The game is a draw."
  if (chess.isStalemate()) return "Stalemate - it's a draw."
  if (chess.isCheck()) {
    return chess.turn() === playerColor ? "You're in check! You must get out of check." : "Check!"
  }

  const moves = chess.moves({ verbose: true })
  const captures = moves.filter(m => m.captured)
  const checks = moves.filter(m => m.san.includes('+'))

  if (chess.turn() === playerColor) {
    const hints: string[] = []
    if (checks.length > 0) hints.push("You have a check available.")
    if (captures.length > 0) hints.push(`You can capture ${captures.length} piece${captures.length > 1 ? 's' : ''}.`)
    if (moves.length < 10) hints.push("Your pieces are restricted. Try to create more space.")
    if (hints.length === 0) hints.push("Look for ways to improve your piece positions.")
    return hints[0]
  }

  return ""
}

export function describeMoveSpoken(san: string, color: 'w' | 'b'): string {
  const who = color === 'w' ? 'White' : 'Black'

  if (san === 'O-O') return `${who} castles kingside.`
  if (san === 'O-O-O') return `${who} castles queenside.`

  let desc = who + ' '

  // Remove check/checkmate indicators for parsing
  const clean = san.replace(/[+#]/g, '')

  const pieceNames: Record<string, string> = {
    K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight',
  }

  let i = 0
  let piece = 'pawn'

  if (clean[i] && pieceNames[clean[i]]) {
    piece = pieceNames[clean[i]]
    i++
  }

  const isCapture = clean.includes('x')
  const parts = clean.slice(i).replace('x', '')

  // Get the destination square
  const target = parts.slice(-2)

  if (isCapture) {
    desc += `${piece} takes on ${target[0]} ${target[1]}`
  } else {
    desc += `${piece} to ${target[0]} ${target[1]}`
  }

  if (san.includes('=')) {
    const promo = san.split('=')[1]?.replace(/[+#]/, '')
    if (promo && pieceNames[promo]) {
      desc += `, promotes to ${pieceNames[promo]}`
    }
  }

  if (san.includes('#')) desc += '. Checkmate!'
  else if (san.includes('+')) desc += '. Check!'

  return desc + '.'
}
