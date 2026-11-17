import * as THREE from 'three';
import { int, screenCoordinate, varyingProperty, vec4, vertexIndex } from 'three/tsl';
import type { Node, TextureNode, UniformNode } from 'three/webgpu';
import { parsedShader, type ParsedShader, type ShaderOptions } from '../language/parseShader.js';
import { emitTemplateStage } from '../template/emitTemplate.js';
import { linkedProgram, type ProgramTemplate } from '../template/linkedProgram.js';
import { TreeMemo } from '../template/treeMemo.js';
import { BoundNodeMaterial } from '../uniforms/boundMaterial.js';
import { SKY_RENDER_ORDER } from './skyRenderOrder.js';
import { GODOT_SAMPLING, type ProjectSampling } from '../uniforms/samplerState.js';
import type { TranspiledUniform } from '../uniforms/transpiledUniform.js';

/** Where a sky draws: behind the scene, or into the radiance octmap a bake filters. */
export type SkyPass = 'background' | 'octmap';

/** `SKY_VERSION_BACKGROUND` and `SKY_VERSION_OCTMAP` (`sky.cpp:719`, `:722`), with memos for the page. */
const PASS_TEMPLATES: Readonly<Record<SkyPass, ProgramTemplate>> = {
  background: skyTemplate(''),
  octmap: skyTemplate('\n#define USE_CUBEMAP_PASS\n'),
};

function skyTemplate(defines: string): ProgramTemplate {
  return { shaderType: 'sky', template: 'environment/sky.glsl', defines, memo: new TreeMemo() };
}

export interface TranspiledSky {
  /** The triangle that draws the sky at the far plane, after every opaque surface, where none drew. */
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
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
  /** The pass the sky draws in, the background when left out. */
  readonly pass?: SkyPass;
}

/** The sky of `source`, a shader of `shader_type sky`, preprocessed with `options`. */
export function transpileSky(source: string, options: SkyOptions = {}): TranspiledSky {
  return transpileParsedSky(
    parsedShader(source, options),
    options.file ?? '',
    options.sampling,
    options.pass
  );
}

/** The sky of a parsed shader from `file` for `pass`, for a caller that has read its tree already. */
export function transpileParsedSky(
  parsed: ParsedShader,
  file: string,
  sampling: ProjectSampling = GODOT_SAMPLING,
  pass: SkyPass = 'background'
): TranspiledSky {
  const { linked, resources, parameters, parameterValues } = linkedProgram(
    parsed,
    file,
    PASS_TEMPLATES[pass],
    defaultSamplers(sampling)
  );
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
    mesh: skyMesh(glClipPosition(vertex.result, pass), fragment.result, [...parameters.values()]),
    uniforms: resources.uniforms.byName,
    textures: resources.textures,
    parameters,
  };
}

/** Godot's default samplers, which a sky reads (`sky.cpp:853`): 4x anisotropy at any project level. */
function defaultSamplers(sampling: ProjectSampling): ProjectSampling {
  return { ...sampling, anisotropicFilteringLevel: GODOT_SAMPLING.anisotropicFilteringLevel };
}

/** Godot's y points down and its far plane is depth 0; an octmap keeps y, as both APIs put y -1 on row 0. */
function glClipPosition(position: Node, pass: SkyPass): Node {
  const godot = position as unknown as ReturnType<typeof vec4>;
  const y = pass === 'octmap' ? godot.y : godot.y.negate();
  return vec4(godot.x, y, godot.w.sub(godot.z.mul(2)), godot.w) as unknown as Node;
}

/** Three vertices, which the template's vertex stage places from their index alone. */
function skyMesh(
  position: Node,
  colour: Node,
  parameters: readonly TranspiledUniform[]
): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  const material = new BoundNodeMaterial(parameters);
  material.vertexNode = position;
  material.fragmentNode = colour;
  // Godot's sky pipeline culls no face.
  material.side = THREE.DoubleSide;
  material.depthWrite = false;
  const mesh = new THREE.Mesh(geometry, material as unknown as THREE.Material);
  mesh.frustumCulled = false;
  mesh.renderOrder = SKY_RENDER_ORDER;
  return mesh;
}
