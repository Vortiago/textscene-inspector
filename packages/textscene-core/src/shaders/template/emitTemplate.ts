/**
 * The emitter of a linked template stage: its `main` as one TSL function, its globals as TSL
 * values. A uniform block is one uniform per member (`TemplateUniforms`), a texture a texture
 * node, an `in` the node the caller gives, and an `out` a variable `main` writes. Each function of
 * the template and of the material is one GLSL function, as the shading language's are.
 */

import * as THREE from 'three';
import { Fn, int, texture, texture3D } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { type BodyEmitter, CalledFunctions } from '../language/emitCall.js';
import { constantNode } from '../language/emitConstant.js';
import type { EmitContext } from '../language/emitExpression.js';
import { EmitScope } from '../language/emitScope.js';
import { StatementEmitter } from '../language/emitStatement.js';
import { emittedGlslTree, type EmittedTree } from '../language/emittedTree.js';
import { declareVariables, type StructOf, type Value } from '../language/emitValue.js';
import type { StructNode } from '../language/shaderTree.js';
import { TemplateUniforms } from './templateUniforms.js';
import type { GlobalNode, TemplateStageNode } from './templateTree.js';

/**
 * What the caller gives a stage: the node of each `in` global and built-in it reads, and of each
 * `out` the next stage reads, a varying, by name.
 */
export type StageInputs = ReadonlyMap<string, Node>;

/** The value `main` leaves in a variable of its own: `frag_color`, or `gl_Position`. */
export interface StageResult {
  readonly name: string;
  readonly type: string;
}

/** A stage as TSL: the value `main` leaves in the result, its uniforms, and its textures. */
export interface EmittedStage {
  readonly result: Node;
  readonly uniforms: TemplateUniforms['byName'];
  readonly textures: ReadonlyMap<string, TextureNode>;
}

/** The TSL of `stage`. The stages of one program share `uniforms`. */
export function emitTemplateStage(
  stage: TemplateStageNode,
  inputs: StageInputs,
  result: StageResult,
  uniforms = new TemplateUniforms()
): EmittedStage {
  const structs = new Map<string, StructNode>();
  const structOf: StructOf = (type) => structs.get(type);
  const textures = new Map<string, TextureNode>();
  const globals = new Map<string, Value>(inputs);
  const trees = new Map<string, EmittedTree>();
  for (const declaration of stage.declarations) {
    if (declaration.kind === 'struct') structs.set(declaration.name, declaration);
    else if (declaration.kind === 'function') trees.set(declaration.name, emittedGlslTree(declaration));
    else if (declaration.kind === 'interface block' && declaration.qualifiers.words.includes('uniform'))
      globals.set(declaration.instanceName!, uniforms.block(declaration, structOf));
    else if (declaration.kind === 'global') uniformGlobals(declaration, globals, textures);
  }
  const body: BodyEmitter = (tree, names) =>
    new StatementEmitter(tree.folding, context).body(
      tree.lowered.body,
      EmitScope.of(new Map([...globals, ...names]))
    );
  const context: EmitContext = { structOf, functions: new CalledFunctions(trees, structOf, body) };
  const main = trees.get('main');
  if (!main) throw new Error('expected a main function in the template stage');
  const run = Fn(() => {
    const variable = declareVariables(result.type, 0, structOf) as Node;
    body(main, new Map([[result.name, variable]]));
    return variable;
  });
  return { result: run() as unknown as Node, uniforms: uniforms.byName, textures };
}

/**
 * Each texture a node and each `const` its value. A sampler stands for nothing, as three keeps
 * a sampler's state on the texture, so `sampler3D(t, s)` reads `t` alone.
 */
function uniformGlobals(
  global: GlobalNode,
  values: Map<string, Value>,
  textures: Map<string, TextureNode>
): void {
  const { words } = global.qualifiers;
  for (const declarator of global.declarators) {
    if (words.includes('uniform') && isTextureType(global.type)) {
      const node = textureNode(global.type);
      textures.set(declarator.name, node);
      values.set(declarator.name, node);
    } else if (words.includes('uniform') && global.type === 'sampler') {
      values.set(declarator.name, int(0) as unknown as Node);
    } else if (words.includes('const') && declarator.value?.kind === 'constant') {
      values.set(declarator.name, constantNode(global.type, declarator.value.values));
    }
  }
}

const isTextureType = (type: string) => /^texture(2D|3D|2DArray|Cube)$/.test(type);

/** A texture node of `type` over an empty texture, which the caller replaces with the one it binds. */
function textureNode(type: string): TextureNode {
  if (type === 'texture3D')
    return texture3D(new THREE.Data3DTexture(new Uint8Array(4), 1, 1, 1)) as TextureNode;
  return texture(new THREE.DataTexture(new Uint8Array(4), 1, 1)) as TextureNode;
}
