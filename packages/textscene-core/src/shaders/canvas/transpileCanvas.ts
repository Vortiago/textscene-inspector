import * as THREE from 'three';
import { attribute, instanceIndex, int, screenSize, varyingProperty, vertexIndex } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import type { MaterialBlendState } from '../pipeline/blendState.js';
import { parsedShader, shaderSource, type ShaderOptions } from '../language/parseShader.js';
import { variablesRead } from '../language/treeWalk.js';
import { devicePoints, type DevicePoints } from '../template/devicePoints.js';
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
import type { ProjectSampling } from '../uniforms/samplerState.js';
import type { TranspiledUniform } from '../uniforms/transpiledUniform.js';
import { canvasBlendState } from './canvasBlend.js';

/** Godot's default canvas shader, a version with empty slots (`renderer_canvas_render_rd.cpp:1762`). */
export const DEFAULT_CANVAS_SHADER = 'shader_type canvas_item;\n';

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
}

/** The attribute of a points geometry that holds each point's vertex index, which `gl_VertexIndex` reads. */
export const POINT_VERTEX_ID_ATTRIBUTE = 'vertex_id_attrib';

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
    shader: { parameters: [...program.parameters.values()], source: shaderSource(parsed, file) },
    blend: canvasBlendState(parsed.tree),
    usesPointSize: variablesRead(parsed.tree, (variable) => variable.builtIn !== undefined).has('POINT_SIZE'),
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
  readonly shader: MaterialShader;
  readonly blend: MaterialBlendState;
  /** Whether the shader reads `POINT_SIZE` (`renderer_canvas_render_rd.cpp:1826`). */
  readonly usesPointSize: boolean;
}

/** The variant a draw links, and the rows of the target it draws to. */
interface DrawTarget {
  readonly variant: CanvasVariant;
  readonly rows: TargetRows;
}

/** A variant, and the device points that draw its points at the shader's size, or null for three's. */
interface VariantPoints {
  readonly variant: CanvasVariant;
  readonly points: DevicePoints | null;
}

/** The material of `variant`, with resources of its own and the program's parameters. */
function canvasDraw({ program, shader, blend, usesPointSize }: ItemProgram, target: DrawTarget): CanvasDraw {
  const emulatesPoints = usesPointSize && writesPointSize(target.variant);
  const resources = programResources();
  const specialisations = resources.uniforms.specialisations;
  const material = new BoundNodeMaterial({ ...shader, specialisations });
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
    Object.assign(material, stages({ ...program, resources }, target, emulatesPoints ? devicePoints() : null))
  );
  return {
    material,
    emulatesPoints,
    uniforms: resources.uniforms.byName,
    specialisations,
    textures: resources.textures,
    buffers: resources.buffers.byName,
  };
}

function stages(
  { linked, resources, parameterValues }: LinkedProgram,
  { variant, rows }: DrawTarget,
  points: DevicePoints | null
) {
  const defines = CANVAS_VARIANT_DEFINES[variant];
  const vertexStage = linked('vertex', defines);
  const vulkanClip = varyingProperty('vec4', 'godot_clip_position') as unknown as Vec4;
  const vertex = emitTemplateStage(
    vertexStage,
    new Map([...parameterValues, ...vertexAttributes(vertexStage), ...drawIndices({ variant, points })]),
    { name: 'gl_Position', type: 'vec4', beside: pointSizeWrites({ variant, points }) },
    resources
  );
  const fragment = emitTemplateStage(
    linked('fragment', defines),
    new Map([
      ...parameterValues,
      ['gl_FragCoord', vulkanFragCoord(vulkanClip, rows)],
      ['gl_PointCoord', points?.coord ?? vulkanPointCoord()],
    ]),
    { name: 'frag_color', type: 'vec4' },
    resources
  );
  const step = points ? (clip: Vec4) => points.expand(clip, screenSize as unknown as Node) : undefined;
  return {
    vertexNode: glClipPosition(vertex.result, vulkanClip, { rows, step }),
    fragmentNode: fragment.result,
  };
}

/** The template's `gl_PointSize` write: the shader's size where points are emulated, else three's 1. */
function pointSizeWrites({ variant, points }: VariantPoints): WrittenBuiltIn[] {
  if (points) return [points.size];
  return writesPointSize(variant) ? [NATIVE_POINT_SIZE] : [];
}

/** `gl_VertexIndex` and `gl_InstanceIndex` as Godot counts them, for an emulated point too. */
function drawIndices({ variant, points }: VariantPoints): [string, Node][] {
  if (points && variant === 'primitive_points')
    return [
      ['gl_VertexIndex', int(0) as unknown as Node],
      ['gl_InstanceIndex', int(instanceIndex) as unknown as Node],
    ];
  if (points)
    return [
      ['gl_VertexIndex', int(attribute(POINT_VERTEX_ID_ATTRIBUTE, 'float')) as unknown as Node],
      ['gl_InstanceIndex', int(0) as unknown as Node],
    ];
  return [
    ['gl_VertexIndex', int(vertexIndex) as unknown as Node],
    ['gl_InstanceIndex', int(instanceIndex) as unknown as Node],
  ];
}
