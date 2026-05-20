import { useMemo } from 'react'
import { recommendationPaths, type RecommendationPath } from '../data/menu'

export interface RecommendationAnswers {
  moods: string[]
  partySizes: string[]
}

interface ScoredPath extends RecommendationPath {
  score: number
  isTopPick: boolean
}

function scorePathForAnswers(path: RecommendationPath, answers: RecommendationAnswers): number {
  let score = 0
  const moodMatches = answers.moods.filter(m => path.moodMatch.includes(m)).length
  const partyMatches = answers.partySizes.filter(p => path.partySizeMatch.includes(p)).length
  score += moodMatches * 100
  score += partyMatches * 70
  // Bonus for high overlap
  if (moodMatches > 1) score += 40
  return score
}

export function useRecommendation(answers: RecommendationAnswers | null): ScoredPath[] {
  return useMemo(() => {
    if (!answers || (answers.moods.length === 0 && answers.partySizes.length === 0)) return []
    const scored = recommendationPaths.map(path => ({
      ...path,
      score: scorePathForAnswers(path, answers),
      isTopPick: false,
    }))
    const sorted = [...scored].sort((a, b) => b.score - a.score)
    if (sorted.length > 0 && sorted[0].score > 0) sorted[0] = { ...sorted[0], isTopPick: true }
    return sorted
  }, [answers])
}
