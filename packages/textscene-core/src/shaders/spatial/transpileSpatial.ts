import * as THREE from 'three';
import {
  attribute,
  bool,
  depth,
  float,
  Fn,
  frontFacing,
  instanceIndex,
  int,
  pointUV,
  screenCoordinate,
  select,
  uniform,
  varyingProperty,
  vec2,
  vec4,
  vertexIndex,
} from 'three/tsl';
import type { Node, TextureNode, UniformNode } from 'three/webgpu';
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
import { linkedProgram, type LinkedProgram, type ProgramTemplate } from '../template/linkedProgram.js';
import type { RowTexture } from '../template/rowTexture.js';
import { instanceWords } from './instanceData.js';
import { POINT_VERTEX_ATTRIBUTE } from './meshAttributes.js';
import { devicePoints, type DevicePoints } from './devicePoints.js';
import { coveredOnOneSample } from '../pipeline/singleSampleCoverage.js';
import {
  applySpatialPipeline,
  stencilQueueError,
  spatialPipeline,
  drawsAlphaToCoverage,
  type PointDraw,
  type SpatialPipeline,
} from './spatialPipeline.js';
import type { TemplateStageNode } from '../template/templateTree.js';
import { declaresInvariantPosition, setPosition, type EmittedStages } from './emittedStages.js';
import { TreeMemo } from '../template/treeMemo.js';
import type { Stacked, Vec2, Vec4 } from '../tslTypes.js';
import { VIEWPORT_SIZE } from './spatialBindings.js';
import { setPrepassDraw } from '../pipeline/depthPrepass.js';
import { spatialPrepassDraw } from './spatialPrepass.js';
import { rendererOf } from '../preprocessor/renderingMethod.js';
import { BoundNodeMaterial } from '../uniforms/boundMaterial.js';
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
};

export interface TranspiledSpatial {
  /** The material of a mesh whose geometry holds Godot's attributes (`withGodotAttributes`). */
  readonly material: BoundNodeMaterial;
  /** The template's uniforms of both stages, by `instance.member`: `scene_data_block.data.time`. */
  readonly uniforms: ReadonlyMap<string, UniformNode<unknown>>;
  /** The template's specialisation constants, by name: `pso_sc_packed_0`. */
  readonly specialisations: ReadonlyMap<string, Specialisation>;
  /** The template's textures, by name. */
  readonly textures: ReadonlyMap<string, TextureNode>;
  /** The template's storage buffers, by instance name: `instances`. */
  readonly buffers: ReadonlyMap<string, RowTexture>;
  /** Each uniform of the material by name, which takes `set_shader_parameter`'s value. */
  readonly parameters: ReadonlyMap<string, TranspiledUniform>;
  /** The errors Godot prints for a surface of this material, which still draws. */
  readonly printedErrors: readonly string[];
  /** How a surface of this material draws as points, or null for its own primitive. */
  readonly pointDraw: PointDraw | null;
}

export interface SpatialOptions extends ShaderOptions {
  /** The project's texture filter settings, Godot's defaults when left out. */
  readonly sampling?: ProjectSampling;
}

/** The material of `source`, a shader of `shader_type spatial`, preprocessed with `options`. */
export function transpileSpatial(source: string, options: SpatialOptions = {}): TranspiledSpatial {
  return transpileParsedSpatial(parsedShader(source, options), options);
}

/** The material of `parsed`, a parse of a `shader_type spatial` text with `options`. */
export function transpileParsedSpatial(
  parsed: ParsedShader,
  options: SpatialOptions = {}
): TranspiledSpatial {
  const { linked, resources, parameters, parameterValues } = linkedProgram(
    parsed,
    options.file ?? '',
    SCENE,
    options.sampling
  );
  const pipeline = spatialPipeline(parsed.tree);
  const emitStages = stageEmitter(linked, resources, parameterValues, pipeline);
  const shader = {
    parameters: [...parameters.values()],
    source: shaderSource(parsed, options.file ?? ''),
    specialisations: resources.uniforms.specialisations,
  };
  const material = new BoundNodeMaterial(shader);
  material.stageWith(() => setColourStages(material, emitStages(SCENE.defines), pipeline));
  applySpatialPipeline(material, pipeline);
  const renderer = rendererOf(options.renderingMethod ?? 'forward_plus');
  const program = {
    depthStages: () => emitStages(DEPTH_DEFINES),
    shader,
    uniforms: resources.uniforms.byName,
  };
  setPrepassDraw(material, spatialPrepassDraw(material, pipeline, renderer, program));
  const queueError = stencilQueueError(pipeline, options.file ?? '');
  resources.buffers.byName.get('instances')?.writeEachDraw(instanceWordsOf);
  return {
    material,
    uniforms: resources.uniforms.byName,
    specialisations: resources.uniforms.specialisations,
    textures: resources.textures,
    buffers: resources.buffers.byName,
    parameters,
    printedErrors: queueError === undefined ? [] : [queueError],
    pointDraw: pipeline.pointDraw,
  };
}

/** A point drawn as two triangles is an instance: the vertex its index names, of Godot's one instance. */
function vertexIndexOf(pointDraw: SpatialPipeline['pointDraw']): Node {
  if (pointDraw !== 'emulated') return int(vertexIndex) as unknown as Node;
  return int(attribute(POINT_VERTEX_ATTRIBUTE, 'float')) as unknown as Node;
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
      ...vertexAttributes(vertexStage),
      ['gl_VertexIndex', vertexIndexOf(pipeline.pointDraw)],
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
      position: glClipPosition(vertex.result, vulkanClip, points && pointExpansion(points, resources)),
      isPositionInvariant: declaresInvariantPosition(vertexStage),
      fragment: () =>
        emitTemplateStage(linked('fragment', defines), fragmentInputs, fragmentResult, resources).result,
    };
  };
}

/** The `gl_PointSize` write of a points surface: native points draw at size 1, emulated ones at the size. */
function pointSizeWrites(pointDraw: PointDraw | null, points: DevicePoints | null): WrittenBuiltIn[] {
  if (!pointDraw) return [];
  return [points?.size ?? UNUSED_POINT_SIZE];
}

const UNUSED_POINT_SIZE: WrittenBuiltIn = {
  name: 'gl_PointSize',
  type: 'float',
  initial: float(1) as unknown as Node,
  store: () => undefined,
};

/** The instance of a draw's object, as Godot writes one for each draw. */
function instanceWordsOf(object: THREE.Object3D): Uint32Array {
  if ((object as THREE.InstancedMesh).isInstancedMesh)
    throw new Error(
      `expected a Mesh for a transpiled spatial shader, got the InstancedMesh ${object.name || object.uuid}: Godot's MultiMesh rows are not ported yet`
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

/** Moves a clip position, a variable, before it turns to GL's. */
type ClipStep = (clip: Vec4) => void;

/** `points` widening each point by the size the template wrote, in Godot's viewport. */
function pointExpansion(points: DevicePoints, resources: ProgramResources): ClipStep {
  const viewportSize = resources.uniforms.uniformOf(VIEWPORT_SIZE, 'vec2');
  return (clip) => points.expand(clip, viewportSize);
}

/** Vulkan's y down and Godot's reversed depth (`render_scene_data_rd.cpp:83`) as GL's, built once. */
function glClipPosition(position: Node, vulkanClip: Vec4, step: ClipStep | null): Node {
  return Fn(() => {
    const clip = (position as unknown as Vec4).toVar();
    step?.(clip as unknown as Vec4);
    vulkanClip.assign(clip);
    return vec4(clip.x, clip.y.negate(), clip.w.sub(clip.z.mul(2)), clip.w);
  })() as unknown as Node;
}

/** Godot reverses a mirrored cull (`render_forward_clustered.cpp:411`). three turns a mesh's winding. */
function godotFrontFacing(): Node {
  const isMirrored = uniform(0).onObjectUpdate(({ object }) =>
    (object as THREE.Mesh).isMesh === true && object!.matrixWorld.determinantAffine() < 0 ? 1 : 0
  );
  return select(isMirrored.equal(1), frontFacing.not(), frontFacing) as unknown as Node;
}

/** Vulkan's `gl_FragCoord`: three's pixel position, which starts at the top row, Godot's depth and 1 / w. */
function vulkanFragCoord(clip: Vec4): Node {
  return vec4(screenCoordinate, clip.z.div(clip.w), clip.w.reciprocal()) as unknown as Node;
}

/** Vulkan's `gl_PointCoord`, read as GL's: both start at the top row. */
function vulkanPointCoord(): Node {
  const uv = pointUV as unknown as Vec2;
  return vec2(uv.x, float(1).sub(uv.y)) as unknown as Node;
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
