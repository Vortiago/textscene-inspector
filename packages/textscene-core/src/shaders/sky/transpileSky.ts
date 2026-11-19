import * as THREE from 'three';
import { int, screenCoordinate, screenSize, uniform, varyingProperty, vec4, vertexIndex } from 'three/tsl';
import type { Node, TextureNode, UniformNode } from 'three/webgpu';
import {
  parsedShader,
  shaderSource,
  type ParsedShader,
  type ShaderOptions,
} from '../language/parseShader.js';
import { emitTemplateStage } from '../template/emitTemplate.js';
import { RADIANCE_ENERGY } from '../template/radianceCalls.js';
import { linkedProgram, type LinkedProgram, type ProgramTemplate } from '../template/linkedProgram.js';
import { TreeMemo } from '../template/treeMemo.js';
import { defaultTexture } from '../uniforms/defaultTextures.js';
import { BoundNodeMaterial, type MaterialShader } from '../uniforms/boundMaterial.js';
import { SKY_RENDER_ORDER } from './skyRenderOrder.js';
import { radianceTextureNode } from './radianceTextureNode.js';
import { fogVolumeTextureNode } from './fogVolumeTextureNode.js';
import { GODOT_SAMPLING, type ProjectSampling } from '../uniforms/samplerState.js';
import type { TranspiledUniform } from '../uniforms/transpiledUniform.js';

/** Where a sky draws: behind the scene, or into the radiance octmap a bake filters. */
export type SkyPass = 'background' | 'octmap';

/** The size a pass draws at: the target's, or Godot's half or quarter resolution pass. */
type SkyResolution = 'full' | 'half' | 'quarter';

/** The defines of each sky version Godot builds (`sky.cpp:719-724`). Their memos live with the page. */
const VERSION_TEMPLATES: Readonly<Record<SkyPass, Readonly<Record<SkyResolution, ProgramTemplate>>>> = {
  background: {
    full: skyTemplate(''),
    half: skyTemplate('\n#define USE_HALF_RES_PASS\n'),
    quarter: skyTemplate('\n#define USE_QUARTER_RES_PASS\n'),
  },
  octmap: {
    full: skyTemplate('\n#define USE_CUBEMAP_PASS\n'),
    half: skyTemplate('\n#define USE_CUBEMAP_PASS\n#define USE_HALF_RES_PASS\n'),
    quarter: skyTemplate('\n#define USE_CUBEMAP_PASS\n#define USE_QUARTER_RES_PASS\n'),
  },
};

function skyTemplate(defines: string): ProgramTemplate {
  return { shaderType: 'sky', template: 'environment/sky.glsl', defines, memo: new TreeMemo() };
}

/** One draw of a sky: its triangle and the template's inputs it reads. */
export interface SkyDraw {
  /** The triangle that draws the sky at the far plane, after every opaque surface, where none drew. */
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  /** The template's uniforms of both stages, by `instance.member`: `params.time`. */
  readonly uniforms: ReadonlyMap<string, UniformNode<unknown>>;
  /** The template's textures, by name: `radiance`, `half_res`, `volumetric_fog_texture`. */
  readonly textures: ReadonlyMap<string, TextureNode>;
}

export interface TranspiledSky extends SkyDraw {
  /** Each uniform of the material by name, which takes `set_shader_parameter`'s value in every pass. */
  readonly parameters: ReadonlyMap<string, TranspiledUniform>;
  /** The half resolution pass, for `use_half_res_pass` (`sky.cpp:76`). */
  readonly half?: SkyDraw;
  /** The quarter resolution pass, for `use_quarter_res_pass` (`sky.cpp:77`). */
  readonly quarter?: SkyDraw;
  /** Godot's default for a pass colour with no pass, which this sky owns and `disposeSky` frees. */
  readonly unsetPassTexture: THREE.Texture;
  /** Godot's black `radiance` until the sky has one, and always in the octmap (`sky.cpp:533`). */
  readonly unsetRadianceTexture: THREE.DataArrayTexture;
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
  const program = (resolution: SkyResolution) =>
    linkedProgram(parsed, file, VERSION_TEMPLATES[pass][resolution], defaultSamplers(sampling));
  const full = program('full');
  const { parameters, parameterValues } = full;
  // Each pass reads the full pass's parameters, so one `set_shader_parameter` reaches all three.
  const shader = { parameters: [...parameters.values()], source: shaderSource(parsed, file) };
  const unsetRadianceTexture = defaultTexture('layers', 'black') as THREE.DataArrayTexture;
  const draw = (resolution: SkyResolution, linked = program(resolution)) =>
    skyDraw(linked, parameterValues, shader, unsetRadianceTexture, isFilterInput(pass, resolution));
  const modes = new Set(parsed.tree.renderModes.map((mode) => mode.name));
  const sky: TranspiledSky = {
    ...draw('full', full),
    parameters,
    ...(modes.has('use_half_res_pass') && { half: draw('half') }),
    ...(modes.has('use_quarter_res_pass') && { quarter: draw('quarter') }),
    unsetPassTexture: unsetPassTexture(pass),
    unsetRadianceTexture,
  };
  bindUnsetPassTexture(sky);
  return sky;
}

/** Binds the layer array `radiance` to each pass of a sky behind the scene (`sky.cpp:533`). */
export function bindRadiance(sky: TranspiledSky, radiance: THREE.DataArrayTexture): void {
  for (const draw of skyDraws(sky)) {
    const node = draw.textures.get('radiance');
    if (node) node.value = radiance;
  }
}

/** A pass colour with no target: white behind the scene, black for its own size in the octmap. */
function unsetPassTexture(pass: SkyPass): THREE.Texture {
  return defaultTexture('flat', pass === 'background' ? 'white' : 'black');
}

function bindUnsetPassTexture(sky: TranspiledSky): void {
  for (const draw of skyDraws(sky))
    for (const name of ['half_res', 'quarter_res']) {
      const node = draw.textures.get(name);
      if (node) node.value = sky.unsetPassTexture;
    }
}

/** Whether the pass is the radiance the filter reads by rows: three reads any other target top row first. */
function isFilterInput(pass: SkyPass, resolution: SkyResolution): boolean {
  return pass === 'octmap' && resolution === 'full';
}

/** The two stages of `linked` emitted with the material's `parameterValues`, on one triangle. */
function skyDraw(
  { linked, resources }: LinkedProgram,
  parameterValues: LinkedProgram['parameterValues'],
  shader: MaterialShader,
  radiance: THREE.DataArrayTexture,
  isRowsUp: boolean
): SkyDraw {
  resources.textures.set('radiance', radianceTextureNode(radiance));
  resources.textures.set('volumetric_fog_texture', fogVolumeTextureNode());
  const radianceEnergy = uniform(1);
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
      ['gl_FragCoord', fragCoord(isRowsUp)],
      [RADIANCE_ENERGY, radianceEnergy as unknown as Node],
    ]),
    { name: 'frag_color', type: 'vec4' },
    resources
  );
  return {
    mesh: skyMesh(glClipPosition(vertex.result, isRowsUp), fragment.result, shader),
    uniforms: new Map([...resources.uniforms.byName, [RADIANCE_ENERGY, radianceEnergy]]),
    textures: resources.textures,
  };
}

/** Godot's default samplers, which a sky reads (`sky.cpp:853`): 4x anisotropy at any project level. */
function defaultSamplers(sampling: ProjectSampling): ProjectSampling {
  return { ...sampling, anisotropicFilteringLevel: GODOT_SAMPLING.anisotropicFilteringLevel };
}

/** Godot's clip y points down and its far plane is depth 0. A target three reads top row first flips y. */
function glClipPosition(position: Node, isRowsUp: boolean): Node {
  const godot = position as unknown as ReturnType<typeof vec4>;
  const y = isRowsUp ? godot.y : godot.y.negate();
  return vec4(godot.x, y, godot.w.sub(godot.z.mul(2)), godot.w) as unknown as Node;
}

/** Godot's `gl_FragCoord`, row 0 at the top. three's `screenCoordinate` counts rows top first. */
function fragCoord(isRowsUp: boolean): Node {
  const row = isRowsUp ? screenSize.y.sub(screenCoordinate.y) : screenCoordinate.y;
  return vec4(screenCoordinate.x, row, 0, 1) as unknown as Node;
}

/** Frees the triangle and the material of each pass of `sky`, and its texture for a pass with none. */
export function disposeSky(sky: TranspiledSky): void {
  for (const draw of skyDraws(sky)) disposeSkyDraw(draw);
  sky.unsetPassTexture.dispose();
  sky.unsetRadianceTexture.dispose();
}

/** The full pass of `sky`, then each of its half and quarter passes. */
export function skyDraws(sky: TranspiledSky): SkyDraw[] {
  return [sky, sky.half, sky.quarter].filter((draw) => draw !== undefined);
}

function disposeSkyDraw({ mesh }: SkyDraw): void {
  mesh.geometry.dispose();
  mesh.material.dispose();
}

/** Three vertices, which the template's vertex stage places from their index alone. */
function skyMesh(
  position: Node,
  colour: Node,
  shader: MaterialShader
): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  const material = new BoundNodeMaterial(shader);
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
