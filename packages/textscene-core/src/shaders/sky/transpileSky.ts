import * as THREE from 'three';
import { int, screenCoordinate, varyingProperty, vec4, vertexIndex } from 'three/tsl';
import type { Node, TextureNode, UniformNode } from 'three/webgpu';
import { parsedShader, type ParsedShader, type ShaderOptions } from '../language/parseShader.js';
import { emitTemplateStage } from '../template/emitTemplate.js';
import { linkedProgram, type ProgramTemplate } from '../template/linkedProgram.js';
import { TreeMemo } from '../template/treeMemo.js';
import { BoundNodeMaterial } from '../uniforms/boundMaterial.js';
import type { ProjectSampling } from '../uniforms/samplerState.js';
import type { TranspiledUniform } from '../uniforms/transpiledUniform.js';

/** The sky background, `SKY_VERSION_BACKGROUND` (`sky.cpp:746`): no defines. The memo lives with the page. */
const SKY: ProgramTemplate = {
  shaderType: 'sky',
  template: 'environment/sky.glsl',
  defines: '',
  memo: new TreeMemo(),
};

export interface TranspiledSky {
  /** The triangle that draws the sky. It writes no depth, and draws before the scene. */
  readonly mesh: THREE.Mesh;
  /** The template's uniforms of both stages, by `instance.member`: `params.time`. */
  readonly uniforms: ReadonlyMap<string, UniformNode<unknown>>;
  /** The template's textures, by name: `radiance`, `volumetric_fog_texture`. */
  readonly textures: ReadonlyMap<string, TextureNode>;
  /** Each uniform of the material by name, which takes `set_shader_parameter`'s value. */
  readonly parameters: ReadonlyMap<string, TranspiledUniform>;
}

export interface SkyOptions extends ShaderOptions {
  /** The project's texture filter settings, Godot's defaults when left out. */
  readonly sampling?: ProjectSampling;
}

/** The sky of `source`, a shader of `shader_type sky`, preprocessed with `options`. */
export function transpileSky(source: string, options: SkyOptions = {}): TranspiledSky {
  return transpileParsedSky(parsedShader(source, options), options.file ?? '', options.sampling);
}

/** The sky of a parsed shader from `file`, for a caller that has read its tree already. */
export function transpileParsedSky(
  parsed: ParsedShader,
  file: string,
  sampling?: ProjectSampling
): TranspiledSky {
  const { linked, resources, parameters, parameterValues } = linkedProgram(parsed, file, SKY, sampling);
  const uvInterp = varyingProperty('vec2', 'uv_interp') as unknown as Node;
  const vertex = emitTemplateStage(
    linked('vertex'),
    new Map([
      ...parameterValues,
      ['gl_VertexIndex', int(vertexIndex) as unknown as Node],
      ['uv_interp', uvInterp],
    ]),
    { name: 'gl_Position', type: 'vec4' },
    resources
  );
  const fragment = emitTemplateStage(
    linked('fragment'),
    new Map([
      ...parameterValues,
      ['uv_interp', uvInterp],
      ['gl_FragCoord', vec4(screenCoordinate, 0, 1) as unknown as Node],
    ]),
    { name: 'frag_color', type: 'vec4' },
    resources
  );
  return {
    mesh: skyMesh(withVulkanY(vertex.result), fragment.result, [...parameters.values()]),
    uniforms: resources.uniforms.byName,
    textures: resources.textures,
    parameters,
  };
}

/** Godot's clip space has y down, as Vulkan's does, so the template's `uv_interp.y` of -1 is the top row. */
function withVulkanY(position: Node): Node {
  return (position as unknown as ReturnType<typeof vec4>).mul(vec4(1, -1, 1, 1)) as unknown as Node;
}

/** Three vertices, which the template's vertex stage places from their index alone. */
function skyMesh(position: Node, colour: Node, parameters: readonly TranspiledUniform[]): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  const material = new BoundNodeMaterial(parameters);
  material.vertexNode = position;
  material.fragmentNode = colour;
  // Godot's sky pipeline culls no face.
  material.side = THREE.DoubleSide;
  material.depthWrite = false;
  material.depthTest = false;
  const mesh = new THREE.Mesh(geometry, material as unknown as THREE.Material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -Infinity;
  return mesh;
}
