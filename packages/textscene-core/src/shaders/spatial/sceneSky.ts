import * as THREE from 'three';
import { int, min, uniformArray } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import type { Binding } from '../uniforms/bindingTable.js';
import { roundedLayer } from '../language/textureLayer.js';
import { scaleLayerReads } from '../language/layerScaledReads.js';
import { skyLayersTextureNode } from '../sky/radianceTextureNode.js';
import { defaultTexture } from '../uniforms/defaultTextures.js';
import {
  MAX_ROUGHNESS_LOD,
  SKY_ROUGHNESS_LAYERS_DEFAULT,
} from '../../godot/rendering/environment/skyReflection.js';
import type { SpatialFrame } from './spatialBindings.js';

/** The sky an Environment lights surfaces with: Godot's radiance octmap array and its settings. */
export interface SceneSky {
  /** The roughness layers, layer 0 the radiance, each holding its texels at energy 1. */
  readonly layers: THREE.DataArrayTexture;
  /** The energy each layer was baked at, which its reads take. A layer past the last reads the last. */
  readonly layerEnergies: ArrayLike<number>;
  /** One over the radiance size (`renderer_scene_render_rd.cpp:1396`). */
  readonly pixelSize: number;
  /** The padding of each side, in UV: Godot's `uv_border_size` (`sky.cpp:1559`). */
  readonly borderSize: number;
  /** World to sky space: the inverse of `sky_rotation`'s basis. */
  readonly worldToSky: THREE.Matrix3;
  /** `background_energy_multiplier`. */
  readonly energyMultiplier: number;
  /** The sky's share of the ambient light, 0 when the ambient source takes none of it. */
  readonly ambientContribution: number;
  /** Whether the ambient source is the sky: the flag at any share (`render_scene_data_rd.cpp:189`). */
  readonly isAmbientSource: boolean;
  /** Whether the reflection source gives surfaces the sky (`render_scene_data_rd.cpp:196-199`). */
  readonly isReflected: boolean;
}

/** The template's texture of the sky's layers. */
const RADIANCE_OCTMAP = 'radiance_octmap';

/** The scene data flags of the sky (`scene_data_inc.glsl:7-8`). */
const USE_AMBIENT_CUBEMAP = 1 << 1;
const USE_REFLECTION_CUBEMAP = 1 << 2;

/** What a scene with no sky binds, as Godot binds a black array (`render_forward_clustered.cpp:3325`). */
const NO_LAYERS = defaultTexture('layers', 'black') as THREE.DataArrayTexture;

/** Each program's energies of its layers, by its texture node. Written only by `radianceOctmapNode`. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const energiesOf = new WeakMap<TextureNode, { array: number[] }>();

/** The node of the sky's layers, whose reads scale by their layer's energy, as Godot bakes it into each. */
export function radianceOctmapNode(): TextureNode {
  const node = skyLayersTextureNode(NO_LAYERS);
  const energies = uniformArray(new Array<number>(SKY_ROUGHNESS_LAYERS_DEFAULT).fill(0), 'float');
  energiesOf.set(node, energies as unknown as { array: number[] });
  scaleLayerReads(node, (layer) => {
    // A layer past the array's last reads the last, as the texture clamps it.
    const index = min(roundedLayer(layer) as never, int(MAX_ROUGHNESS_LOD) as never);
    return energies.element(index) as unknown as Node;
  });
  return node;
}

/** The scene data flags of `sky` (`render_scene_data_rd.cpp:188-199`). */
export function skyFlagsOf(sky: SceneSky | undefined): number {
  if (!sky) return 0;
  return (sky.isAmbientSource ? USE_AMBIENT_CUBEMAP : 0) | (sky.isReflected ? USE_REFLECTION_CUBEMAP : 0);
}

/** Binds the layers of `sky` to `textures`, black with no sky. */
export function bindSkyLayers(textures: ReadonlyMap<string, TextureNode>, sky: SceneSky | undefined): void {
  const node = textures.get(RADIANCE_OCTMAP);
  if (!node) return;
  node.value = sky?.layers ?? NO_LAYERS;
  const energies = energiesOf.get(node)!.array;
  for (let layer = 0; layer < energies.length; layer++)
    energies[layer] = sky ? (sky.layerEnergies[Math.min(layer, sky.layerEnergies.length - 1)] ?? 0) : 0;
}

const DATA = 'scene_data_block.data';

/** Scratch for one draw's sky basis, overwritten by the next. */
const radianceBasis = new THREE.Matrix3();
const cameraBasis = new THREE.Matrix3();

/** Zero unless a surface reads the sky, as Godot writes it only then (`render_scene_data_rd.cpp:201-205`). */
function radianceInverseXform({ sky, camera }: SpatialFrame): THREE.Matrix3 {
  if (!sky || !skyFlagsOf(sky)) return radianceBasis.set(0, 0, 0, 0, 0, 0, 0, 0, 0);
  return radianceBasis.multiplyMatrices(sky.worldToSky, cameraBasis.setFromMatrix4(camera.matrixWorld));
}

/** Each member of `SceneData` the sky's light on a surface reads. */
export const SCENE_SKY_BINDINGS: readonly Binding<SpatialFrame>[] = [
  {
    uniform: `${DATA}.radiance_pixel_size`,
    godot: 'render_scene_data_rd.cpp:143; renderer_scene_render_rd.cpp:1396',
    value: ({ sky }) => sky?.pixelSize ?? 0,
  },
  {
    uniform: `${DATA}.radiance_border_size`,
    godot: 'render_scene_data_rd.cpp:144; renderer_scene_render_rd.cpp:1398',
    value: ({ sky }) => sky?.borderSize ?? 0,
  },
  {
    uniform: `${DATA}.radiance_inverse_xform`,
    godot: 'render_scene_data_rd.cpp:201-205',
    value: radianceInverseXform,
  },
  {
    uniform: `${DATA}.ambient_color_sky_mix`,
    godot: 'render_scene_data_rd.cpp:169',
    value: ({ sky }) => sky?.ambientContribution ?? 0,
  },
  {
    uniform: `${DATA}.IBL_exposure_normalization`,
    godot: 'render_scene_data_rd.cpp:240-246, 255',
    value: ({ sky, emissiveExposure }) => (sky ? emissiveExposure : 1),
  },
];
