import { FogMode } from '../../godot/rendering/environment/depthFog.js';
import {
  SOFT_LOW_PENUMBRA_SAMPLES,
  SOFT_LOW_SHADOW_SAMPLES,
} from '../../godot/rendering/lights/softShadowKernel.js';
import { PackedSpecialisationBit } from '../../godot/rendering/sceneSpecialisation.js';
import type { Binding } from '../uniforms/bindingTable.js';
import type { SpatialFrame } from './spatialBindings.js';

/** Soft Low taps for both shadow kinds (`render_forward_clustered.cpp:4980-4983`, `_inc.glsl:109-123`). */
const SHADOW_QUALITY =
  (SOFT_LOW_SHADOW_SAMPLES << 8) |
  (SOFT_LOW_PENUMBRA_SAMPLES << 14) |
  (SOFT_LOW_SHADOW_SAMPLES << 20) |
  (SOFT_LOW_PENUMBRA_SAMPLES << 26);

const PACKED_0 = 'pso_sc_packed_0';

/** The values a transpiled material starts at, before a frame writes the fog bit. */
export const PACKED_SPECIALISATION_DEFAULTS: ReadonlyMap<string, number> = new Map([
  [PACKED_0, SHADOW_QUALITY],
]);

/** What the packed constants read from a render. */
export interface SpecialisedRender extends Pick<SpatialFrame, 'fog'> {
  /** Whether a directional light of the render draws a soft shadow (`light_storage.cpp:680-686`). */
  readonly drawsDirectionalSoftShadows: boolean;
}

/** The first packed specialisation constant: one program for each value. */
export const PACKED_SPECIALISATIONS: readonly Binding<SpecialisedRender>[] = [
  {
    uniform: PACKED_0,
    godot: 'render_forward_clustered.cpp:428, 2084, 4980-4983',
    value: ({ fog, drawsDirectionalSoftShadows }) =>
      (SHADOW_QUALITY |
        (drawsDirectionalSoftShadows ? PackedSpecialisationBit.USE_DIRECTIONAL_SOFT_SHADOWS : 0) |
        (fog?.mode === FogMode.DEPTH ? PackedSpecialisationBit.USE_DEPTH_FOG : 0)) >>>
      0,
  },
];
