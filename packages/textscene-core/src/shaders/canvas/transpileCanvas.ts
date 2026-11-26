import * as THREE from 'three';
import {
  attribute,
  instanceIndex,
  int,
  screenSize,
  uniform,
  varyingProperty,
  vec4,
  vertexIndex,
} from 'three/tsl';
import type { Node, TextureNode, UniformNode } from 'three/webgpu';
import type { MaterialBlendState } from '../pipeline/blendState.js';
import {
  parsedShader,
  shaderSource,
  type ParsedShader,
  type ShaderOptions,
} from '../language/parseShader.js';
import type { ShaderNode } from '../language/shaderTree.js';
import { builtInsNamed } from '../language/treeWalk.js';
import { CANVAS_CUSTOM_ARRAYS } from '../../godot/rendering/meshArrayFormat.js';
import { INSTANCE_ID_ATTRIBUTE, VERTEX_ID_ATTRIBUTE } from '../template/surfaceAttributes.js';
import { devicePoints, sizesPoints, type DevicePoints } from '../template/devicePoints.js';
import { emitTemplateStage, programResources, type WrittenBuiltIn } from '../template/emitTemplate.js';
import { linkedProgram, type LinkedProgram, type ProgramTemplate } from '../template/linkedProgram.js';
import type { RowBlock } from '../template/rowBlock.js';
import type { Specialisation } from '../template/specialisation.js';
import type { TemplateUniform } from '../template/templateUniforms.js';
import { TreeMemo } from '../template/treeMemo.js';
import {
  glClipPosition,
  NATIVE_POINT_SIZE,
  type TargetRows,
  vertexAttributes,
  vulkanFragCoord,
  vulkanPointCoord,
} from '../template/vulkanStage.js';
import type { Vec4 } from '../tslTypes.js';
import { BoundNodeMaterial, type MaterialShader } from '../uniforms/boundMaterial.js';
import { textHash, type CodeKey } from '../uniforms/programKey.js';
import { SamplerBinding } from '../uniforms/samplerUniform.js';
import type { ProjectSampling } from '../uniforms/samplerState.js';
import type { TranspiledUniform } from '../uniforms/transpiledUniform.js';
import { canvasBlendState } from './canvasBlend.js';

/** In Godot's order (`renderer_canvas_render_rd.cpp:1750-1755`). */
export const CANVAS_VARIANTS = [
  'quad',
  'ninepatch',
  'primitive',
  'primitive_points',
  'attributes',
  'attributes_points',
] as const;

export type CanvasVariant = (typeof CANVAS_VARIANTS)[number];

/** Godot's defines of each variant, which the branch rows of `canvas.glsl` read too. */
export const CANVAS_VARIANT_DEFINES: Readonly<Record<CanvasVariant, string>> = {
  quad: '',
  ninepatch: '#define USE_NINEPATCH\n',
  primitive: '#define USE_PRIMITIVE\n',
  primitive_points: '#define USE_PRIMITIVE\n#define USE_POINT_SIZE\n',
  attributes: '#define USE_ATTRIBUTES\n',
  attributes_points: '#define USE_ATTRIBUTES\n#define USE_POINT_SIZE\n',
};

const writesPointSize = (variant: CanvasVariant) =>
  CANVAS_VARIANT_DEFINES[variant].includes('USE_POINT_SIZE');

/** One template for every variant: the defines key each stage in the memo, which lives with the page. */
const CANVAS: ProgramTemplate = {
  shaderType: 'canvas_item',
  template: 'canvas.glsl',
  defines: CANVAS_VARIANT_DEFINES.quad,
  memo: new TreeMemo(),
};

/** One variant of a canvas item's material. */
export interface CanvasDraw {
  readonly material: BoundNodeMaterial;
  /** The template's uniforms of both stages, by `instance.member`: `canvas_data.screen_transform`. */
  readonly uniforms: ReadonlyMap<string, TemplateUniform>;
  /** The template's specialisation constants, by name: `pso_sc_packed_0`. */
  readonly specialisations: ReadonlyMap<string, Specialisation>;
  /** The template's textures, by name. */
  readonly textures: ReadonlyMap<string, TextureNode>;
  /** The template's storage buffers, by instance name. */
  readonly buffers: ReadonlyMap<string, RowBlock>;
  /** Whether each point draws as two triangles, at the shader's `POINT_SIZE`: three's points are 1 px. */
  readonly emulatesPoints: boolean;
  /** The custom arrays the shader reads, which `CUSTOMn_USED` binds (`canvas.glsl:12-18`). */
  readonly customsRead: readonly number[];
  /** Godot's viewport in the target: its top-left, and viewport pixels per target pixel. */
  readonly viewportInTarget: UniformNode<'vec4', THREE.Vector4>;
}

export interface TranspiledCanvasItem {
  /** Each uniform of the material by name, which takes `set_shader_parameter`'s value in every variant. */
  readonly parameters: ReadonlyMap<string, TranspiledUniform>;
  /** The material of `variant`, built on the first ask and the same one after. */
  draw(variant: CanvasVariant): CanvasDraw;
}

export interface CanvasItemOptions extends ShaderOptions {
  /** The project's texture filter settings, Godot's defaults when left out. */
  readonly sampling?: ProjectSampling;
  /** A render target with `use_hdr_2d`, whose colour uniforms convert to linear. */
  readonly usesLinearColors?: boolean;
  /** How the target holds Godot's rows: `flipped`, three's drawing buffer, when left out. */
  readonly rows?: TargetRows;
}

/** The material of `source`, a shader of `shader_type canvas_item`, preprocessed with `options`. */
export function transpileCanvasItem(source: string, options: CanvasItemOptions = {}): TranspiledCanvasItem {
  const parsed = parsedShader(source, options);
  const file = options.file ?? '';
  // Godot keeps an sRGB and a linear uniform set (`renderer_canvas_render_rd.cpp:1703-1704`).
  const program = linkedProgram(parsed, file, CANVAS, {
    sampling: options.sampling,
    usesLinearColors: options.usesLinearColors ?? false,
  });
  const item: ItemProgram = {
    program,
    codeHash: codeHashOf(parsed, options),
    shader: { parameters: [...program.parameters.values()], source: shaderSource(parsed, file) },
    blend: canvasBlendState(parsed.tree),
    ...builtInUses(parsed.tree),
  };
  const rows = options.rows ?? 'flipped';
  const draws = new Map<CanvasVariant, CanvasDraw>();
  return {
    parameters: program.parameters,
    draw(variant) {
      let draw = draws.get(variant);
      if (!draw) draws.set(variant, (draw = canvasDraw(item, { variant, rows })));
      return draw;
    },
  };
}

/** The bits of `sc_packed_0` a batch sets (`renderer_canvas_render_rd.h:120`, `.cpp:3052`). */
export interface CanvasSpecialisation {
  /** Whether a light or a directional light reaches the batch (`renderer_canvas_render_rd.cpp:2391`). */
  readonly useLighting: boolean;
}

const PACKED_SPECIALISATION = 'pso_sc_packed_0';

/** Bit 0 of `sc_packed_0`, beside `use_msdf` and `use_lcd` (`canvas_uniforms_inc.glsl:94`). */
const USE_LIGHTING_BIT = 1;

/** Folds `specialisation` into `draw`'s programs, which emit their stages again for a new value. */
export function specialiseCanvasDraw(draw: CanvasDraw, { useLighting }: CanvasSpecialisation): void {
  const packed = draw.specialisations.get(PACKED_SPECIALISATION);
  if (!packed)
    throw new Error(
      `expected the specialisation constant ${PACKED_SPECIALISATION} in the canvas template, found none`
    );
  const otherBits = (packed.value as number) & ~USE_LIGHTING_BIT;
  packed.value = useLighting ? otherBits | USE_LIGHTING_BIT : otherBits;
}

/** What every variant of one item's material shares. */
interface ItemProgram {
  readonly program: LinkedProgram;
  /** A hash of the text with each option that changes the code. */
  readonly codeHash: string;
  readonly shader: MaterialShader;
  readonly blend: MaterialBlendState;
  /** Whether the shader reads or writes `POINT_SIZE` (`renderer_canvas_render_rd.cpp:1826`). */
  readonly usesPointSize: boolean;
  readonly customsRead: readonly number[];
}

/** What the built-ins `shader` names ask of its draws, read from the names that make the usage defines. */
function builtInUses(shader: ShaderNode): Pick<ItemProgram, 'usesPointSize' | 'customsRead'> {
  const names = builtInsNamed(shader);
  return {
    usesPointSize: sizesPoints(names),
    // The template declares only the custom arrays whose built-in the shader names (`canvas.glsl:12-18`).
    customsRead: CANVAS_CUSTOM_ARRAYS.filter((custom) => names.has(`CUSTOM${custom}`)),
  };
}

/** The variant a draw links, and the rows of the target it draws to. */
interface DrawTarget {
  readonly variant: CanvasVariant;
  readonly rows: TargetRows;
}

/** A variant, its device points at the shader's size or null for three's, and the POINT_SIZE use. */
interface PointSizeUse {
  readonly variant: CanvasVariant;
  readonly points: DevicePoints | null;
  readonly usesPointSize: boolean;
  readonly viewportInTarget: UniformNode<'vec4', THREE.Vector4>;
}

/** The material of `variant`, with resources of its own and the program's parameters. */
function canvasDraw(
  { program, codeHash, shader, blend, usesPointSize, customsRead }: ItemProgram,
  target: DrawTarget
): CanvasDraw {
  const emulatesPoints = usesPointSize && writesPointSize(target.variant);
  const resources = programResources();
  const viewportInTarget = uniform(new THREE.Vector4(0, 0, 1, 1));
  const specialisations = resources.uniforms.specialisations;
  const material = new BoundNodeMaterial({ ...shader, specialisations });
  material.codeKey = codeKeyOf(
    `${target.variant}|${target.rows}|${emulatesPoints}|${codeHash}`,
    resources.textures,
    program
  );
  // Godot's canvas pipeline: no cull and no depth (`renderer_canvas_render_rd.cpp:1535`).
  Object.assign(material, blend, {
    transparent: true,
    side: THREE.DoubleSide,
    // three draws a transparent DoubleSide material back faces first, in a second draw. Godot draws once.
    forceSinglePass: true,
    depthTest: false,
    depthWrite: false,
  });
  // Emitted anew at each specialisation: three caches function code by node (`NodeBuilder.js:2759`).
  material.stageWith(() =>
    Object.assign(
      material,
      stages({ ...program, resources }, target.rows, {
        variant: target.variant,
        points: emulatesPoints ? devicePoints() : null,
        usesPointSize,
        viewportInTarget,
      })
    )
  );
  return {
    material,
    emulatesPoints,
    customsRead,
    uniforms: resources.uniforms.byName,
    specialisations,
    textures: resources.textures,
    buffers: resources.buffers.byName,
    viewportInTarget,
  };
}

/** No `file`: it names a fault's position only, so two files of one text share a program. */
function codeHashOf(
  { code }: ParsedShader,
  { sampling, usesLinearColors = false }: CanvasItemOptions
): string {
  return textHash(JSON.stringify([code, sampling, usesLinearColors]));
}

/** The code key of one variant's `source`, with the template's textures and the shader's samplers. */
function codeKeyOf(
  source: string,
  templateTextures: ReadonlyMap<string, TextureNode>,
  { parameters }: LinkedProgram
): CodeKey {
  return {
    source: `canvas|${source}`,
    textures: function* () {
      yield* templateTextures.values();
      for (const parameter of parameters.values())
        if (parameter instanceof SamplerBinding) yield* parameter.textureNodes;
    },
  };
}

function stages(
  { linked, resources, parameterValues }: LinkedProgram,
  rows: TargetRows,
  pointSizeUse: PointSizeUse
) {
  const { variant, points, viewportInTarget } = pointSizeUse;
  const viewport = viewportInTarget as unknown as Vec4;
  const defines = CANVAS_VARIANT_DEFINES[variant];
  const vertexStage = linked('vertex', defines);
  const vulkanClip = varyingProperty('vec4', 'godot_clip_position') as unknown as Vec4;
  const vertex = emitTemplateStage(
    vertexStage,
    new Map([...parameterValues, ...vertexAttributes(vertexStage), ...drawIndices(pointSizeUse)]),
    { name: 'gl_Position', type: 'vec4', beside: pointSizeWrites(pointSizeUse) },
    resources
  );
  const fragment = emitTemplateStage(
    linked('fragment', defines),
    new Map([
      ...parameterValues,
      ['gl_FragCoord', viewportFragCoord(vulkanFragCoord(vulkanClip, rows) as unknown as Vec4, viewport)],
      ['gl_PointCoord', points?.coord ?? vulkanPointCoord()],
    ]),
    { name: 'frag_color', type: 'vec4' },
    resources
  );
  // POINT_SIZE counts viewport pixels: the target's size in them turns a size into clip space.
  const viewportPixels = screenSize.mul(viewport.zw) as unknown as Node;
  const step = points ? (clip: Vec4) => points.expand(clip, viewportPixels) : undefined;
  return {
    vertexNode: glClipPosition(vertex.result, vulkanClip, { rows, step }),
    fragmentNode: fragment.result,
  };
}

/** `gl_FragCoord` in the pixels of Godot's viewport, whose render target is the viewport alone. */
function viewportFragCoord(fragCoord: Vec4, viewport: Vec4): Node {
  return vec4(fragCoord.xy.sub(viewport.xy).mul(viewport.zw), fragCoord.zw) as unknown as Node;
}

/** The template's `gl_PointSize` write: the shader's size where points are emulated, else three's 1. */
function pointSizeWrites({ variant, points, usesPointSize }: PointSizeUse): WrittenBuiltIn[] {
  if (points) return [points.size];
  // The shader's usage define writes `gl_PointSize` in a variant of triangles too (`canvas.glsl:300-302`).
  return writesPointSize(variant) || usesPointSize ? [NATIVE_POINT_SIZE] : [];
}

/** `gl_VertexIndex` and `gl_InstanceIndex` as Godot counts them, for an emulated point too. */
function drawIndices({ variant, points }: PointSizeUse): [string, Node][] {
  const indices = (vertex: unknown, instance: unknown): [string, Node][] => [
    ['gl_VertexIndex', vertex as Node],
    ['gl_InstanceIndex', instance as Node],
  ];
  if (!points) return indices(int(vertexIndex), int(instanceIndex));
  // An emulated point is an instance: a primitive's point is its one vertex, a mesh's point its vertex id.
  if (variant === 'primitive_points') return indices(int(0), int(instanceIndex));
  return indices(
    int(attribute(VERTEX_ID_ATTRIBUTE, 'float')),
    int(attribute(INSTANCE_ID_ATTRIBUTE, 'float'))
  );
}
