import * as THREE from 'three';
import type { EnumValue } from '../../godot/classdb/enumNames.js';
import {
  AlphaAntiAliasing,
  turnsOnAlphaToCoverage,
  type AlphaToCoverageMode,
} from '../../godot/rendering/materials/alphaAntialiasing.js';
import { passMembership, usesBlendAlpha } from '../../godot/rendering/materials/alphaPass.js';
import type { PassMembership } from '../../godot/rendering/shadowPass.js';
import { BlendMode } from '../../godot/rendering/materials/blendMode.js';
import { CullMode } from '../../godot/rendering/materials/cullMode.js';
import { DepthDrawMode } from '../../godot/rendering/materials/depthDrawMode.js';
import {
  STENCIL_COMPARE_WORDS,
  STENCIL_FLAG_WORDS,
  StencilCompare,
  StencilFlag,
} from '../../godot/rendering/materials/stencil.js';
import type { ShaderNode, UniformHint } from '../language/shaderTree.js';
import { writtenNames } from '../language/assignment.js';
import { everyStatement, variablesRead } from '../language/treeWalk.js';
import {
  ALPHA_TO_COVERAGE_MODES,
  BLEND_MODES,
  CULL_MODES,
  DEPTH_DRAW_MODES,
} from '../material/renderModes.js';
import {
  alphaToCoverageBlendState,
  godotBlendState,
  type MaterialBlendState,
} from '../pipeline/blendState.js';
import { CULL_SIDES } from '../pipeline/cullSide.js';
import { drawAsLines } from '../pipeline/polygonMode.js';
import { applyGodotStencil, type StencilTest } from '../pipeline/stencilState.js';

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
  /** A function names DEPTH, renamed `gl_FragDepth` (`scene_shader_forward_clustered.cpp:770`). */
  readonly writesDepth: boolean;
  /** Each flag that is set of those that keep a surface off the shared depth material. */
  readonly depthFlags: ReadonlySet<DepthFlag>;
  /** Null without a reference, as Godot's `stencil_enabled` (`scene_shader_forward_clustered.cpp:208`). */
  readonly stencil: StencilTest | null;
  /** Null for the surface's own primitive. Godot draws points whenever `uses_point_size` holds. */
  readonly pointDraw: PointDraw | null;
  /** `render_mode wireframe` on triangles. The polygon mode leaves a point unchanged. */
  readonly drawsLines: boolean;
}

/** Quads (`scene_shader_forward_clustered.cpp:414`), as three writes `gl_PointSize = 1.0`, or 1 px points. */
export type PointDraw = 'emulated' | 'native';

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
const ALPHA_ANTIALIASING_OF = byWord(ALPHA_TO_COVERAGE_MODES);

/** The hints whose texture Godot reads from the frame (`shader_compiler.cpp:926-940`). */
const SCREEN_HINTS: ReadonlySet<UniformHint> = new Set<UniformHint>([
  'hint_screen_texture',
  'hint_depth_texture',
  'hint_normal_roughness_texture',
]);

/** Each flag that keeps a surface off the shared depth material (`scene_shader_forward_clustered.h:295`). */
export const DEPTH_FLAGS = [
  'uses_particle_trails',
  'writes_modelview_or_projection',
  'uses_vertex',
  'uses_position',
  'uses_discard',
  'uses_depth_prepass_alpha',
  'uses_alpha_clip',
  'uses_alpha_antialiasing',
  'cull_not_back',
  'uses_point_size',
  'uses_world_coordinates',
  'wireframe',
  'uses_z_clip_scale',
  'stencil_enabled',
] as const;

/** A flag of {@link DEPTH_FLAGS}, by Godot's name. */
export type DepthFlag = (typeof DEPTH_FLAGS)[number];

/** The render mode behind each flag that one sets (`scene_shader_forward_clustered.cpp:119-128`). */
const MODE_FLAGS: Readonly<Record<string, DepthFlag>> = {
  particle_trails: 'uses_particle_trails',
  depth_prepass_alpha: 'uses_depth_prepass_alpha',
  world_vertex_coords: 'uses_world_coordinates',
  wireframe: 'wireframe',
};

/** The built-in whose write sets each flag (`scene_shader_forward_clustered.cpp:148-152`). */
const WRITE_FLAGS: Readonly<Record<string, DepthFlag>> = {
  MODELVIEW_MATRIX: 'writes_modelview_or_projection',
  PROJECTION_MATRIX: 'writes_modelview_or_projection',
  VERTEX: 'uses_vertex',
  POSITION: 'uses_position',
  Z_CLIP_SCALE: 'uses_z_clip_scale',
};

const STENCIL_FLAGS = byWord(STENCIL_FLAG_WORDS);
const STENCIL_COMPARES = byWord(STENCIL_COMPARE_WORDS);

/** The value of the last mode of `table`'s group, or `fallback`. Godot refuses two modes of one group. */
const pickMode = <T>(modes: readonly string[], table: Readonly<Record<string, T>>, fallback: T): T =>
  modes.reduce((picked, mode) => table[mode] ?? picked, fallback);

/** `stencil_mode_values` (`scene_shader_forward_clustered.cpp:154-166`). */
function stencilTest(tree: ShaderNode): StencilTest | null {
  const reference = tree.stencilReference;
  if (reference === undefined) return null;
  const stencilModes = tree.stencilModes.map((mode) => mode.name);
  return {
    flags: stencilModes.reduce((flags, mode) => flags | (STENCIL_FLAGS[mode] ?? 0), 0),
    compare: pickMode(stencilModes, STENCIL_COMPARES, StencilCompare.ALWAYS),
    reference,
  };
}

/** The pipeline state of `tree`. */
export function spatialPipeline(tree: ShaderNode): SpatialPipeline {
  const modes = tree.renderModes.map((mode) => mode.name);
  const pick = <T>(table: Readonly<Record<string, T>>, fallback: T) => pickMode(modes, table, fallback);
  const names = variablesRead(
    tree,
    (variable) => variable.builtIn !== undefined || variable.isUniform === true
  );
  const reads = (...wanted: string[]) => wanted.some((name) => names.has(name));
  const pipeline = {
    blendMode: pick(BLEND_MODE_OF, BlendMode.MIX),
    depthDrawMode: pick(DEPTH_DRAW_MODE_OF, DepthDrawMode.OPAQUE_ONLY),
    depthTest: pick(DEPTH_TESTS, 'enabled'),
    cullMode: pick(CULL_MODE_OF, CullMode.BACK),
    alphaAntialiasing: pick(ALPHA_ANTIALIASING_OF, AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF),
    usesDepthPrepassAlpha: modes.includes('depth_prepass_alpha'),
    usesAlpha: reads('ALPHA'),
    usesAlphaClip: reads('ALPHA_SCISSOR_THRESHOLD', 'ALPHA_HASH_SCALE'),
    usesAlphaAntialiasing: reads('ALPHA_ANTIALIASING_EDGE', 'ALPHA_TEXTURE_COORDINATE'),
    writesDepth: reads('DEPTH'),
    readsScreen: tree.uniforms.some((uniform) => SCREEN_HINTS.has(uniform.hint) && names.has(uniform.name)),
  };
  const usesPointSize = reads('POINT_SIZE', 'POINT_COORD');
  const stencil = stencilTest(tree);
  return {
    ...pipeline,
    depthFlags: depthFlags(tree, modes, { ...pipeline, usesPointSize, usesStencil: stencil !== null }),
    stencil,
    pointDraw: reads('POINT_SIZE') ? 'emulated' : usesPointSize ? 'native' : null,
    drawsLines: modes.includes('wireframe') && !usesPointSize,
  };
}

type FlagSources = Pick<SpatialPipeline, 'cullMode' | 'usesAlphaClip' | 'usesAlphaAntialiasing'> & {
  readonly usesPointSize: boolean;
  readonly usesStencil: boolean;
};

function depthFlags(
  tree: ShaderNode,
  modes: readonly string[],
  sources: FlagSources
): ReadonlySet<DepthFlag> {
  const written = new Set(tree.functions.flatMap((definition) => [...writtenNames(definition.body)]));
  const isSet: Readonly<Partial<Record<DepthFlag, boolean>>> = {
    uses_discard: usesDiscard(tree),
    uses_alpha_clip: sources.usesAlphaClip,
    uses_alpha_antialiasing: sources.usesAlphaAntialiasing,
    cull_not_back: sources.cullMode !== CullMode.BACK,
    uses_point_size: sources.usesPointSize,
    stencil_enabled: sources.usesStencil,
  };
  return new Set<DepthFlag>([
    ...modes.flatMap((mode) => MODE_FLAGS[mode] ?? []),
    ...[...written].flatMap((name) => WRITE_FLAGS[name] ?? []),
    ...DEPTH_FLAGS.filter((flag) => isSet[flag]),
  ]);
}

function usesDiscard(tree: ShaderNode): boolean {
  return tree.functions.some((definition) =>
    [...everyStatement(definition.body)].some(
      (statement) => statement.kind === 'control flow' && statement.flow === 'FLOW_OP_DISCARD'
    )
  );
}

/** `uses_alpha_pass` and `uses_depth_in_alpha_pass` (`scene_shader_forward_clustered.h:279-293`). */
export function spatialPassMembership(pipeline: SpatialPipeline): PassMembership {
  return passMembership({
    ...pipeline,
    hasReadScreenAlpha: pipeline.readsScreen,
    usesBlendAlpha: usesBlendAlpha(pipeline.blendMode, pipeline.alphaAntialiasing),
    isDepthTestEnabled: pipeline.depthTest === 'enabled',
  });
}

const usesAlphaPass = (pipeline: SpatialPipeline): boolean => spatialPassMembership(pipeline).alphaPass;

/** Alpha to coverage: on in the transparent colour pass only (`scene_shader_forward_clustered.cpp:431`). */
export const drawsAlphaToCoverage = (
  pipeline: SpatialPipeline
): pipeline is SpatialPipeline & { readonly alphaAntialiasing: AlphaToCoverageMode } =>
  usesAlphaPass(pipeline) && turnsOnAlphaToCoverage(pipeline.alphaAntialiasing);

/** Godot's pipeline (`scene_shader_forward_clustered.cpp:343-447`) as `material`'s draw state. */
export function applySpatialPipeline(material: THREE.Material, pipeline: SpatialPipeline): void {
  const isAlphaPass = usesAlphaPass(pipeline);
  Object.assign(material, isAlphaPass ? alphaPassBlendState(pipeline) : { blending: THREE.NoBlending });
  material.transparent = isAlphaPass;
  material.alphaToCoverage = drawsAlphaToCoverage(pipeline);
  material.depthTest = pipeline.depthTest !== 'disabled';
  // `scene_shader_forward_clustered.cpp:355-358`, turned round for GL's depth, which is not reversed.
  material.depthFunc = pipeline.depthTest === 'inverted' ? THREE.GreaterDepth : THREE.LessEqualDepth;
  material.depthWrite = material.depthTest && depthWrites(pipeline.depthDrawMode, isAlphaPass);
  // Vulkan culls polygons only, so no point is culled: the emulated quads draw both sides.
  material.side = pipeline.pointDraw ? THREE.DoubleSide : CULL_SIDES[pipeline.cullMode];
  // three draws a transparent DoubleSide material back faces first, in a second draw; Godot draws once.
  material.forceSinglePass = true;
  if (pipeline.stencil) applyGodotStencil(material, pipeline.stencil);
  if (pipeline.drawsLines) drawAsLines(material);
}

/** Godot's error for a stencil read outside the alpha pass (`render_forward_clustered.cpp:4099`). */
export function stencilQueueError(pipeline: SpatialPipeline, path: string): string | undefined {
  const { stencil } = pipeline;
  if (!stencil || !(stencil.flags & StencilFlag.READ) || usesAlphaPass(pipeline)) return undefined;
  const shown = path === '' ? '' : `(${path})`;
  return `Attempting to use a shader ${shown} that reads stencil but is not in the alpha queue. Ensure the material uses alpha blending or has depth_draw disabled or depth_test disabled.`;
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
