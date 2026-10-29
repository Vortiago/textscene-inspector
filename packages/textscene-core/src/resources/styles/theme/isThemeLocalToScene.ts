/** Whether a Theme holds its items local to scene, which decides whether Godot sets a ViewportTexture in it up. */

import { boolSlotValue } from '../../../godot/variant/variantBool.js';
import type { ThemeResource } from './types';

/**
 * `theme`'s `resource_local_to_scene` as its file says, false by default, and never for the
 * project theme, which no scene instantiates.
 *
 * @canonical Whether a Theme's icons and styles reach a texture local to scene
 */
export function isThemeLocalToScene(theme: ThemeResource): boolean {
  return !theme.isOutsideScenes && boolSlotValue(theme.properties.resource_local_to_scene) === true;
}
