/**
 * Which node types the camera UI treats as a camera.
 *
 * Godot's class tree, not the literal type name: XRCamera3D IS a Camera3D and
 * the renderer mounts the Camera3D component for it, so the Cameras panel, the
 * inspector's "Use This Camera" action and the camera stat chip must see it as
 * one too. Any future descendant follows for free.
 *
 * `descendsFrom` reaches nothing but the generated base-type table (a frozen
 * object literal), so this pulls no linter machinery into the webview bundle,
 * which does not ship the linter.
 */

import { descendsFrom } from '../godot/nodeBaseTypes.js';

/** Camera3D and every type descending from it (XRCamera3D). */
export function isCamera3DType(type: string): boolean {
  return descendsFrom(type, 'Camera3D');
}

/** Camera2D and every type descending from it (none in Godot 4.6.3). */
export function isCamera2DType(type: string): boolean {
  return descendsFrom(type, 'Camera2D');
}
