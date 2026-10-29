/**
 * The size a sized canvas consumer lays out by, from the size Godot reports for its texture
 * (`Texture2DResult.size`). No React.
 */

import type { Vector2 } from '../../godot/math/vector';
import type { ImageSize } from '../formats/image/imagePixels';

/**
 * `size` as a Vector2, or null for no size and for one of no area, which a sized consumer neither
 * draws nor makes room for (`button.cpp:369`).
 *
 * @canonical The size Godot reports for a drawn texture
 */
export function sizeWithArea(size: ImageSize | undefined): Vector2 | null {
  return size && size.width > 0 && size.height > 0 ? { x: size.width, y: size.height } : null;
}
