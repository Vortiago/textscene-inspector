import { compareImages, formatDelta } from '../visual/imageDelta.mjs';

const pngOf = (base64) => Buffer.from(base64, 'base64');

function sameImageFailures(name, expected, actual) {
  const delta = compareImages(pngOf(expected), pngOf(actual));
  if (!delta.sizeMismatch && delta.changedPixels === 0) return [];
  return [`${name}: ${formatDelta(delta)}`];
}

/** @param {import('./app/heldResourceChecks').HeldResourceCheckResults} results */
export function heldResourceFailures(results) {
  return [
    ...sameImageFailures(
      'a write of a held sphere: expected the frame of the file that names it',
      results.authoredSpherePng,
      results.writtenSpherePng
    ),
    ...sameImageFailures(
      'a write of a held material to a mesh: expected the frame with no mesh',
      results.authoredNoMeshPng,
      results.writtenMaterialPng
    ),
  ].map((failure) => `held resource: ${failure}`);
}
