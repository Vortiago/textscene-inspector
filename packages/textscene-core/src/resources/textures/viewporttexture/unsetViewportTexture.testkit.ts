/**
 * A ViewportTexture authored as not local to scene, which Godot never sets up: it reports size 0
 * (`viewport.cpp:150-166`) and samples the placeholder.
 */

import type { TscnInternalResource } from '../../../parser/types';

export const UNSET_VIEWPORT_TEXTURE: TscnInternalResource = {
  id: 'UnsetViewportTexture',
  type: 'ViewportTexture',
  data: { viewport_path: 'NodePath("SubViewport")', resource_local_to_scene: 'false' },
};

/** A slot's reference to `UNSET_VIEWPORT_TEXTURE`. */
export const UNSET_VIEWPORT_TEXTURE_REF = 'SubResource("UnsetViewportTexture")';
