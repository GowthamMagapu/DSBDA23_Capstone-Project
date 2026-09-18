import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  accuracy, classMetrics, cohensKappa, confusionMatrix, describe as summarise,
  macroF1, spearman, type Label,
} from '../eval/lib/metrics'

// The figures reported in docs/paper/ are produced by these functions. If they are wrong,
// the paper is wrong, so each is checked against a hand-computable case.

const pair = (truth: Label, predicted: Label) => ({ truth, predicted })

describe('confusionMatrix and accuracy', () => {
  test('counts each (truth, predicted) cell', () => {
    const m = confusionMatrix([
      pair('selected', 'selected'), pair('selected', 'review'),
      pair('review', 'review'), pair('rejected', 'rejected'),
    ])
    assert.equal(m.selected.selected, 1)
    assert.equal(m.selected.review, 1)
    assert.equal(m.review.review, 1)
    assert.equal(m.rejected.rejected, 1)
    assert.equal(m.rejected.selected, 0)
  })

  test('accuracy is the diagonal over the total', () => {
    const m = confusionMatrix([
      pair('selected', 'selected'), pair('review', 'review'),
      pair('rejected', 'rejected'), pair('rejected', 'review'),
    ])
    assert.equal(accuracy(m), 0.75)
  })

  test('accuracy is 0 for an empty set rather than NaN', () => {
    assert.equal(accuracy(confusionMatrix([])), 0)
  })
})

describe('per-class precision, recall and F1', () => {
  test('computes one-vs-rest metrics correctly', () => {
    // 'selected': 2 true positives, 1 false positive (a review predicted selected),
    // 1 false negative (a selected predicted review).
    const m = confusionMatrix([
      pair('selected', 'selected'), pair('selected', 'selected'),
      pair('selected', 'review'), pair('review', 'selected'),
    ])
    const selected = classMetrics(m).find((c) => c.label === 'selected')!
    assert.equal(selected.support, 3)
    assert.equal(selected.precision, 2 / 3)
    assert.equal(selected.recall, 2 / 3)
    assert.equal(selected.f1, 2 / 3)
  })

  test('reports zero rather than NaN for a class that is never predicted', () => {
    const m = confusionMatrix([pair('selected', 'review'), pair('review', 'review')])
    const selected = classMetrics(m).find((c) => c.label === 'selected')!
    assert.equal(selected.precision, 0)
    assert.equal(selected.recall, 0)
    assert.equal(selected.f1, 0)
  })

  test('macro F1 is 1 for perfect agreement', () => {
    const m = confusionMatrix([
      pair('selected', 'selected'), pair('review', 'review'), pair('rejected', 'rejected'),
    ])
    assert.equal(macroF1(m), 1)
  })
})

describe('Cohen kappa', () => {
  test('is 1 for perfect agreement', () => {
    const m = confusionMatrix([
      pair('selected', 'selected'), pair('review', 'review'),
      pair('rejected', 'rejected'), pair('rejected', 'rejected'),
    ])
    assert.equal(cohensKappa(m), 1)
  })

  test('is 0 when a constant prediction matches the base rate — the reject-all baseline', () => {
    // This is exactly the 'majority' condition reported in the paper: predicting one class
    // for everything scores high accuracy but zero chance-corrected agreement.
    const m = confusionMatrix([
      pair('rejected', 'rejected'), pair('rejected', 'rejected'),
      pair('rejected', 'rejected'), pair('selected', 'rejected'),
    ])
    assert.equal(accuracy(m), 0.75, 'accuracy looks respectable')
    assert.equal(cohensKappa(m), 0, 'kappa correctly reports no agreement beyond chance')
  })

  test('is negative when agreement is worse than chance', () => {
    const m = confusionMatrix([
      pair('selected', 'review'), pair('review', 'selected'),
      pair('selected', 'review'), pair('review', 'selected'),
    ])
    assert.ok(cohensKappa(m) < 0)
  })
})

describe('Spearman rank correlation', () => {
  test('is 1 for a perfectly monotonic increasing relationship', () => {
    assert.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1)
  })

  test('is 1 for any monotonic relationship, not only a linear one', () => {
    assert.equal(spearman([1, 2, 3, 4], [1, 4, 90, 1000]), 1)
  })

  test('is -1 when the ordering is exactly reversed', () => {
    assert.equal(spearman([1, 2, 3, 4], [40, 30, 20, 10]), -1)
  })

  test('handles ties by averaging their ranks', () => {
    // Both series carry the same tie structure, so they correlate perfectly.
    assert.equal(spearman([1, 2, 2, 3], [10, 20, 20, 30]), 1)
  })

  test('is 0 when one series is constant, rather than NaN', () => {
    assert.equal(spearman([1, 2, 3, 4], [5, 5, 5, 5]), 0)
  })

  test('is 0 for fewer than two observations', () => {
    assert.equal(spearman([1], [1]), 0)
    assert.equal(spearman([], []), 0)
  })
})

describe('distribution summary', () => {
  test('computes mean, sample SD, median and range', () => {
    const d = summarise([2, 4, 4, 4, 5, 5, 7, 9])
    assert.equal(d.n, 8)
    assert.equal(d.mean, 5)
    assert.ok(Math.abs(d.sd - 2.1381) < 0.001, `sample SD was ${d.sd}`)
    assert.equal(d.min, 2)
    assert.equal(d.max, 9)
    assert.equal(d.range, 7)
    assert.equal(d.p50, 4.5)
  })

  test('reports zero spread for a single observation', () => {
    const d = summarise([42])
    assert.equal(d.mean, 42)
    assert.equal(d.sd, 0, 'one observation has no sample spread')
    assert.equal(d.range, 0)
    assert.equal(d.p50, 42)
  })

  test('returns zeros for an empty series rather than NaN', () => {
    const d = summarise([])
    assert.equal(d.n, 0)
    assert.equal(d.mean, 0)
    assert.equal(d.sd, 0)
  })
})
