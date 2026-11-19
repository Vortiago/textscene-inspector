/** A leftover of at most this many levels is residue, as `ref:diff` counts it. */
export const RESIDUE_MAX_DELTA = 2;
/** The 3D mode adds a camera gizmo and the light icon, about 600 px. A wrong camera moves 11,000. */
export const GIZMO_PIXELS_MAX = 1000;
/** The cube moves from the middle of the front view to a square seen from above, over thousands of pixels. */
export const MOVED_PIXELS_MIN = 2000;

export const REFUSED_MESSAGE = 'expected a Camera3D at "Cube", got a MeshInstance3D';

/** One line per failed check of the view's camera, or none. */
export function cameraFailures({ results, errors }) {
  const { overFromGameView, changedBetweenCameras, changedFromFreshEditor, refused } = results;
  return [
    ...Object.entries(overFromGameView)
      .filter(([, over]) => over > GIZMO_PIXELS_MAX)
      .map(
        ([camera, over]) =>
          `through ${camera}: expected at most ${GIZMO_PIXELS_MAX} pixels past residue from the game's view, got ${over}`
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
    ...errors.map((message) => `page error: ${message}`),
  ].map((failure) => `camera: ${failure}`);
}
