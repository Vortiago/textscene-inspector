/**
 * The node types the camera UI treats as a camera, by Godot's class tree:
 * XRCamera3D is a Camera3D. `descendsFromClass` reads only the generated base-type
 * tables, so the webview bundle pulls in no linter.
 */

import { descendsFromClass } from '../godot/classdb/classBaseTypes.js';

/** Camera3D and every type descending from it (XRCamera3D). */
export function isCamera3DType(type: string): boolean {
  return descendsFromClass(type, 'Camera3D');
}

/** Camera2D and every type descending from it (none in Godot 4.6.3). */
export function isCamera2DType(type: string): boolean {
  return descendsFromClass(type, 'Camera2D');
}
