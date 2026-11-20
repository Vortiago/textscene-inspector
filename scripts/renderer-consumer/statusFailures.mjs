import { equalityFailure } from './mountFailures.mjs';

const UNDRAWN = [{ path: '/root/Root/Sign', meshTypes: ['FutureMesh'], isEmptyShape: false }];

/** Godot 4.6.3's editor monitor on the counted scene, from `Viewport.get_render_info` in Compatibility. */
const GODOT_PLAIN = { objects: 3, primitives: 4248, hasTimings: false };

/** Godot draws fewer shadow casters per split than the view does, so the check asks only that they count. */
function shadowFailures(plain, shadowed) {
  if (!plain || !shadowed)
    return [
      `status().frame of the counted scene: expected two windows, got ${JSON.stringify(plain)} and ${JSON.stringify(shadowed)}`,
    ];
  return [
    ...equalityFailure('primitives of the counted scene with shadows', plain.primitives, shadowed.primitives),
    ...(shadowed.objects > plain.objects
      ? []
      : [`objects with shadows: expected more than the ${plain.objects} without, got ${shadowed.objects}`]),
  ];
}

/** @param {import('./app/statusChecks').StatusCheckResults} results */
export function statusFailures({
  statusSettled,
  settled,
  undrawn,
  heardTextureBuild,
  settledAfterWrite,
  idleCalls,
  fps,
  plain,
  shadowed,
  oneSplit,
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
    ...(fps !== null && fps > 0 ? [] : [`status().frame: expected an FPS over 0, got ${fps}`]),
    ...equalityFailure('status().frame of the counted scene', GODOT_PLAIN, plain),
    ...shadowFailures(plain, shadowed),
    ...shadowFailures(plain, oneSplit),
  ].map((failure) => `status: ${failure}`);
}
