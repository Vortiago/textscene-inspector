import * as THREE from 'three';
import { vec4 } from 'three/tsl';
import type { Node, UniformNode } from 'three/webgpu';
import { DEPTH_PREPASS_OPAQUE_THRESHOLD } from '../../godot/rendering/opaquePrepass.js';
import { colourDepthOf, type PrepassDraw } from '../pipeline/depthPrepass.js';
import type { Renderer } from '../preprocessor/renderingMethod.js';
import type { TemplateUniform } from '../template/templateUniforms.js';
import { BoundNodeMaterial, type MaterialShader } from '../uniforms/boundMaterial.js';
import { DEPTH_FLAGS, spatialPassMembership, type SpatialPipeline } from './spatialPipeline.js';
import { setPosition, type EmittedStages } from './emittedStages.js';

const THRESHOLD = 'scene_data_block.data.opaque_prepass_threshold';

/** Which surfaces a renderer's depth prepass draws, and which it draws with the default material. */
interface PrepassRule {
  readonly drawsOwnDepth: (pipeline: SpatialPipeline) => boolean;
  readonly drawsAlphaSurface: (pipeline: SpatialPipeline) => boolean;
}

/** Each renderer's rule. Mobile draws no depth prepass. */
const PREPASS_RULES: Readonly<Record<Renderer, PrepassRule | null>> = {
  // `scene_shader_forward_clustered.h:288-298`.
  forward_plus: {
    drawsOwnDepth: (pipeline) => DEPTH_FLAGS.some((flag) => pipeline.depthFlags.has(flag)),
    drawsAlphaSurface: (pipeline) => spatialPassMembership(pipeline).depthInAlphaPass,
  },
  // Its own shader, and no alpha antialiasing surface (`rasterizer_scene_gles3.cpp:242-269, 3124-3143`).
  gl_compatibility: {
    drawsOwnDepth: () => true,
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
  readonly uniforms: ReadonlyMap<string, TemplateUniform>;
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
  const drawsOwnDepth = rule.drawsOwnDepth(pipeline);
  return builtAtFirstDraw(() =>
    drawsOwnDepth ? ownDepthMaterial(material, program) : defaultDepthMaterial(material, program)
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
  const depth = depthMaterial(material, program.shader);
  depth.stageWith(() => setPosition(depth, program.depthStages()));
  depth.fragmentNode = vec4(0) as unknown as Node;
  depth.side = THREE.FrontSide;
  return depth;
}

/** The surface's depth variant: alpha cut at the threshold (`scene_forward_clustered.glsl:1426`). */
function ownDepthMaterial(material: BoundNodeMaterial, program: PrepassProgram): BoundNodeMaterial {
  const depth = depthMaterial(material, program.shader);
  depth.stageWith(() => {
    const stages = program.depthStages();
    setPosition(depth, stages);
    depth.fragmentNode = stages.fragment();
  });
  depth.side = material.side;
  // Only the depth variant reads it.
  const threshold = program.uniforms.get(THRESHOLD) as UniformNode<number> | undefined;
  if (threshold) threshold.value = DEPTH_PREPASS_OPAQUE_THRESHOLD;
  return depth;
}

/** A material that writes depth and no colour, with `material`'s depth test, gone with it. */
function depthMaterial(material: BoundNodeMaterial, shader: MaterialShader): BoundNodeMaterial {
  const depth = new BoundNodeMaterial(shader);
  Object.assign(depth, {
    colorWrite: false,
    depthWrite: true,
    depthTest: material.depthTest,
    // Built at the first draw, which can be in a render nested inside another's prepass.
    depthFunc: colourDepthOf(material).depthFunc,
    forceSinglePass: true,
  });
  depth.onTranslatorFault = (fault) => material.reportFault(fault);
  material.addEventListener('dispose', () => depth.dispose());
  return depth;
}
