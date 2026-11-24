import {
  attribute,
  Fn,
  instanceIndex,
  int,
  screenCoordinate,
  varyingProperty,
  vec4,
  vertexIndex,
} from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import {
  parsedShader,
  shaderSource,
  type ParsedShader,
  type ShaderOptions,
} from '../language/parseShader.js';
import { emitTemplateStage, type ProgramResources } from '../template/emitTemplate.js';
import { linkedProgram, type LinkedProgram, type ProgramTemplate } from '../template/linkedProgram.js';
import type { RowBlock } from '../template/rowBlock.js';
import type { Specialisation } from '../template/specialisation.js';
import type { TemplateStageNode } from '../template/templateTree.js';
import type { TemplateUniform } from '../template/templateUniforms.js';
import { TreeMemo } from '../template/treeMemo.js';
import type { Vec4 } from '../tslTypes.js';
import { BoundNodeMaterial, type MaterialShader } from '../uniforms/boundMaterial.js';
import type { ProjectSampling } from '../uniforms/samplerState.js';
import type { TranspiledUniform } from '../uniforms/transpiledUniform.js';

/** The variants of `canvas.glsl` with no points that a draw picks (`renderer_canvas_render_rd.cpp:1751`). */
export const CANVAS_VARIANTS = ['quad', 'ninepatch', 'primitive', 'attributes'] as const;

export type CanvasVariant = (typeof CANVAS_VARIANTS)[number];

const VARIANT_DEFINES: Readonly<Record<CanvasVariant, string>> = {
  quad: '',
  ninepatch: '#define USE_NINEPATCH\n',
  primitive: '#define USE_PRIMITIVE\n',
  attributes: '#define USE_ATTRIBUTES\n',
};

/** The template of each variant. Their memos live with the page. */
const VARIANT_TEMPLATES = Object.fromEntries(
  CANVAS_VARIANTS.map((variant) => [variant, canvasTemplate(VARIANT_DEFINES[variant])])
) as Readonly<Record<CanvasVariant, ProgramTemplate>>;

function canvasTemplate(defines: string): ProgramTemplate {
  return { shaderType: 'canvas_item', template: 'canvas.glsl', defines, memo: new TreeMemo() };
}

/** One variant of a canvas item's material, and the template's inputs it reads. */
export interface CanvasDraw {
  readonly material: BoundNodeMaterial;
  /** The template's uniforms of both stages, by `instance.member`: `canvas_data.time`. */
  readonly uniforms: ReadonlyMap<string, TemplateUniform>;
  /** The template's specialisation constants, by name: `pso_sc_packed_0`. */
  readonly specialisations: ReadonlyMap<string, Specialisation>;
  /** The template's textures, by name: `color_texture`, `atlas_texture`. */
  readonly textures: ReadonlyMap<string, TextureNode>;
  /** The template's storage buffers, by instance name: `light_array`, `transforms`. */
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
  return transpileParsedCanvasItem(parsedShader(source, options), options);
}

function transpileParsedCanvasItem(
  parsed: ParsedShader,
  { file = '', sampling }: CanvasItemOptions
): TranspiledCanvasItem {
  const program = (variant: CanvasVariant) =>
    linkedProgram(parsed, file, VARIANT_TEMPLATES[variant], sampling);
  const first = program('quad');
  const { parameters, parameterValues } = first;
  // Each variant reads the first's parameters, so one `set_shader_parameter` reaches all of them.
  const shader = { parameters: [...parameters.values()], source: shaderSource(parsed, file) };
  const draws = new Map<CanvasVariant, CanvasDraw>();
  return {
    parameters,
    draw(variant) {
      let draw = draws.get(variant);
      if (!draw) {
        draw = canvasDraw(variant === 'quad' ? first : program(variant), parameterValues, shader);
        draws.set(variant, draw);
      }
      return draw;
    },
  };
}

/** The bits of `sc_packed_0` a batch sets (`renderer_canvas_render_rd.h:120`, `.cpp:3052`). */
export interface CanvasSpecialisation {
  /** Whether a light or a directional light reaches the batch (`renderer_canvas_render_rd.cpp:2391`). */
  readonly useLighting: boolean;
}

/** Folds `specialisation` into `draw`'s programs, which emit their stages again for a new value. */
export function specialiseCanvasDraw(draw: CanvasDraw, { useLighting }: CanvasSpecialisation): void {
  const packed = draw.specialisations.get('pso_sc_packed_0');
  if (packed) packed.value = useLighting ? 1 : 0;
}

/** The two stages of `linked` emitted with the material's `parameterValues`. */
function canvasDraw(
  { linked, resources }: LinkedProgram,
  parameterValues: LinkedProgram['parameterValues'],
  shader: MaterialShader
): CanvasDraw {
  const specialisations = resources.uniforms.specialisations;
  const material = new BoundNodeMaterial({ ...shader, specialisations });
  material.stageWith(() => setStages(material, linked, parameterValues, resources));
  return {
    material,
    uniforms: resources.uniforms.byName,
    specialisations,
    textures: resources.textures,
    buffers: resources.buffers.byName,
  };
}

/** Emits both stages anew each call: three caches function code by node (`NodeBuilder.js:2759`). */
function setStages(
  material: BoundNodeMaterial,
  linked: LinkedProgram['linked'],
  parameterValues: LinkedProgram['parameterValues'],
  resources: ProgramResources
): void {
  const vertexStage = linked('vertex');
  const vulkanClip = varyingProperty('vec4', 'godot_clip_position') as unknown as Vec4;
  const vertex = emitTemplateStage(
    vertexStage,
    new Map([
      ...parameterValues,
      ...vertexAttributes(vertexStage),
      ['gl_VertexIndex', int(vertexIndex) as unknown as Node],
      ['gl_InstanceIndex', int(instanceIndex) as unknown as Node],
    ]),
    { name: 'gl_Position', type: 'vec4' },
    resources
  );
  const fragment = emitTemplateStage(
    linked('fragment'),
    new Map([...parameterValues, ['gl_FragCoord', vulkanFragCoord(vulkanClip)]]),
    { name: 'frag_color', type: 'vec4' },
    resources
  );
  material.vertexNode = glClipPosition(vertex.result, vulkanClip);
  material.fragmentNode = fragment.result;
}

/** Each `in` global of the vertex stage as the geometry attribute of its name. */
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

/** Vulkan's clip y points down. The canvas draws at depth 0 with no depth test, so z stays. */
function glClipPosition(position: Node, vulkanClip: Vec4): Node {
  return Fn(() => {
    const clip = (position as unknown as Vec4).toVar();
    vulkanClip.assign(clip);
    return vec4(clip.x, clip.y.negate(), clip.z, clip.w);
  })() as unknown as Node;
}

/** Vulkan's `gl_FragCoord`: three's pixel position, which starts at the top row, the depth and 1 / w. */
function vulkanFragCoord(clip: Vec4): Node {
  return vec4(screenCoordinate, clip.z.div(clip.w), clip.w.reciprocal()) as unknown as Node;
}
