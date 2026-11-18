import * as THREE from 'three';
import type { EnumValue } from '../../godot/classdb/enumNames.js';
import { BlendMode } from '../../godot/rendering/materials/blendMode.js';
import type { ShaderNode } from '../language/shaderTree.js';
import { godotBlendState } from '../pipeline/blendState.js';

type DepthDraw = 'opaque' | 'always' | 'never';
type DepthTest = 'enabled' | 'disabled' | 'inverted';

/** The pipeline state of a spatial shader's render modes (`scene_shader_forward_clustered.cpp:98-121`). */
export interface SpatialPipeline {
  readonly blendMode: EnumValue<typeof BlendMode>;
  readonly depthDraw: DepthDraw;
  readonly depthTest: DepthTest;
  /** three's `side` names the faces kept, where Godot's cull mode names the faces culled. */
  readonly side: THREE.Side;
}

const BLEND_MODES: Readonly<Record<string, EnumValue<typeof BlendMode>>> = {
  blend_mix: BlendMode.MIX,
  blend_add: BlendMode.ADD,
  blend_sub: BlendMode.SUB,
  blend_mul: BlendMode.MUL,
  blend_premul_alpha: BlendMode.PREMULT_ALPHA,
};

const DEPTH_DRAWS: Readonly<Record<string, DepthDraw>> = {
  depth_draw_opaque: 'opaque',
  depth_draw_always: 'always',
  depth_draw_never: 'never',
};

const DEPTH_TESTS: Readonly<Record<string, DepthTest>> = {
  depth_test_default: 'enabled',
  depth_test_disabled: 'disabled',
  depth_test_inverted: 'inverted',
};

const SIDES: Readonly<Record<string, THREE.Side>> = {
  cull_back: THREE.FrontSide,
  cull_front: THREE.BackSide,
  cull_disabled: THREE.DoubleSide,
};

/** The pipeline state of `tree`. Godot's parser refuses two modes of one group, so each group has one. */
export function spatialPipeline(tree: ShaderNode): SpatialPipeline {
  const modes = tree.renderModes.map((mode) => mode.name);
  const pick = <T>(table: Readonly<Record<string, T>>, fallback: T) =>
    modes.reduce((picked, mode) => table[mode] ?? picked, fallback);
  return {
    blendMode: pick(BLEND_MODES, BlendMode.MIX),
    depthDraw: pick(DEPTH_DRAWS, 'opaque'),
    depthTest: pick(DEPTH_TESTS, 'enabled'),
    side: pick(SIDES, THREE.FrontSide),
  };
}

/** `uses_alpha_pass` (`scene_shader_forward_clustered.h:279`) for the render modes. */
function usesAlphaPass(pipeline: SpatialPipeline): boolean {
  return (
    pipeline.blendMode !== BlendMode.MIX || pipeline.depthDraw === 'never' || pipeline.depthTest !== 'enabled'
  );
}

/** Godot's pipeline (`scene_shader_forward_clustered.cpp:343-447`) as `material`'s draw state. */
export function applySpatialPipeline(material: THREE.Material, pipeline: SpatialPipeline): void {
  const isAlphaPass = usesAlphaPass(pipeline);
  Object.assign(material, isAlphaPass ? godotBlendState(pipeline.blendMode) : { blending: THREE.NoBlending });
  material.transparent = isAlphaPass;
  material.depthTest = pipeline.depthTest !== 'disabled';
  // Godot's reversed depth compares GREATER_OR_EQUAL, and inverted LESS, which GL's depth turns round.
  material.depthFunc = pipeline.depthTest === 'inverted' ? THREE.GreaterDepth : THREE.LessEqualDepth;
  material.depthWrite = material.depthTest && depthWrites(pipeline.depthDraw, isAlphaPass);
  material.side = pipeline.side;
  // three draws a transparent DoubleSide material back faces first, in a second draw; Godot draws once.
  material.forceSinglePass = true;
}

/** `depth_draw_opaque` writes depth in the opaque pass only (`scene_shader_forward_clustered.cpp:443`). */
function depthWrites(depthDraw: DepthDraw, isAlphaPass: boolean): boolean {
  if (depthDraw === 'never') return false;
  return depthDraw === 'always' || !isAlphaPass;
}
