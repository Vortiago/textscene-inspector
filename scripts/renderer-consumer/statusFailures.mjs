import { equalityFailure } from './mountFailures.mjs';

const UNDRAWN = [{ path: '/root/Root/Sign', meshTypes: ['FutureMesh'], isEmptyShape: false }];

/** @param {import('./app/statusChecks').StatusCheckResults} results */
export function statusFailures({
  statusSettled,
  settled,
  undrawn,
  heardTextureBuild,
  settledAfterWrite,
  idleCalls,
  fps,
}) {
  return [
    ...equalityFailure('status().settled once settled', settled, statusSettled),
    ...equalityFailure('status().undrawn', UNDRAWN, undrawn),
    ...(heardTextureBuild
      ? []
      : ['onStatusChange: expected a call that counts the NoiseTexture2D build, got none']),
    ...(settledAfterWrite[0] === null && settledAfterWrite.at(-1)
      ? []
      : [
          `onStatusChange after a write: expected pending, then settled, got ${JSON.stringify(settledAfterWrite)}`,
        ]),
    ...equalityFailure('onStatusChange calls of an idle view that measures its frames', 0, idleCalls),
    ...(fps !== null && fps > 0
      ? []
      : [`status().frame with show.performance: expected an FPS over 0, got ${fps}`]),
  ].map((failure) => `status: ${failure}`);
}
