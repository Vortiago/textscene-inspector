import * as THREE from 'three';
import type { EnumValue } from '../../godot/classdb/enumNames.js';
import { BlendMode } from '../../godot/rendering/materials/blendMode.js';
import { CullMode } from '../../godot/rendering/materials/cullMode.js';
import { DepthDrawMode } from '../../godot/rendering/materials/depthDrawMode.js';
import type { ShaderNode } from '../language/shaderTree.js';
import { BLEND_MODES, CULL_MODES, DEPTH_DRAW_MODES } from '../material/renderModes.js';
import { godotBlendState } from '../pipeline/blendState.js';
import { CULL_SIDES } from '../pipeline/cullSide.js';

/** `depth_test_disabled` is a material flag beside the DEFAULT and INVERTED depth test. */
type DepthTest = 'enabled' | 'disabled' | 'inverted';

/** The pipeline state of a spatial shader's render modes (`scene_shader_forward_clustered.cpp:98-121`). */
export interface SpatialPipeline {
  readonly blendMode: EnumValue<typeof BlendMode>;
  readonly depthDrawMode: EnumValue<typeof DepthDrawMode>;
  readonly depthTest: DepthTest;
  readonly cullMode: EnumValue<typeof CullMode>;
}

const DEPTH_TESTS: Readonly<Record<string, DepthTest>> = {
  depth_test_default: 'enabled',
  depth_test_disabled: 'disabled',
  depth_test_inverted: 'inverted',
};

function byWord<T extends number>(words: Readonly<Record<T, string>>): Readonly<Record<string, T>> {
  return Object.fromEntries(Object.entries(words).map(([value, word]) => [word, Number(value) as T]));
}

const BLEND_MODE_OF = byWord(BLEND_MODES);
const DEPTH_DRAW_MODE_OF = byWord(DEPTH_DRAW_MODES);
const CULL_MODE_OF = byWord(CULL_MODES);

/** The pipeline state of `tree`. Godot's parser refuses two modes of one group, so each group has one. */
export function spatialPipeline(tree: ShaderNode): SpatialPipeline {
  const modes = tree.renderModes.map((mode) => mode.name);
  const pick = <T>(table: Readonly<Record<string, T>>, fallback: T) =>
    modes.reduce((picked, mode) => table[mode] ?? picked, fallback);
  return {
    blendMode: pick(BLEND_MODE_OF, BlendMode.MIX),
    depthDrawMode: pick(DEPTH_DRAW_MODE_OF, DepthDrawMode.OPAQUE_ONLY),
    depthTest: pick(DEPTH_TESTS, 'enabled'),
    cullMode: pick(CULL_MODE_OF, CullMode.BACK),
  };
}

/** `uses_alpha_pass` (`scene_shader_forward_clustered.h:279`) for the render modes. */
function usesAlphaPass(pipeline: SpatialPipeline): boolean {
  return (
    pipeline.blendMode !== BlendMode.MIX ||
    pipeline.depthDrawMode === DepthDrawMode.DISABLED ||
    pipeline.depthTest !== 'enabled'
  );
}

/** Godot's pipeline (`scene_shader_forward_clustered.cpp:343-447`) as `material`'s draw state. */
export function applySpatialPipeline(material: THREE.Material, pipeline: SpatialPipeline): void {
  const isAlphaPass = usesAlphaPass(pipeline);
  Object.assign(material, isAlphaPass ? godotBlendState(pipeline.blendMode) : { blending: THREE.NoBlending });
  material.transparent = isAlphaPass;
  material.depthTest = pipeline.depthTest !== 'disabled';
  // `scene_shader_forward_clustered.cpp:355-358`, turned round for GL's depth, which is not reversed.
  material.depthFunc = pipeline.depthTest === 'inverted' ? THREE.GreaterDepth : THREE.LessEqualDepth;
  material.depthWrite = material.depthTest && depthWrites(pipeline.depthDrawMode, isAlphaPass);
  material.side = CULL_SIDES[pipeline.cullMode];
  // three draws a transparent DoubleSide material back faces first, in a second draw; Godot draws once.
  material.forceSinglePass = true;
}

/** `depth_draw_opaque` writes depth in the opaque pass only (`scene_shader_forward_clustered.cpp:443`). */
function depthWrites(depthDrawMode: EnumValue<typeof DepthDrawMode>, isAlphaPass: boolean): boolean {
  if (depthDrawMode === DepthDrawMode.DISABLED) return false;
  return depthDrawMode === DepthDrawMode.ALWAYS || !isAlphaPass;
}
