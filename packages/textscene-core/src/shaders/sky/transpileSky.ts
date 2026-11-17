import * as THREE from 'three';
import { int, screenCoordinate, varyingProperty, vec4, vertexIndex } from 'three/tsl';
import { NodeMaterial, type Node, type TextureNode, type UniformNode } from 'three/webgpu';
import { parsedShader, type ParsedShader, type ShaderOptions } from '../language/parseShader.js';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { checkTranspiled } from '../language/transpiledRows.js';
import { emitTemplateStage } from '../template/emitTemplate.js';
import { compileMaterial, linkTemplateStage, type CompiledMaterial } from '../template/link.js';
import { GODOT_VERSION } from '../language/instructionTable.generated.js';
import { MODE_TABLES } from '../template/modeTables.generated.js';
import type { StageName } from '../template/stages.js';
import type { TemplateStageNode } from '../template/templateTree.js';
import { TemplateUniforms } from '../template/templateUniforms.js';
import { godotId } from '../template/godotIds.js';
import { GODOT_SAMPLING, type ProjectSampling } from '../uniforms/samplerState.js';
import { bindParameters, type TranspiledUniform } from '../uniforms/transpiledUniform.js';
import { TRANSPILER_VERSION, TreeMemo } from '../template/treeMemo.js';

const SKY_TEMPLATE = 'environment/sky.glsl';

/** The variant of the sky background, `SKY_VERSION_BACKGROUND` (`sky.cpp:746`): no defines. */
const BACKGROUND_VARIANT = '';

/** The linked sky stages of every sky this page transpiles. It lives as long as the page. */
const linkedStages = new TreeMemo();

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
  { code, tree }: ParsedShader,
  file: string,
  sampling: ProjectSampling = GODOT_SAMPLING
): TranspiledSky {
  if (tree.shaderType !== 'sky')
    throw new ShadingLanguageError(
      `expected a shader of 'shader_type sky', found ${tree.shaderType ?? 'none'}`,
      tree.headPosition ?? { file, line: 1, column: 1 }
    );
  checkTranspiled(tree);
  let material: CompiledMaterial | undefined;
  const linked = (stage: StageName): TemplateStageNode =>
    linkedStages.tree(
      {
        source: code,
        file,
        shaderType: 'sky',
        template: SKY_TEMPLATE,
        stage,
        defines: BACKGROUND_VARIANT,
        godotVersion: GODOT_VERSION,
        transpilerVersion: TRANSPILER_VERSION,
      },
      () => {
        material ??= compileMaterial(tree, MODE_TABLES.sky!);
        return linkTemplateStage(SKY_TEMPLATE, stage, BACKGROUND_VARIANT, material);
      }
    );
  const uniforms = new TemplateUniforms();
  // A sky converts a source colour to linear (`sky.cpp:193`).
  const parameters = bindParameters(tree, { useLinearColor: true, sampling });
  const parameterValues = [...parameters].map(([name, binding]) => [godotId(name), binding.value] as const);
  const uvInterp = varyingProperty('vec2', 'uv_interp') as unknown as Node;
  const vertex = emitTemplateStage(
    linked('vertex'),
    new Map([
      ...parameterValues,
      ['gl_VertexIndex', int(vertexIndex) as unknown as Node],
      ['uv_interp', uvInterp],
    ]),
    { name: 'gl_Position', type: 'vec4' },
    uniforms
  );
  const fragment = emitTemplateStage(
    linked('fragment'),
    new Map([
      ...parameterValues,
      ['uv_interp', uvInterp],
      ['gl_FragCoord', vec4(screenCoordinate, 0, 1) as unknown as Node],
    ]),
    { name: 'frag_color', type: 'vec4' },
    uniforms
  );
  return {
    mesh: drawnWhileBound(skyMesh(vertex.result, fragment.result), [...parameters.values()]),
    uniforms: uniforms.byName,
    textures: fragment.textures,
    parameters,
  };
}

/** A mesh three draws only while the caller shows it and every uniform of the material can draw. */
function drawnWhileBound(mesh: THREE.Mesh, parameters: readonly TranspiledUniform[]): THREE.Mesh {
  let isShown = mesh.visible;
  Object.defineProperty(mesh, 'visible', {
    get: () => isShown && parameters.every((parameter) => parameter.isDrawable),
    set: (shown: boolean) => {
      isShown = shown;
    },
  });
  return mesh;
}

/** Three vertices, which the template's vertex stage places from their index alone. */
function skyMesh(position: Node, colour: Node): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  const material = new NodeMaterial();
  material.vertexNode = position;
  material.fragmentNode = colour;
  // Godot's sky pipeline culls no face, and its triangle winds the other way in GL's y-up clip space.
  material.side = THREE.DoubleSide;
  material.depthWrite = false;
  material.depthTest = false;
  const mesh = new THREE.Mesh(geometry, material as unknown as THREE.Material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -Infinity;
  return mesh;
}
