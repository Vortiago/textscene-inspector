import { sameImageFailures } from './imageFailures.mjs';

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
