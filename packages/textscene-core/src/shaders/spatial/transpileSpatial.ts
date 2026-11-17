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
import { parsedShader, shaderSource, type ShaderOptions } from '../language/parseShader.js';
import { emitTemplateStage } from '../template/emitTemplate.js';
import { linkedProgram, type ProgramTemplate } from '../template/linkedProgram.js';
import type { RowTexture } from '../template/rowTexture.js';
import { instanceWords } from './instanceData.js';
import type { TemplateStageNode } from '../template/templateTree.js';
import { TreeMemo } from '../template/treeMemo.js';
import { BoundNodeMaterial, type MaterialShader } from '../uniforms/boundMaterial.js';
import type { ProjectSampling } from '../uniforms/samplerState.js';
import type { TranspiledUniform } from '../uniforms/transpiledUniform.js';

/** The colour pass with no pass flags (`scene_shader_forward_clustered.cpp:640-690`): no defines. */
const SCENE: ProgramTemplate = {
  shaderType: 'spatial',
  template: 'forward_clustered/scene_forward_clustered.glsl',
  defines: '',
  memo: new TreeMemo(),
};

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
  const parsed = parsedShader(source, options);
  const { linked, resources, parameters, parameterValues } = linkedProgram(
    parsed,
    options.file ?? '',
    SCENE,
    options.sampling
  );
  const vulkanClip = varyingProperty('vec4', 'godot_clip_position') as unknown as Vec4;
  const vertexStage = linked('vertex');
  const vertex = emitTemplateStage(
    vertexStage,
    new Map([
      ...parameterValues,
      ...vertexAttributes(vertexStage),
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
  const material = sceneMaterial(glClipPosition(vertex.result, vulkanClip), fragment.result, {
    parameters: [...parameters.values()],
    source: shaderSource(parsed, options.file ?? ''),
  });
  resources.buffers.byName.get('instances')?.writeEachDraw(instanceWordsOf);
  return {
    material,
    uniforms: resources.uniforms.byName,
    textures: resources.textures,
    buffers: resources.buffers.byName,
    parameters,
  };
}

/** The instance of a draw's object, as Godot writes one for each draw. */
function instanceWordsOf(object: THREE.Object3D): Uint32Array {
  const name = object.name || object.uuid;
  if ((object as THREE.InstancedMesh).isInstancedMesh)
    throw new Error(
      `expected a Mesh for a transpiled spatial shader, got the InstancedMesh ${name}: Godot's MultiMesh rows are not ported yet`
    );
  if (!(object as THREE.Mesh).isMesh)
    throw new Error(
      `expected a Mesh for a transpiled spatial shader, got the ${object.type} ${name}: Godot's lines and points are not ported yet (#2001)`
    );
  return instanceWords(object.matrixWorld);
}

/** Each `in` global of the vertex stage as the geometry attribute of its name (`withGodotAttributes`). */
function vertexAttributes(stage: TemplateStageNode): [string, Node][] {
  return stage.declarations.flatMap((declaration) =>
    declaration.kind === 'global' && declaration.qualifiers.words.includes('in')
      ? declaration.declarators.map(({ name }): [string, Node] => [
          name,
          attribute(name, declaration.type) as unknown as Node,
        ])
      : []
  );
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

function sceneMaterial(position: Node, colour: Node, shader: MaterialShader): BoundNodeMaterial {
  const material = new BoundNodeMaterial(shader);
  material.vertexNode = position;
  material.fragmentNode = colour;
  // `cull_back`, Godot's default cull mode.
  material.side = THREE.FrontSide;
  return material;
}
