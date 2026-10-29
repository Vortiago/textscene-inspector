/**
 * Whether Godot sets a ViewportTexture up for its scene. `make_local_resource` reads only the
 * property's own resource (`packed_scene.cpp:701-704`), and `configure_for_local_scene` recurses
 * only into sub-resources that are local to scene (`core/io/resource.cpp:497-503`), so every holder
 * between the node and the ViewportTexture must be local to scene. No THREE and no React.
 */

import type { TscnInternalResource } from '../../../parser/types.js';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';
import { VIEWPORT_TEXTURE_TYPE } from './types.js';

/**
 * `resource_local_to_scene`, or its default: true for a ViewportTexture, whose constructor sets it
 * (`viewport.cpp:226-228`), false for any other resource.
 */
export function isLocalToScene(resource: TscnInternalResource): boolean {
  return boolSlotValue(resource.data.resource_local_to_scene) ?? resource.type === VIEWPORT_TEXTURE_TYPE;
}
