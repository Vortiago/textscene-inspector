/** The size Button and MenuButton lay their icon out at before they fit it. No React. */

import type * as THREE from 'three';
import type { Vector2 } from '../../../../godot/math/vector';
import { textureSize } from '../../../../resources/textures/textureSize';

/**
 * The size Godot reports for `icon`. Null for no icon and for an icon of no area, which Godot
 * neither draws nor makes room for (`button.cpp:369`).
 */
export function buttonIconSize(icon: THREE.Texture | null): Vector2 | null {
  const size = textureSize(icon);
  return size && size.width > 0 && size.height > 0 ? { x: size.width, y: size.height } : null;
}
