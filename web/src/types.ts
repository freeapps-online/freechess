export type Mode = 'play' | 'preferences'

export type Difficulty = 1 | 2 | 3 | 4 | 5

export type PlayerColor = 'w' | 'b'

export type GameStatus = 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned'

export interface GameState {
  playerColor: PlayerColor
  difficulty: Difficulty
  status: GameStatus
  winner?: PlayerColor
}

export interface MoveAnalysis {
  move: string
  evaluation: number
  bestMove: string | null
  bestEval: number
  category: 'brilliant' | 'great' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
  explanation: string
}
