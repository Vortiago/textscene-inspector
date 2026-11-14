/**
 * A user's sky shader drawn as Godot draws a sky background: the shader linked into Godot's sky
 * template (`environment/sky.glsl`), both stages transpiled to TSL, on a triangle that covers the
 * view. The caller writes the template's uniforms from its scene with `writeSkyBindings`.
 */

import * as THREE from 'three';
import { int, screenCoordinate, varyingProperty, vec4, vertexIndex } from 'three/tsl';
import { NodeMaterial, type Node, type TextureNode, type UniformNode } from 'three/webgpu';
import { parse } from '../language/parse.js';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { tokenize } from '../language/tokenizer.js';
import { checkTranspiled } from '../language/transpiledRows.js';
import { emitTemplateStage } from '../template/emitTemplate.js';
import { compileMaterial, linkTemplateStage } from '../template/link.js';
import { MODE_TABLES } from '../template/modeTables.generated.js';
import { TemplateUniforms } from '../template/templateUniforms.js';

const SKY_TEMPLATE = 'environment/sky.glsl';

/** The variant of the sky background, `SKY_VERSION_BACKGROUND` (`sky.cpp:746`): no defines. */
const BACKGROUND_VARIANT = '';

export interface TranspiledSky {
  /** The triangle that draws the sky. It writes no depth, and draws before the scene. */
  readonly mesh: THREE.Mesh;
  /** The template's uniforms of both stages, by `instance.member`: `params.time`. */
  readonly uniforms: ReadonlyMap<string, UniformNode<unknown>>;
  /** The template's textures, by name: `radiance`, `volumetric_fog_texture`. */
  readonly textures: ReadonlyMap<string, TextureNode>;
}

/** The sky of `source`, a shader of `shader_type sky`. `file` names it in the position of an error. */
export function transpileSky(source: string, file = ''): TranspiledSky {
  const tree = parse(tokenize(source, file));
  if (tree.shaderType !== 'sky')
    throw new ShadingLanguageError(
      `expected a shader of 'shader_type sky', found ${tree.shaderType ?? 'none'}`,
      {
        file,
        line: 1,
        column: 1,
      }
    );
  checkTranspiled(tree);
  const material = compileMaterial(tree, MODE_TABLES.sky!);
  const uniforms = new TemplateUniforms();
  const uvInterp = varyingProperty('vec2', 'uv_interp') as unknown as Node;
  const vertex = emitTemplateStage(
    linkTemplateStage(SKY_TEMPLATE, 'vertex', BACKGROUND_VARIANT, material),
    new Map([
      ['gl_VertexIndex', int(vertexIndex) as unknown as Node],
      ['uv_interp', uvInterp],
    ]),
    { name: 'gl_Position', type: 'vec4' },
    uniforms
  );
  const fragment = emitTemplateStage(
    linkTemplateStage(SKY_TEMPLATE, 'fragment', BACKGROUND_VARIANT, material),
    new Map([
      ['uv_interp', uvInterp],
      ['gl_FragCoord', vec4(screenCoordinate, 0, 1) as unknown as Node],
    ]),
    { name: 'frag_color', type: 'vec4' },
    uniforms
  );
  return {
    mesh: skyMesh(vertex.result, fragment.result),
    uniforms: uniforms.byName,
    textures: fragment.textures,
  };
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
