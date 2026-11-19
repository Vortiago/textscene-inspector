import { compareImages, formatDelta, isSameImage } from '../visual/imageDelta.mjs';

const pngOf = (base64) => Buffer.from(base64, 'base64');

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
  if (isSameImage(compareImages(pngOf(results.untexturedPng), pngOf(results.noisePng)))) {
    failures.push('a NoiseTexture2D: expected the noise to change the quad, got the untextured frame');
  }
  if (isSameImage(compareImages(pngOf(results.redPng), pngOf(results.repaintedPng)))) {
    failures.push('a watched swatch: expected the repainted frame to change, got the red frame');
  }
  const repaintDelta = compareImages(pngOf(results.freshBluePng), pngOf(results.repaintedPng));
  if (!isSameImage(repaintDelta)) {
    failures.push(
      `a watched swatch: expected the frame of a fresh blue view, got ${formatDelta(repaintDelta)}`
    );
  }
  if (!results.isSameCanvas)
    failures.push('a watched swatch: expected the view to keep its canvas, got a new one');
  return failures.map((failure) => `load: ${failure}`);
}
