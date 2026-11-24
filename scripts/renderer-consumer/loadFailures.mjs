import { isSameCapture, sameImageFailures } from './imageFailures.mjs';

/**
 * The noise of the package's worker and the swatch a changed file repaints, as a page sees them.
 *
 * @param {import('./app/loadChecks').LoadCheckResults} results
 */
export function loadFailures(results) {
  const failures = [];
  if (results.workersStarted < 1) {
    failures.push(`a NoiseTexture2D: expected the package to start a worker, got ${results.workersStarted}`);
  }
  if (isSameCapture(results.untexturedPng, results.noisePng)) {
    failures.push('a NoiseTexture2D: expected the noise to change the quad, got the untextured frame');
  }
  if (isSameCapture(results.redPng, results.repaintedPng)) {
    failures.push('a watched swatch: expected the repainted frame to change, got the red frame');
  }
  failures.push(
    ...sameImageFailures(
      'a watched swatch: expected the frame of a fresh blue view',
      results.freshBluePng,
      results.repaintedPng
    )
  );
  if (!results.isSameCanvas)
    failures.push('a watched swatch: expected the view to keep its canvas, got a new one');
  return failures.map((failure) => `load: ${failure}`);
}
