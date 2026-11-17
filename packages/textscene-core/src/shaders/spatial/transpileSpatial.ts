import * as THREE from 'three';
import {
  attribute,
  Fn,
  frontFacing,
  int,
  screenCoordinate,
  varyingProperty,
  vec4,
  vertexIndex,
} from 'three/tsl';
import type { Node, TextureNode, UniformNode } from 'three/webgpu';
import { GODOT_VERSION } from '../language/instructionTable.generated.js';
import { withGlslTypes } from '../language/glslTypes.js';
import { parsedShader, type ParsedShader, type ShaderOptions } from '../language/parseShader.js';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { checkTranspiled } from '../language/transpiledRows.js';
import { emitTemplateStage, programResources } from '../template/emitTemplate.js';
import { godotId } from '../template/godotIds.js';
import { compileMaterial, linkTemplateStage, type CompiledMaterial } from '../template/link.js';
import { MODE_TABLES } from '../template/modeTables.generated.js';
import type { RowTexture } from '../template/rowTexture.js';
import type { StageName } from '../template/stages.js';
import type { TemplateStageNode } from '../template/templateTree.js';
import { TRANSPILER_VERSION, TreeMemo } from '../template/treeMemo.js';
import { BoundNodeMaterial } from '../uniforms/boundMaterial.js';
import { GODOT_SAMPLING, type ProjectSampling } from '../uniforms/samplerState.js';
import { bindParameters, type TranspiledUniform } from '../uniforms/transpiledUniform.js';
import { AXIS_TANGENT_ATTRIBUTE, VERTEX_ANGLE_ATTRIBUTE } from './meshAttributes.js';

const SCENE_TEMPLATE = 'forward_clustered/scene_forward_clustered.glsl';

/** The colour pass with no pass flags (`scene_shader_forward_clustered.cpp:640-690`): no defines. */
const COLOR_VARIANT = '';

/** The linked scene stages of every spatial shader this page transpiles. It lives as long as the page. */
const linkedStages = new TreeMemo();

export interface TranspiledSpatial {
  /** The material of a mesh whose geometry holds Godot's attributes (`withGodotAttributes`). */
  readonly material: BoundNodeMaterial;
  /** The template's uniforms of both stages, by `instance.member`: `scene_data_block.data.time`. */
  readonly uniforms: ReadonlyMap<string, UniformNode<unknown>>;
  /** The template's textures, by name. */
  readonly textures: ReadonlyMap<string, TextureNode>;
  /** The template's storage buffers, by instance name: `instances`. */
  readonly buffers: ReadonlyMap<string, RowTexture>;
  /** Each uniform of the material by name, which takes `set_shader_parameter`'s value. */
  readonly parameters: ReadonlyMap<string, TranspiledUniform>;
}

export interface SpatialOptions extends ShaderOptions {
  /** The project's texture filter settings, Godot's defaults when left out. */
  readonly sampling?: ProjectSampling;
}

/** The material of `source`, a shader of `shader_type spatial`, preprocessed with `options`. */
export function transpileSpatial(source: string, options: SpatialOptions = {}): TranspiledSpatial {
  return transpileParsedSpatial(parsedShader(source, options), options.file ?? '', options.sampling);
}

/** The material of a parsed shader from `file`, for a caller that has read its tree already. */
export function transpileParsedSpatial(
  { code, tree }: ParsedShader,
  file: string,
  sampling: ProjectSampling = GODOT_SAMPLING
): TranspiledSpatial {
  if (tree.shaderType !== 'spatial')
    throw new ShadingLanguageError(
      `expected a shader of 'shader_type spatial', found ${tree.shaderType ?? 'none'}`,
      tree.headPosition ?? { file, line: 1, column: 1 }
    );
  checkTranspiled(tree);
  let material: CompiledMaterial | undefined;
  const linked = (stage: StageName): TemplateStageNode =>
    linkedStages.tree(
      {
        source: code,
        file,
        shaderType: 'spatial',
        template: SCENE_TEMPLATE,
        stage,
        defines: COLOR_VARIANT,
        godotVersion: GODOT_VERSION,
        transpilerVersion: TRANSPILER_VERSION,
      },
      () => {
        material ??= compileMaterial(withGlslTypes(tree), MODE_TABLES.spatial!);
        return linkTemplateStage(SCENE_TEMPLATE, stage, COLOR_VARIANT, material);
      }
    );
  const resources = programResources();
  const vulkanClip = varyingProperty('vec4', 'godot_clip_position') as unknown as Vec4;
  // A 3D material converts a source colour to linear (`scene_shader_forward_clustered.cpp:595`).
  const parameters = bindParameters(tree, { useLinearColor: true, sampling });
  const parameterValues = [...parameters].map(([name, binding]) => [godotId(name), binding.value] as const);
  const vertex = emitTemplateStage(
    linked('vertex'),
    new Map([
      ...parameterValues,
      ['vertex_angle_attrib', attribute(VERTEX_ANGLE_ATTRIBUTE, 'vec4') as unknown as Node],
      ['axis_tangent_attrib', attribute(AXIS_TANGENT_ATTRIBUTE, 'vec4') as unknown as Node],
      ['gl_VertexIndex', int(vertexIndex) as unknown as Node],
      // One draw for each object, so the first instance of the draw is the object.
      ['gl_InstanceIndex', int(0) as unknown as Node],
    ]),
    { name: 'gl_Position', type: 'vec4' },
    resources
  );
  const fragment = emitTemplateStage(
    linked('fragment'),
    new Map([
      ...parameterValues,
      ['gl_FragCoord', vulkanFragCoord(vulkanClip)],
      ['gl_FrontFacing', frontFacing as unknown as Node],
    ]),
    { name: 'frag_color', type: 'vec4' },
    resources
  );
  return {
    material: sceneMaterial(glClipPosition(vertex.result, vulkanClip), fragment.result, [
      ...parameters.values(),
    ]),
    uniforms: resources.uniforms.byName,
    textures: fragment.textures,
    buffers: resources.buffers.byName,
    parameters,
  };
}

type Vec4 = ReturnType<typeof vec4>;

/** Vulkan's y down and Godot's reversed depth (`render_scene_data_rd.cpp:83`) as GL's, built once. */
function glClipPosition(position: Node, vulkanClip: Vec4): Node {
  return Fn(() => {
    const clip = (position as unknown as Vec4).toVar();
    vulkanClip.assign(clip);
    return vec4(clip.x, clip.y.negate(), clip.w.sub(clip.z.mul(2)), clip.w);
  })() as unknown as Node;
}

/** Vulkan's `gl_FragCoord`: three's pixel position, which starts at the top row, Godot's depth and 1 / w. */
function vulkanFragCoord(clip: Vec4): Node {
  return vec4(screenCoordinate, clip.z.div(clip.w), clip.w.reciprocal()) as unknown as Node;
}

function sceneMaterial(
  position: Node,
  colour: Node,
  parameters: readonly TranspiledUniform[]
): BoundNodeMaterial {
  const material = new BoundNodeMaterial(parameters);
  material.vertexNode = position;
  material.fragmentNode = colour;
  // `cull_back`, Godot's default cull mode.
  material.side = THREE.FrontSide;
  return material;
}
