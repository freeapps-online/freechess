import type { MoveAnalysis } from '../types.ts'

interface MoveListProps {
  history: string[]
  analyses: Record<number, MoveAnalysis>
}

const CATEGORY_COLORS: Record<MoveAnalysis['category'], string> = {
  brilliant: 'text-[#1bada6]',
  great: 'text-[var(--sky)]',
  good: 'text-[var(--ink)]',
  inaccuracy: 'text-[var(--warning)]',
  mistake: 'text-[#e87040]',
  blunder: 'text-[var(--error)]',
}

const CATEGORY_SYMBOLS: Record<MoveAnalysis['category'], string> = {
  brilliant: '!!',
  great: '!',
  good: '',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
}

export function MoveList({ history, analyses }: MoveListProps) {
  const pairs: { number: number; white: string; black?: string; whiteAnalysis?: MoveAnalysis; blackAnalysis?: MoveAnalysis }[] = []

  for (let i = 0; i < history.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1],
      whiteAnalysis: analyses[i],
      blackAnalysis: analyses[i + 1],
    })
  }

  if (pairs.length === 0) {
    return (
      <div className="text-center text-sm text-[var(--muted)] py-8">
        No moves yet. Make your first move!
      </div>
    )
  }

  return (
    <div className="space-y-0.5 text-sm font-mono max-h-64 overflow-y-auto">
      {pairs.map((pair) => (
        <div key={pair.number} className="flex gap-1">
          <span className="w-6 text-right text-[var(--muted)] shrink-0">{pair.number}.</span>
          <MoveCell move={pair.white} analysis={pair.whiteAnalysis} />
          {pair.black && <MoveCell move={pair.black} analysis={pair.blackAnalysis} />}
        </div>
      ))}
    </div>
  )
}

function MoveCell({ move, analysis }: { move: string; analysis?: MoveAnalysis }) {
  const color = analysis ? CATEGORY_COLORS[analysis.category] : ''
  const symbol = analysis ? CATEGORY_SYMBOLS[analysis.category] : ''

  return (
    <span className={`w-16 font-semibold ${color}`} title={analysis?.explanation}>
      {move}{symbol}
    </span>
  )
}
