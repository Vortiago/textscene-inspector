import * as THREE from 'three';
import { instanceIndex, int, varyingProperty, vertexIndex } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { BlendMode } from '../../godot/rendering/materials/blendMode.js';
import { godotBlendState } from '../pipeline/blendState.js';
import { parsedShader, shaderSource, type ShaderOptions } from '../language/parseShader.js';
import { emitTemplateStage, programResources } from '../template/emitTemplate.js';
import { linkedProgram, type LinkedProgram, type ProgramTemplate } from '../template/linkedProgram.js';
import type { RowBlock } from '../template/rowBlock.js';
import type { Specialisation } from '../template/specialisation.js';
import type { TemplateUniform } from '../template/templateUniforms.js';
import { TreeMemo } from '../template/treeMemo.js';
import {
  glClipPosition,
  NATIVE_POINT_SIZE,
  vertexAttributes,
  vulkanFragCoord,
} from '../template/vulkanStage.js';
import type { Vec4 } from '../tslTypes.js';
import { BoundNodeMaterial, type MaterialShader } from '../uniforms/boundMaterial.js';
import type { ProjectSampling } from '../uniforms/samplerState.js';
import type { TranspiledUniform } from '../uniforms/transpiledUniform.js';

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

/** The variants that write `gl_PointSize`. */
const POINT_VARIANTS: ReadonlySet<CanvasVariant> = new Set(['primitive_points', 'attributes_points']);

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
}

/** The material of `source`, a shader of `shader_type canvas_item`, preprocessed with `options`. */
export function transpileCanvasItem(source: string, options: CanvasItemOptions = {}): TranspiledCanvasItem {
  const parsed = parsedShader(source, options);
  const file = options.file ?? '';
  const program = linkedProgram(parsed, file, CANVAS, options.sampling);
  const shader = { parameters: [...program.parameters.values()], source: shaderSource(parsed, file) };
  const draws = new Map<CanvasVariant, CanvasDraw>();
  return {
    parameters: program.parameters,
    draw(variant) {
      let draw = draws.get(variant);
      if (!draw) draws.set(variant, (draw = canvasDraw(program, variant, shader)));
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

/** The material of `variant`, with resources of its own and the program's parameters. */
function canvasDraw(program: LinkedProgram, variant: CanvasVariant, shader: MaterialShader): CanvasDraw {
  const resources = programResources();
  const specialisations = resources.uniforms.specialisations;
  const material = new BoundNodeMaterial({ ...shader, specialisations });
  // Godot's canvas pipeline: blend_mix, no cull and no depth (`renderer_canvas_render_rd.cpp:1535, 1559`).
  Object.assign(material, godotBlendState(BlendMode.MIX), {
    transparent: true,
    side: THREE.DoubleSide,
    // three draws a transparent DoubleSide material back faces first, in a second draw; Godot draws once.
    forceSinglePass: true,
    depthTest: false,
    depthWrite: false,
  });
  // Emitted anew at each specialisation: three caches function code by node (`NodeBuilder.js:2759`).
  material.stageWith(() => Object.assign(material, stages({ ...program, resources }, variant)));
  return {
    material,
    uniforms: resources.uniforms.byName,
    specialisations,
    textures: resources.textures,
    buffers: resources.buffers.byName,
  };
}

function stages({ linked, resources, parameterValues }: LinkedProgram, variant: CanvasVariant) {
  const defines = CANVAS_VARIANT_DEFINES[variant];
  const vertexStage = linked('vertex', defines);
  const vulkanClip = varyingProperty('vec4', 'godot_clip_position') as unknown as Vec4;
  const vertex = emitTemplateStage(
    vertexStage,
    new Map([
      ...parameterValues,
      ...vertexAttributes(vertexStage),
      ['gl_VertexIndex', int(vertexIndex) as unknown as Node],
      ['gl_InstanceIndex', int(instanceIndex) as unknown as Node],
    ]),
    // The default `point_size` is 1. A user's `POINT_SIZE` arrives with user canvas shaders.
    { name: 'gl_Position', type: 'vec4', beside: POINT_VARIANTS.has(variant) ? [NATIVE_POINT_SIZE] : [] },
    resources
  );
  const fragment = emitTemplateStage(
    linked('fragment', defines),
    new Map([...parameterValues, ['gl_FragCoord', vulkanFragCoord(vulkanClip)]]),
    { name: 'frag_color', type: 'vec4' },
    resources
  );
  return { vertexNode: glClipPosition(vertex.result, vulkanClip), fragmentNode: fragment.result };
}
