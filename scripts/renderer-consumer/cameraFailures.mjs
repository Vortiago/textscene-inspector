/** A leftover of at most this many levels is residue, as `ref:diff` counts it. */
export const RESIDUE_MAX_DELTA = 2;
/** The camera gizmo and the light icon of the 3D mode, which `show.gizmos` turns off. */
export const GIZMO_PIXELS_MIN = 100;
/** The cube moves from the middle of the front view to a square seen from above, over thousands of pixels. */
export const MOVED_PIXELS_MIN = 2000;

export const REFUSED_MESSAGE = 'expected a Camera3D at "Cube", got a MeshInstance3D';
export const MISSING_PATH = 'Rig/Gone';
export const MISSING_MESSAGE = `expected a Camera3D at "${MISSING_PATH}", got no node once the scene loaded`;

/** One line per failed check of the view's camera, or none. */
export function cameraFailures({ results, errors }) {
  const { overFromGameView, gizmoPixels, changedBetweenCameras, changedFromFreshEditor, refused, missing } =
    results;
  const { settle } = results;
  return [
    ...Object.entries(overFromGameView)
      .filter(([, over]) => over > 0)
      .map(
        ([camera, over]) =>
          `through ${camera} with no gizmo: expected no pixel past residue from the game's view, got ${over}`
      ),
    ...Object.entries(gizmoPixels)
      .filter(([, changed]) => changed < GIZMO_PIXELS_MIN)
      .map(
        ([camera, changed]) =>
          `through ${camera}: expected the gizmos to change at least ${GIZMO_PIXELS_MIN} pixels, got ${changed}`
      ),
    ...(changedBetweenCameras >= MOVED_PIXELS_MIN
      ? []
      : [`a new camera: expected at least ${MOVED_PIXELS_MIN} changed pixels, got ${changedBetweenCameras}`]),
    ...(changedFromFreshEditor === 0
      ? []
      : [`null: expected the frame of a fresh 3D mount, got ${changedFromFreshEditor} changed pixels`]),
    ...(refused === REFUSED_MESSAGE
      ? []
      : [`a MeshInstance3D: expected "${REFUSED_MESSAGE}", got ${refused}`]),
    ...(missing === MISSING_MESSAGE
      ? []
      : [`a path to no node: expected settled to reject with "${MISSING_MESSAGE}", got ${missing}`]),
    ...Object.entries(settle.overFromShot)
      .filter(([, over]) => over !== 0)
      .map(
        ([view, over]) =>
          `a fresh ${view} through Rig/Front: expected its capture at settled to show that camera, got ${over} pixels past residue`
      ),
    ...(typeof settle.settleMs.editor === 'number'
      ? []
      : [`camera null: expected settled to resolve, got "${settle.settleMs.editor}"`]),
    ...(settle.missing === MISSING_MESSAGE
      ? []
      : [
          `a TscnCanvas ref to no node: expected settled to reject with "${MISSING_MESSAGE}", got ${settle.missing}`,
        ]),
    ...(settle.keptMissing === MISSING_MESSAGE
      ? []
      : [
          `a TscnCanvas ref with camera left out: expected settled to reject with "${MISSING_MESSAGE}", got ${settle.keptMissing}`,
        ]),
    ...errors.map((message) => `page error: ${message}`),
  ].map((failure) => `camera: ${failure}`);
}
