import { GODOT_DEFAULT_VISUAL_LAYERS } from '../../godot/scene/visualLayers.js';
import * as THREE from 'three';
import {
  attribute,
  bool,
  depth,
  float,
  frontFacing,
  instanceIndex,
  int,
  select,
  uniform,
  varyingProperty,
} from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import {
  parsedShader,
  shaderSource,
  type ParsedShader,
  type ShaderOptions,
} from '../language/parseShader.js';
import {
  emitTemplateStage,
  type ProgramResources,
  type StageResult,
  type WrittenBuiltIn,
} from '../template/emitTemplate.js';
import type { TemplateUniform } from '../template/templateUniforms.js';
import { linkedProgram, type LinkedProgram, type ProgramTemplate } from '../template/linkedProgram.js';
import type { RowBlock } from '../template/rowBlock.js';
import { instanceWords } from './instanceData.js';
import { VERTEX_ID_ATTRIBUTE } from '../template/surfaceAttributes.js';
import { SPECIALISED_MEMBERS } from './effectSpecialisations.js';
import { devicePoints, type DevicePoints } from '../template/devicePoints.js';
import { coveredOnOneSample } from '../pipeline/singleSampleCoverage.js';
import {
  applySpatialPipeline,
  castsShadow,
  drawsLines,
  stencilQueueError,
  spatialPipeline,
  drawsAlphaToCoverage,
  type PointDraw,
  type SpatialPipeline,
} from './spatialPipeline.js';
import {
  glClipPosition,
  NATIVE_POINT_SIZE,
  vertexAttributes,
  vulkanFragCoord,
  vulkanPointCoord,
  type ClipStep,
} from '../template/vulkanStage.js';
import { declaresInvariantPosition, setPosition, type EmittedStages } from './emittedStages.js';
import { TreeMemo } from '../template/treeMemo.js';
import type { Stacked, Vec4 } from '../tslTypes.js';
import { VIEWPORT_SIZE } from './spatialBindings.js';
import { setPrepassDraw } from '../pipeline/depthPrepass.js';
import { drawAsLines } from '../pipeline/polygonMode.js';
import { spatialPrepassDraw } from './spatialPrepass.js';
import { dfgTextureNode } from './dfgTexture.js';
import { PACKED_SPECIALISATION_DEFAULTS } from './packedSpecialisation.js';
import { radianceOctmapNode } from './sceneSky.js';
import { readDirectionalShadowAtlas } from './directionalLights.js';
import { rendererOf } from '../preprocessor/renderingMethod.js';
import { BoundNodeMaterial } from '../uniforms/boundMaterial.js';
import { textHash, type CodeKey } from '../uniforms/programKey.js';
import { SamplerBinding } from '../uniforms/samplerUniform.js';
import type { Specialisation } from '../template/specialisation.js';
import type { ProjectSampling } from '../uniforms/samplerState.js';
import type { TranspiledUniform } from '../uniforms/transpiledUniform.js';

/** `SHADER_VERSION_DEPTH_PASS`, which the depth prepass draws (`scene_shader_forward_clustered.cpp:644`). */
const DEPTH_DEFINES = '\n#define MODE_RENDER_DEPTH\n';

/** The colour pass with no pass flags (`scene_shader_forward_clustered.cpp:640-690`): no defines. */
const SCENE: ProgramTemplate = {
  shaderType: 'spatial',
  template: 'forward_clustered/scene_forward_clustered.glsl',
  defines: '',
  memo: new TreeMemo(),
  specialisedMembers: SPECIALISED_MEMBERS,
};

export interface TranspiledSpatial {
  /** The material of a mesh whose geometry holds Godot's attributes (`withGodotAttributes`). */
  readonly material: BoundNodeMaterial;
  /** The template's uniforms of both stages, by `instance.member`: `scene_data_block.data.time`. */
  readonly uniforms: ReadonlyMap<string, TemplateUniform>;
  /** The template's specialisation constants, by name: `pso_sc_packed_0`. */
  readonly specialisations: ReadonlyMap<string, Specialisation>;
  /** The template's textures, by name. */
  readonly textures: ReadonlyMap<string, TextureNode>;
  /** The template's storage buffers, by instance name: `instances`. */
  readonly buffers: ReadonlyMap<string, RowBlock>;
  /** Each uniform of the material by name, which takes `set_shader_parameter`'s value. */
  readonly parameters: ReadonlyMap<string, TranspiledUniform>;
  /** The errors Godot prints for a surface of this material, which still draws. */
  readonly printedErrors: readonly string[];
  /** How a surface of this material draws as points, or null for its own primitive. */
  readonly pointDraw: PointDraw | null;
  /** A surface of this material draws into a light's shadow. */
  readonly castsShadow: boolean;
}

export interface SpatialOptions extends ShaderOptions {
  /** The project's texture filter settings, Godot's defaults when left out. */
  readonly sampling?: ProjectSampling;
  /** The render layers a light's cull mask tests, the first layer when left out. */
  readonly instanceLayers?: (object: THREE.Object3D) => number;
  /** A raw read of the directional atlas takes one filtered sample, not four texels filtered by hand. */
  readonly samplesStoredDepth?: boolean;
}

/** The material of `source`, a shader of `shader_type spatial`, preprocessed with `options`. */
export function transpileSpatial(source: string, options: SpatialOptions = {}): TranspiledSpatial {
  const parsed = parsedShader(source, options);
  const { linked, resources, parameters, parameterValues } = linkedProgram(
    parsed,
    options.file ?? '',
    SCENE,
    { sampling: options.sampling }
  );
  resources.textures.set('dfg', dfgTextureNode());
  resources.textures.set('radiance_octmap', radianceOctmapNode());
  readDirectionalShadowAtlas(resources.textures, options.samplesStoredDepth ?? false);
  const pipeline = spatialPipeline(parsed.tree);
  const emitStages = stageEmitter(linked, resources, parameterValues, pipeline);
  const shader = {
    parameters: [...parameters.values()],
    source: shaderSource(parsed, options.file ?? ''),
    specialisations: resources.uniforms.specialisations,
  };
  const material = new BoundNodeMaterial(shader);
  material.codeKey = codeKeyOf(parsed, options, resources.textures, parameters);
  // Godot's default specialisation before the first emit (`render_forward_clustered.cpp:4968-4987`).
  for (const [name, value] of PACKED_SPECIALISATION_DEFAULTS)
    resources.uniforms.presetSpecialisation(name, value);
  material.stageWith(() => setColourStages(material, emitStages(SCENE.defines), pipeline));
  applySpatialPipeline(material, pipeline);
  const renderer = rendererOf(options.renderingMethod ?? 'forward_plus');
  if (drawsLines(pipeline, renderer)) drawAsLines(material);
  const program = {
    depthStages: () => emitStages(DEPTH_DEFINES),
    shader,
    uniforms: resources.uniforms.byName,
  };
  setPrepassDraw(material, spatialPrepassDraw(material, pipeline, renderer, program));
  const queueError = stencilQueueError(pipeline, options.file ?? '');
  const instanceLayers = options.instanceLayers ?? (() => GODOT_DEFAULT_VISUAL_LAYERS);
  resources.buffers.byName
    .get('instances')
    ?.writeEachDraw((object) => instanceWordsOf(object, instanceLayers(object)));
  return {
    material,
    uniforms: resources.uniforms.byName,
    specialisations: resources.uniforms.specialisations,
    textures: resources.textures,
    buffers: resources.buffers.byName,
    parameters,
    printedErrors: queueError === undefined ? [] : [queueError],
    pointDraw: pipeline.pointDraw,
    castsShadow: castsShadow(pipeline),
  };
}

/** The colour pass's code key: the text, each option that changes the code, and the textures it samples. */
function codeKeyOf(
  { code }: ParsedShader,
  { renderingMethod, glVaryings, sampling, samplesStoredDepth }: SpatialOptions,
  templateTextures: ReadonlyMap<string, TextureNode>,
  parameters: ReadonlyMap<string, TranspiledUniform>
): CodeKey {
  return {
    // No `file`: it names a fault's position only, so two files of one text share a program.
    source: `colour|${textHash(JSON.stringify([code, renderingMethod, glVaryings, sampling, samplesStoredDepth]))}`,
    textures: function* () {
      yield* templateTextures.values();
      for (const parameter of parameters.values())
        if (parameter instanceof SamplerBinding) yield* parameter.textureNodes;
    },
  };
}

function instanceIndexOf(pointDraw: SpatialPipeline['pointDraw']): Node {
  return (pointDraw === 'emulated' ? int(0) : int(instanceIndex)) as unknown as Node;
}

/** Emits a variant's stages anew each call: three caches function code by node (`NodeBuilder.js:2759`). */
function stageEmitter(
  linked: LinkedProgram['linked'],
  resources: ProgramResources,
  parameterValues: LinkedProgram['parameterValues'],
  pipeline: SpatialPipeline
): (defines: string) => EmittedStages {
  return (defines) => {
    const vertexStage = linked('vertex', defines);
    const points = pipeline.pointDraw === 'emulated' ? devicePoints() : null;
    const vertexInputs = new Map([
      ...parameterValues,
      // Each `in` global reads the attribute `withGodotAttributes` writes.
      ...vertexAttributes(vertexStage),
      // Godot's `gl_VertexIndex` counts in the surface, where a merged mesh's index counts across surfaces.
      ['gl_VertexIndex', int(attribute(VERTEX_ID_ATTRIBUTE, 'float')) as unknown as Node],
      ['gl_InstanceIndex', instanceIndexOf(pipeline.pointDraw)],
    ]);
    const vulkanClip = varyingProperty('vec4', 'godot_clip_position') as unknown as Vec4;
    const fragCoord = vulkanFragCoord(vulkanClip);
    const vertex = emitTemplateStage(
      vertexStage,
      vertexInputs,
      {
        name: 'gl_Position',
        type: 'vec4',
        beside: pointSizeWrites(pipeline.pointDraw, points),
      },
      resources
    );
    const fragmentInputs = new Map([
      ...parameterValues,
      ['gl_FragCoord', fragCoord],
      ['gl_FrontFacing', pipeline.pointDraw ? (bool(true) as unknown as Node) : godotFrontFacing()],
      ['gl_PointCoord', points?.coord ?? vulkanPointCoord()],
    ]);
    const fragmentResult: StageResult = {
      name: 'frag_color',
      type: 'vec4',
      beside: pipeline.writesDepth ? [fragDepth(fragCoord)] : [],
    };
    return {
      position: glClipPosition(vertex.result, vulkanClip, {
        step: points && pointExpansion(points, resources),
      }),
      isPositionInvariant: declaresInvariantPosition(vertexStage),
      fragment: () =>
        emitTemplateStage(linked('fragment', defines), fragmentInputs, fragmentResult, resources).result,
    };
  };
}

/** The `gl_PointSize` write of a points surface: native points draw at size 1, emulated ones at the size. */
function pointSizeWrites(pointDraw: PointDraw | null, points: DevicePoints | null): WrittenBuiltIn[] {
  if (!pointDraw) return [];
  return [points?.size ?? NATIVE_POINT_SIZE];
}

/** The instance of a draw's object on the render layers `layers`, as Godot writes one for each draw. */
function instanceWordsOf(object: THREE.Object3D, layers: number): Uint32Array {
  if ((object as THREE.InstancedMesh).isInstancedMesh)
    throw new Error(
      `expected a Mesh for a transpiled spatial shader, got the InstancedMesh ${object.name || object.uuid}: Godot's MultiMesh rows are not ported yet`
    );
  return instanceWords(object.matrixWorld, layers);
}

/** `points` widening each point by the size the template wrote, in Godot's viewport. */
function pointExpansion(points: DevicePoints, resources: ProgramResources): ClipStep {
  const viewportSize = resources.uniforms.uniformOf(VIEWPORT_SIZE, 'vec2');
  return (clip) => points.expand(clip, viewportSize);
}

/** Godot reverses a mirrored cull (`render_forward_clustered.cpp:411`). three turns a mesh's winding. */
function godotFrontFacing(): Node {
  const isMirrored = uniform(0).onObjectUpdate(({ object }) =>
    (object as THREE.Mesh).isMesh === true && object!.matrixWorld.determinantAffine() < 0 ? 1 : 0
  );
  return select(isMirrored.equal(1), frontFacing.not(), frontFacing) as unknown as Node;
}

/** `gl_FragDepth`, which starts at Godot's depth: GL's depth is 1 minus it, as `glClipPosition` turns it. */
function fragDepth(fragCoord: Node): WrittenBuiltIn {
  return {
    name: 'gl_FragDepth',
    type: 'float',
    initial: (fragCoord as unknown as Vec4).z as unknown as Node,
    store: (value) => {
      const glDepth = float(1).sub(value as unknown as ReturnType<typeof float>);
      (depth.assign(glDepth) as unknown as Stacked).toStack();
    },
  };
}

/** The colour alpha to coverage draws, which a target of one sample cuts at alpha 0.5. */
function alphaCovered(colour: Node, pipeline: SpatialPipeline): Node {
  return drawsAlphaToCoverage(pipeline) ? coveredOnOneSample(colour, pipeline.alphaAntialiasing) : colour;
}

/** The colour variant's stages as `material` draws them. */
function setColourStages(
  material: BoundNodeMaterial,
  stages: EmittedStages,
  pipeline: SpatialPipeline
): void {
  setPosition(material, stages);
  material.fragmentNode = alphaCovered(stages.fragment(), pipeline);
}
