import * as THREE from 'three';
import type { EnumValue } from '../../godot/classdb/enumNames.js';
import {
  AlphaAntiAliasing,
  turnsOnAlphaToCoverage,
} from '../../godot/rendering/materials/alphaAntialiasing.js';
import { passMembership, usesBlendAlpha } from '../../godot/rendering/materials/alphaPass.js';
import { BlendMode } from '../../godot/rendering/materials/blendMode.js';
import { CullMode } from '../../godot/rendering/materials/cullMode.js';
import { DepthDrawMode } from '../../godot/rendering/materials/depthDrawMode.js';
import type { ShaderNode } from '../language/shaderTree.js';
import { everyExpressionIn } from '../language/treeWalk.js';
import { BLEND_MODES, CULL_MODES, DEPTH_DRAW_MODES } from '../material/renderModes.js';
import {
  alphaToCoverageBlendState,
  godotBlendState,
  type MaterialBlendState,
} from '../pipeline/blendState.js';
import { CULL_SIDES } from '../pipeline/cullSide.js';

/** `depth_test_disabled` is a material flag beside the DEFAULT and INVERTED depth test. */
type DepthTest = 'enabled' | 'disabled' | 'inverted';

/** A spatial shader's pipeline from its modes and built-ins (`scene_shader_forward_clustered.cpp:98-141`). */
export interface SpatialPipeline {
  readonly blendMode: EnumValue<typeof BlendMode>;
  readonly depthDrawMode: EnumValue<typeof DepthDrawMode>;
  readonly depthTest: DepthTest;
  readonly cullMode: EnumValue<typeof CullMode>;
  /** Either mode replaces the blend with ALPHA_TO_COVERAGE (`scene_shader_forward_clustered.cpp:239`). */
  readonly alphaAntialiasing: EnumValue<typeof AlphaAntiAliasing>;
  /** `uses_alpha`: a function names ALPHA. */
  readonly usesAlpha: boolean;
  /** `uses_alpha_clip`: a function names ALPHA_SCISSOR_THRESHOLD or ALPHA_HASH_SCALE. */
  readonly usesAlphaClip: boolean;
  /** `uses_alpha_antialiasing`: a function names ALPHA_ANTIALIASING_EDGE or ALPHA_TEXTURE_COORDINATE. */
  readonly usesAlphaAntialiasing: boolean;
  /** `render_mode depth_prepass_alpha` (`scene_shader_forward_clustered.cpp:128`). */
  readonly usesDepthPrepassAlpha: boolean;
  /** A function reads a uniform of the screen, depth or normal roughness texture. */
  readonly readsScreen: boolean;
}

const DEPTH_TESTS: Readonly<Record<string, DepthTest>> = {
  depth_test_default: 'enabled',
  depth_test_disabled: 'disabled',
  depth_test_inverted: 'inverted',
};

const ALPHA_ANTIALIASING_OF: Readonly<Record<string, EnumValue<typeof AlphaAntiAliasing>>> = {
  alpha_to_coverage: AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE,
  alpha_to_coverage_and_one: AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE,
};

function byWord<T extends number>(words: Readonly<Record<T, string>>): Readonly<Record<string, T>> {
  return Object.fromEntries(Object.entries(words).map(([value, word]) => [word, Number(value) as T]));
}

const BLEND_MODE_OF = byWord(BLEND_MODES);
const DEPTH_DRAW_MODE_OF = byWord(DEPTH_DRAW_MODES);
const CULL_MODE_OF = byWord(CULL_MODES);

/** The hints whose texture Godot reads from the frame (`shader_compiler.cpp:926-940`). */
const SCREEN_HINTS: ReadonlySet<string> = new Set([
  'hint_screen_texture',
  'hint_depth_texture',
  'hint_normal_roughness_texture',
]);

/** The pipeline state of `tree`. Godot's parser refuses two modes of one group, so each group has one. */
export function spatialPipeline(tree: ShaderNode): SpatialPipeline {
  const modes = tree.renderModes.map((mode) => mode.name);
  const pick = <T>(table: Readonly<Record<string, T>>, fallback: T) =>
    modes.reduce((picked, mode) => table[mode] ?? picked, fallback);
  const names = namesRead(tree);
  const reads = (...wanted: string[]) => wanted.some((name) => names.has(name));
  return {
    blendMode: pick(BLEND_MODE_OF, BlendMode.MIX),
    depthDrawMode: pick(DEPTH_DRAW_MODE_OF, DepthDrawMode.OPAQUE_ONLY),
    depthTest: pick(DEPTH_TESTS, 'enabled'),
    cullMode: pick(CULL_MODE_OF, CullMode.BACK),
    alphaAntialiasing: pick(ALPHA_ANTIALIASING_OF, AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF),
    usesDepthPrepassAlpha: modes.includes('depth_prepass_alpha'),
    usesAlpha: reads('ALPHA'),
    usesAlphaClip: reads('ALPHA_SCISSOR_THRESHOLD', 'ALPHA_HASH_SCALE'),
    usesAlphaAntialiasing: reads('ALPHA_ANTIALIASING_EDGE', 'ALPHA_TEXTURE_COORDINATE'),
    readsScreen: tree.uniforms.some((uniform) => SCREEN_HINTS.has(uniform.hint) && names.has(uniform.name)),
  };
}

/** Each built-in and uniform a function names: the compiler's usage flags (`shader_compiler.cpp:914`). */
function namesRead(tree: ShaderNode): ReadonlySet<string> {
  const names = new Set<string>();
  for (const definition of tree.functions)
    for (const expression of everyExpressionIn(definition.body))
      if (expression.kind === 'variable' && (expression.builtIn || expression.isUniform))
        names.add(expression.name);
  return names;
}

/** `uses_alpha_pass` (`scene_shader_forward_clustered.h:279`). */
export function usesAlphaPass(pipeline: SpatialPipeline): boolean {
  return passMembership({
    ...pipeline,
    hasReadScreenAlpha: pipeline.readsScreen,
    usesBlendAlpha: usesBlendAlpha(pipeline.blendMode, pipeline.alphaAntialiasing),
    depthDraw: pipeline.depthDrawMode,
    isDepthTestEnabled: pipeline.depthTest === 'enabled',
  }).alphaPass;
}

/** Godot's pipeline (`scene_shader_forward_clustered.cpp:343-447`) as `material`'s draw state. */
export function applySpatialPipeline(material: THREE.Material, pipeline: SpatialPipeline): void {
  const isAlphaPass = usesAlphaPass(pipeline);
  Object.assign(material, isAlphaPass ? alphaPassBlendState(pipeline) : { blending: THREE.NoBlending });
  material.transparent = isAlphaPass;
  // Godot turns alpha to coverage on in the transparent colour pass only (`:431-437`).
  material.alphaToCoverage = isAlphaPass && turnsOnAlphaToCoverage(pipeline.alphaAntialiasing);
  material.depthTest = pipeline.depthTest !== 'disabled';
  // `scene_shader_forward_clustered.cpp:355-358`, turned round for GL's depth, which is not reversed.
  material.depthFunc = pipeline.depthTest === 'inverted' ? THREE.GreaterDepth : THREE.LessEqualDepth;
  material.depthWrite = material.depthTest && depthWrites(pipeline.depthDrawMode, isAlphaPass);
  material.side = CULL_SIDES[pipeline.cullMode];
  // three draws a transparent DoubleSide material back faces first, in a second draw; Godot draws once.
  material.forceSinglePass = true;
}

function alphaPassBlendState(pipeline: SpatialPipeline): MaterialBlendState {
  const mode = pipeline.alphaAntialiasing;
  return turnsOnAlphaToCoverage(mode) ? alphaToCoverageBlendState(mode) : godotBlendState(pipeline.blendMode);
}

/** `depth_draw_opaque` writes depth in the opaque pass only (`scene_shader_forward_clustered.cpp:443`). */
function depthWrites(depthDrawMode: EnumValue<typeof DepthDrawMode>, isAlphaPass: boolean): boolean {
  if (depthDrawMode === DepthDrawMode.DISABLED) return false;
  return depthDrawMode === DepthDrawMode.ALWAYS || !isAlphaPass;
}
