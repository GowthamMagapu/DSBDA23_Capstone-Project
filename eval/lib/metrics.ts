// Classification and distribution metrics for the screening evaluation.
// Kept dependency-free so the harness runs with nothing but the app's own toolchain.

export type Label = 'selected' | 'review' | 'rejected'

export const LABELS: Label[] = ['selected', 'review', 'rejected']

export type ConfusionMatrix = Record<Label, Record<Label, number>>

/** Rows are the human ground-truth label, columns are the system's prediction. */
export function confusionMatrix(pairs: { truth: Label; predicted: Label }[]): ConfusionMatrix {
  const matrix = Object.fromEntries(
    LABELS.map((truth) => [truth, Object.fromEntries(LABELS.map((p) => [p, 0]))])
  ) as ConfusionMatrix

  for (const { truth, predicted } of pairs) matrix[truth][predicted] += 1
  return matrix
}

export type ClassMetrics = {
  label: Label
  support: number
  precision: number
  recall: number
  f1: number
}

/** Per-class precision/recall/F1, computed one-vs-rest from the confusion matrix. */
export function classMetrics(matrix: ConfusionMatrix): ClassMetrics[] {
  return LABELS.map((label) => {
    const truePositive = matrix[label][label]
    const falsePositive = LABELS.reduce(
      (sum, truth) => sum + (truth === label ? 0 : matrix[truth][label]),
      0
    )
    const falseNegative = LABELS.reduce(
      (sum, predicted) => sum + (predicted === label ? 0 : matrix[label][predicted]),
      0
    )
    const support = truePositive + falseNegative

    const precision = truePositive + falsePositive === 0 ? 0 : truePositive / (truePositive + falsePositive)
    const recall = support === 0 ? 0 : truePositive / support
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)

    return { label, support, precision, recall, f1 }
  })
}

export function accuracy(matrix: ConfusionMatrix): number {
  let correct = 0
  let total = 0
  for (const truth of LABELS) {
    for (const predicted of LABELS) {
      total += matrix[truth][predicted]
      if (truth === predicted) correct += matrix[truth][predicted]
    }
  }
  return total === 0 ? 0 : correct / total
}

/** Unweighted mean F1 across classes — the headline number for an imbalanced 3-class set. */
export function macroF1(matrix: ConfusionMatrix): number {
  const perClass = classMetrics(matrix)
  return perClass.reduce((sum, m) => sum + m.f1, 0) / perClass.length
}

/**
 * Cohen's kappa — agreement corrected for what chance alone would produce.
 * Reported alongside accuracy because a 3-class set with an imbalanced
 * distribution can look accurate while agreeing no better than guessing.
 */
export function cohensKappa(matrix: ConfusionMatrix): number {
  let total = 0
  for (const truth of LABELS) for (const p of LABELS) total += matrix[truth][p]
  if (total === 0) return 0

  const observed = accuracy(matrix)
  let expected = 0
  for (const label of LABELS) {
    const truthTotal = LABELS.reduce((sum, p) => sum + matrix[label][p], 0)
    const predictedTotal = LABELS.reduce((sum, truth) => sum + matrix[truth][label], 0)
    expected += (truthTotal / total) * (predictedTotal / total)
  }
  return expected === 1 ? 0 : (observed - expected) / (1 - expected)
}

/** Average ranks, so tied values share the mean of the positions they span. */
function rankWithTies(values: number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value)
  const ranks = new Array<number>(values.length)

  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && order[j + 1].value === order[i].value) j += 1
    const sharedRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k += 1) ranks[order[k].index] = sharedRank
    i = j + 1
  }
  return ranks
}

/**
 * Spearman's rho on ranks. Measures whether the system orders candidates the way
 * the human did — the property that actually matters for a ranked shortlist,
 * independently of whether the absolute 0-100 scores are calibrated.
 */
export function spearman(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) return 0
  const rankA = rankWithTies(a)
  const rankB = rankWithTies(b)
  return pearson(rankA, rankB)
}

export function pearson(a: number[], b: number[]): number {
  const n = a.length
  if (n < 2) return 0
  const meanA = a.reduce((s, v) => s + v, 0) / n
  const meanB = b.reduce((s, v) => s + v, 0) / n

  let covariance = 0
  let varianceA = 0
  let varianceB = 0
  for (let i = 0; i < n; i += 1) {
    const dA = a[i] - meanA
    const dB = b[i] - meanB
    covariance += dA * dB
    varianceA += dA * dA
    varianceB += dB * dB
  }
  const denominator = Math.sqrt(varianceA * varianceB)
  return denominator === 0 ? 0 : covariance / denominator
}

export type Distribution = {
  n: number
  mean: number
  sd: number
  min: number
  max: number
  p50: number
  p95: number
  range: number
}

export function describe(values: number[]): Distribution {
  if (values.length === 0) {
    return { n: 0, mean: 0, sd: 0, min: 0, max: 0, p50: 0, p95: 0, range: 0 }
  }
  const sorted = [...values].sort((x, y) => x - y)
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  // Sample standard deviation (n-1); with a single observation there is no spread to report.
  const sd = values.length < 2
    ? 0
    : Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1))

  return {
    n: values.length,
    mean,
    sd,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    range: sorted[sorted.length - 1] - sorted[0],
  }
}

/** Linear-interpolated percentile over an already-sorted array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]
  const position = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}
