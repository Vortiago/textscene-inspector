/**
 * The allocation guard every procedural texture shares. A size Godot accepts can still exceed the
 * memory a tab has, and a typed array that large throws `RangeError` instead of returning.
 */

import { warn } from '../../logger.js';

/**
 * `build()`'s result, or null when the tab cannot allocate its pixels, so the previewer draws no
 * texture where it would otherwise throw out of the render. `label` names the texture and its size
 * in the warning. Any other failure propagates.
 */
export function unlessAllocationFails<T>(label: string, build: () => T): T | null {
  try {
    return build();
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    warn(`${label} could not be allocated (${error.message}); drawing no texture`);
    return null;
  }
}
