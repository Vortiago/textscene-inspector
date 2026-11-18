import * as THREE from 'three';
import { vec4 } from 'three/tsl';
import type { Node, UniformNode } from 'three/webgpu';
import { DEPTH_PREPASS_OPAQUE_THRESHOLD } from '../../godot/rendering/opaquePrepass.js';
import type { PrepassDraw } from '../pipeline/depthPrepass.js';
import type { Renderer } from '../preprocessor/renderingMethod.js';
import { BoundNodeMaterial, type MaterialShader } from '../uniforms/boundMaterial.js';
import { spatialPassMembership, type DepthFlag, type SpatialPipeline } from './spatialPipeline.js';
import type { EmittedStages } from './transpileSpatial.js';

const THRESHOLD = 'scene_data_block.data.opaque_prepass_threshold';

/** Which surfaces a renderer's depth prepass draws, and which it draws with the default material. */
interface PrepassRule {
  /** The flags that keep a surface off the default material. */
  readonly ownDepthFlags: readonly DepthFlag[];
  readonly drawsAlphaSurface: (pipeline: SpatialPipeline) => boolean;
}

/** Each renderer's rule. Mobile draws no depth prepass. */
const PREPASS_RULES: Readonly<Record<Renderer, PrepassRule | null>> = {
  // `scene_shader_forward_clustered.h:288-298`.
  forward_plus: {
    ownDepthFlags: [
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
    ],
    drawsAlphaSurface: (pipeline) => spatialPassMembership(pipeline).depthInAlphaPass,
  },
  // `rasterizer_scene_gles3.cpp:242-269`: alpha antialiasing puts no alpha surface in the prepass.
  gl_compatibility: {
    ownDepthFlags: [
      'uses_particle_trails',
      'writes_modelview_or_projection',
      'uses_vertex',
      'uses_discard',
      'uses_depth_prepass_alpha',
      'uses_alpha_clip',
      'uses_world_coordinates',
      'wireframe',
    ],
    drawsAlphaSurface: (pipeline) =>
      pipeline.usesDepthPrepassAlpha && spatialPassMembership(pipeline).depthInAlphaPass,
  },
  mobile: null,
};

/** The parts of a transpiled program the prepass draws with. */
export interface PrepassProgram {
  /** A new emit of both stages of the depth variant. */
  readonly depthStages: () => EmittedStages;
  readonly shader: MaterialShader;
  readonly uniforms: ReadonlyMap<string, UniformNode<unknown>>;
}

/** What `renderer`'s depth prepass draws of a transpiled surface: null keeps it out. */
export function spatialPrepassDraw(
  material: BoundNodeMaterial,
  pipeline: SpatialPipeline,
  renderer: Renderer,
  program: PrepassProgram
): PrepassDraw | null {
  const rule = PREPASS_RULES[renderer];
  if (!rule || (material.transparent && !rule.drawsAlphaSurface(pipeline))) return null;
  const isShared = !rule.ownDepthFlags.some((flag) => pipeline.depthFlags.has(flag));
  return builtAtFirstDraw(() =>
    isShared ? defaultDepthMaterial(material, program) : ownDepthMaterial(material, program)
  );
}

function builtAtFirstDraw(build: () => THREE.Material): PrepassDraw {
  let depth: THREE.Material | undefined;
  return {
    get material() {
      depth ??= build();
      return depth;
    },
  };
}

/** Godot's default material in the depth variant: the surface's vertex stage, and back faces culled. */
function defaultDepthMaterial(material: BoundNodeMaterial, program: PrepassProgram): BoundNodeMaterial {
  const depth = depthMaterial(material, program.shader, program.depthStages().position);
  depth.fragmentNode = vec4(0) as unknown as Node;
  depth.side = THREE.FrontSide;
  return depth;
}

/** The surface's depth variant: alpha cut at the threshold (`scene_forward_clustered.glsl:1426`). */
function ownDepthMaterial(material: BoundNodeMaterial, program: PrepassProgram): BoundNodeMaterial {
  const stages = program.depthStages();
  const depth = depthMaterial(material, program.shader, stages.position);
  depth.fragmentNode = stages.fragment();
  depth.side = material.side;
  // Only the depth variant reads it.
  const threshold = program.uniforms.get(THRESHOLD) as UniformNode<number> | undefined;
  if (threshold) threshold.value = DEPTH_PREPASS_OPAQUE_THRESHOLD;
  return depth;
}

/** A material that writes depth and no colour, with `material`'s depth test, gone with it. */
function depthMaterial(
  material: BoundNodeMaterial,
  shader: MaterialShader,
  position: Node
): BoundNodeMaterial {
  const depth = new BoundNodeMaterial(shader);
  depth.vertexNode = position;
  Object.assign(depth, {
    colorWrite: false,
    depthWrite: true,
    depthTest: material.depthTest,
    depthFunc: material.depthFunc,
    forceSinglePass: true,
  });
  depth.onTranslatorFault = (fault) => material.reportFault(fault);
  material.addEventListener('dispose', () => depth.dispose());
  return depth;
}
