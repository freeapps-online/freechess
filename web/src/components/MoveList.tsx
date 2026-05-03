import React, { useEffect, useRef } from 'react'
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

const CATEGORY_BG: Record<MoveAnalysis['category'], string> = {
  brilliant: 'bg-[#1bada6]/10 border-[#1bada6]/20',
  great: 'bg-[var(--sky)]/10 border-[var(--sky)]/20',
  good: '',
  inaccuracy: 'bg-[var(--warning)]/8 border-[var(--warning)]/20',
  mistake: 'bg-[#e87040]/8 border-[#e87040]/20',
  blunder: 'bg-[var(--error)]/8 border-[var(--error)]/20',
}

const CATEGORY_SYMBOLS: Record<MoveAnalysis['category'], string> = {
  brilliant: '!!',
  great: '!',
  good: '',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
}

const CATEGORY_LABELS: Record<MoveAnalysis['category'], string> = {
  brilliant: 'Brilliant',
  great: 'Great move',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}

export function MoveList({ history, analyses }: MoveListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [history.length])

  if (history.length === 0) {
    return (
      <div className="text-center text-sm text-[var(--muted)] py-6">
        No moves yet. Make your first move!
      </div>
    )
  }

  // Build entries: each move row, optionally followed by an analysis row
  const entries: React.ReactNode[] = []

  for (let i = 0; i < history.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1
    const white = history[i]
    const black = history[i + 1]
    const whiteAnalysis = analyses[i]
    const blackAnalysis = analyses[i + 1]

    // Move row
    entries.push(
      <div key={`move-${moveNum}`} className="flex items-baseline gap-1.5 py-0.5">
        <span className="w-6 text-right text-[var(--muted)] text-xs shrink-0 font-mono">{moveNum}.</span>
        <MoveCell move={white} analysis={whiteAnalysis} />
        {black && <MoveCell move={black} analysis={blackAnalysis} />}
      </div>
    )

    // Analysis explanation for white's move
    if (whiteAnalysis && whiteAnalysis.category !== 'good') {
      entries.push(
        <AnalysisRow key={`analysis-w-${moveNum}`} analysis={whiteAnalysis} moveNum={moveNum} color="White" />
      )
    }

    // Analysis explanation for black's move
    if (blackAnalysis && blackAnalysis.category !== 'good') {
      entries.push(
        <AnalysisRow key={`analysis-b-${moveNum}`} analysis={blackAnalysis} moveNum={moveNum} color="Black" />
      )
    }
  }

  return (
    <div className="space-y-0.5 overflow-y-auto lg:max-h-[calc(100dvh-24rem)]">
      {entries}
      <div ref={bottomRef} />
    </div>
  )
}

function MoveCell({ move, analysis }: { move: string; analysis?: MoveAnalysis }) {
  const color = analysis ? CATEGORY_COLORS[analysis.category] : ''
  const symbol = analysis ? CATEGORY_SYMBOLS[analysis.category] : ''

  return (
    <span className={`w-16 text-sm font-mono font-semibold ${color}`}>
      {move}{symbol}
    </span>
  )
}

function AnalysisRow({ analysis, moveNum: _moveNum, color: _color }: { analysis: MoveAnalysis; moveNum: number; color: string }) {
  const bg = CATEGORY_BG[analysis.category]
  const textColor = CATEGORY_COLORS[analysis.category]
  const label = CATEGORY_LABELS[analysis.category]

  return (
    <div className={`ml-7.5 rounded-[0.5rem] border px-2.5 py-1.5 text-xs ${bg || 'border-[var(--line)]'}`}>
      <span className={`font-bold ${textColor}`}>{label}: </span>
      <span className="text-[var(--ink)]/80">{analysis.explanation}</span>
      {analysis.bestMove && analysis.bestMove !== analysis.move && (
        <span className="text-[var(--muted)]"> Best was <strong className="text-[var(--ink)]">{analysis.bestMove}</strong>.</span>
      )}
    </div>
  )
}
