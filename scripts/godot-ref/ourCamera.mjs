/**
 * The free camera of `ref:ours --camera`, as the Camera3D node `ref:godot --camera` adds on its
 * side. The previewer has no pose deep link, so the capture adds this node to the scene text it
 * fetches and opens the scene through it with `?camera=`.
 */

/** The node name the capture opens the scene through. */
export const OUR_CAMERA_NAME = 'RefCamera';

/** `editors/3d/default_fov`, the fov `run.mjs` gives its camera. */
const EDITOR_FOV = 70;

const UP = [0, 1, 0];

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalised = (v) => {
  const length = Math.hypot(...v);
  return v.map((component) => component / length);
};

/**
 * The text of a Transform3D that looks from `camera` at `lookAt` with Y up, as `Node3D.look_at`
 * builds it: the camera looks down its own -Z. A scene text lists the basis row by row.
 */
export function lookAtTransformText(camera, lookAt) {
  const backward = normalised(camera.map((component, i) => component - lookAt[i]));
  if (Math.hypot(...cross(UP, backward)) === 0) {
    throw new Error(`--camera ${camera} looks along the up axis at --look-at ${lookAt}`);
  }
  const right = normalised(cross(UP, backward));
  const up = cross(backward, right);
  const rows = [0, 1, 2].flatMap((row) => [right[row], up[row], backward[row]]);
  return `Transform3D(${[...rows, ...camera].map((n) => +n.toFixed(6)).join(', ')})`;
}

/** The path the previewer reports for the free camera: the root node's name, then the camera's. */
export function freeCameraPath(sceneText) {
  const root = /^\[node name="([^"]+)"(?![^\]]*parent=)/m.exec(sceneText);
  if (!root) throw new Error('expected a root [node name="..."] in the scene text, found none');
  return `${root[1]}/${OUR_CAMERA_NAME}`;
}

/** `sceneText` with a Camera3D appended to its root, at the pose and fov of `ref:godot`. */
export function withFreeCamera(sceneText, { camera, lookAt = [0, 0, 0], fov = EDITOR_FOV }) {
  return (
    `${sceneText.trimEnd()}\n\n[node name="${OUR_CAMERA_NAME}" type="Camera3D" parent="."]\n` +
    `transform = ${lookAtTransformText(camera, lookAt)}\nfov = ${fov}\ncurrent = true\n`
  );
}
