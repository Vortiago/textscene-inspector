/**
 * The cameras `ref:ours` opens a scene through with `?camera=`. `--camera` adds a free Camera3D to
 * the scene text it fetches, as `ref:godot --camera` adds one on its side, since the previewer has
 * no pose deep link. `--scene-camera` names one of the scene's own.
 */

import { EDITOR_FOV } from './run.mjs';

/** The node name the capture opens the scene through. */
export const OUR_CAMERA_NAME = 'RefCamera';

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

/** Each `[node ...]` header in tree order, with its path below the root: '' for the root. */
function sceneNodes(sceneText) {
  return [...sceneText.matchAll(/^\[node [^\]]*\]/gm)].map(([header]) => {
    const name = headerAttribute(header, 'name');
    const parent = headerAttribute(header, 'parent');
    const path = parent === null ? '' : parent === '.' ? name : `${parent}/${name}`;
    return { name, path, type: headerAttribute(header, 'type'), isInstance: /\binstance=/.test(header) };
  });
}

/** The quoted value of `key` in a `[node ...]` header, or null where the header has no such key. */
function headerAttribute(header, key) {
  return new RegExp(`\\b${key}="([^"]*)"`).exec(header)?.[1] ?? null;
}

function rootName(nodes) {
  const root = nodes.find(({ path }) => path === '');
  if (!root) throw new Error('expected a root [node name="..."] in the scene text, found none');
  return root.name;
}

/** The path the previewer reports for the node at `path` below the root. */
function previewerPath(root, path) {
  return path === '' ? root : `${root}/${path}`;
}

/** The path the previewer reports for the free camera: the root node's name, then the camera's. */
export function freeCameraPath(sceneText) {
  return previewerPath(rootName(sceneNodes(sceneText)), OUR_CAMERA_NAME);
}

/**
 * The path the previewer reports for the scene's camera, resolved as `ref:godot`'s `_find_camera`
 * resolves it: `path` below the root, then `path` less its first segment, then the first Camera3D
 * in tree order. `path` true asks for the first. Null where the scene has none, as Godot then keeps
 * the editor orbit.
 */
export function sceneCameraPath(sceneText, path) {
  const nodes = sceneNodes(sceneText);
  const root = rootName(nodes);
  const found =
    namedPaths(path).find((candidate) => isCameraPath(nodes, candidate)) ??
    nodes.find(({ type }) => type === 'Camera3D')?.path;
  return found === undefined ? null : previewerPath(root, found);
}

/** The paths below the root `path` may mean, in the order `_find_camera` tries them. */
function namedPaths(path) {
  if (path === true) return [];
  const slash = path.indexOf('/');
  return slash === -1 ? [path] : [path, path.slice(slash + 1)];
}

/**
 * Whether `path` below the root may name a Camera3D. An instanced scene's root and a path into it
 * may, as the scene text lists none of that scene's nodes.
 */
function isCameraPath(nodes, path) {
  const node = nodes.find((candidate) => candidate.path === path);
  if (node) return node.type === 'Camera3D' || node.isInstance;
  return nodes.some(({ path: at, isInstance }) => isInstance && (at === '' || path.startsWith(`${at}/`)));
}

/** `sceneText` with a Camera3D appended to its root, at the pose and fov of `ref:godot`. */
export function withFreeCamera(sceneText, { camera, lookAt = [0, 0, 0], fov = EDITOR_FOV }) {
  return (
    `${sceneText.trimEnd()}\n\n[node name="${OUR_CAMERA_NAME}" type="Camera3D" parent="."]\n` +
    `transform = ${lookAtTransformText(camera, lookAt)}\nfov = ${fov}\ncurrent = true\n`
  );
}
