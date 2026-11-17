import * as THREE from 'three';
import { cubeTexture, Fn, int, texture, texture3D } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { type BodyEmitter, CalledFunctions } from '../language/emitCall.js';
import { constantNode } from '../language/emitConstant.js';
import { GlslangFolding } from '../language/glslangFolding.js';
import type { EmitContext } from '../language/emitExpression.js';
import { EmitScope } from '../language/emitScope.js';
import { StatementEmitter } from '../language/emitStatement.js';
import { subgroupVariables } from '../language/subgroupComposites.js';
import { emittedGlslTree, type EmittedTree } from '../language/emittedTree.js';
import { copyInto, declareVariables, type StructOf, type Value } from '../language/emitValue.js';
import type { FunctionNode, StructNode } from '../language/shaderTree.js';
import type { ValueType } from '../language/types.js';
import { withGlobalParameters } from './globalParameters.js';
import { withSquareMatrices } from './squareMatrices.js';
import { StageVaryings } from './stageVaryings.js';
import { TemplateBuffers } from './templateBuffers.js';
import { TemplateUniforms } from './templateUniforms.js';
import type { GlobalNode, InterfaceBlockNode, TemplateStageNode } from './templateTree.js';

/** Each `in` global, built-in and material uniform a stage reads, and each varying the next stage reads. */
export type StageInputs = ReadonlyMap<string, Value>;

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

/** The uniforms, the textures, the buffers and the varyings of a program, which its stages share. */
export interface ProgramResources {
  readonly uniforms: TemplateUniforms;
  readonly textures: Map<string, TextureNode>;
  readonly buffers: TemplateBuffers;
  readonly varyings: StageVaryings;
}

export const programResources = (): ProgramResources => ({
  uniforms: new TemplateUniforms(),
  textures: new Map(),
  buffers: new TemplateBuffers(),
  varyings: new StageVaryings(),
});

/** The TSL of `stage`. An input wins over the template's declaration of the same name. */
export function emitTemplateStage(
  stage: TemplateStageNode,
  inputs: StageInputs,
  result: StageResult,
  resources = programResources()
): EmittedStage {
  const structs = new Map<string, StructNode>();
  const structOf: StructOf = (type) => structs.get(type);
  const declared = asDeclared(stage);
  const { textures } = resources;
  const globals = new Map<string, Value>();
  const trees = new Map<string, EmittedTree>();
  const plain: GlobalNode[] = [];
  const written: WrittenArrayVarying[] = [];
  for (const declaration of passedOnce(stage, result).declarations) {
    if (declaration.kind === 'struct') structs.set(declaration.name, declaration);
    else if (declaration.kind === 'function') trees.set(declaration.name, loweredOnce(declaration));
    else if (declaration.kind === 'interface block' && declaration.qualifiers.words.includes('uniform'))
      globals.set(declaration.instanceName!, resources.uniforms.block(declaration, structOf));
    else if (declaration.kind === 'interface block' && declaration.qualifiers.words.includes('buffer')) {
      const name = declaration.instanceName!;
      globals.set(name, resources.buffers.block(declared.buffers.get(name)!, structLookup(declared.structs)));
    } else if (declaration.kind === 'global') {
      uniformGlobals(declaration, globals, textures);
      stageVaryings(stage.stage, declaration, result, resources.varyings, globals, written);
      if (isPlain(stage.stage, declaration)) plain.push(declaration);
    }
  }
  for (const [name, value] of [...subgroupVariables(), ...inputs]) globals.set(name, value);
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
    const arrays = written.map(
      ({ name, type, count }) => [name, declareVariables(type, count, structOf)] as const
    );
    body(main, new Map([[result.name, variable], ...plainVariables(plain, result, structOf), ...arrays]));
    written.forEach(({ varying }, index) => copyInto(varying, arrays[index]![1]));
    return variable;
  });
  return { result: run() as unknown as Node, uniforms: resources.uniforms.byName, textures };
}

/** The structs and buffer blocks as the template declares them, before `withSquareMatrices`. */
interface Declared {
  readonly structs: ReadonlyMap<string, StructNode>;
  readonly buffers: ReadonlyMap<string, InterfaceBlockNode>;
}

/** A buffer reads the declared layout, so its matrices keep the shape the template gives them. */
function asDeclared(stage: TemplateStageNode): Declared {
  const structs = new Map<string, StructNode>();
  const buffers = new Map<string, InterfaceBlockNode>();
  for (const declaration of stage.declarations) {
    if (declaration.kind === 'struct') structs.set(declaration.name, declaration);
    else if (declaration.kind === 'interface block' && declaration.instanceName)
      buffers.set(declaration.instanceName, declaration);
  }
  return { structs, buffers };
}

/** Out of the stage's scope, so a buffer that lives with the material holds only the structs. */
const structLookup =
  (structs: ReadonlyMap<string, StructNode>): StructOf =>
  (type) =>
    structs.get(type);

/** A global the stage holds itself: no storage word, or an `out` of the fragment stage, which none reads. */
function isPlain(stage: TemplateStageNode['stage'], global: GlobalNode): boolean {
  const { words } = global.qualifiers;
  if (stage === 'fragment' && words.includes('out')) return true;
  return !words.some((word) => STORAGE_WORDS.has(word));
}

const STORAGE_WORDS = new Set(['uniform', 'buffer', 'const', 'in', 'out', 'shared']);

/** A variable of `main` for each plain global but the result, holding its folded initialiser. */
function plainVariables(
  globals: readonly GlobalNode[],
  result: StageResult,
  structOf: StructOf
): [string, Value][] {
  return globals.flatMap((global) =>
    global.declarators
      .filter(({ name }) => name !== result.name)
      .map(({ name, arraySize, value }): [string, Value] => {
        const variable = declareVariables(global.type, arraySize ?? 0, structOf);
        if (value) copyInto(variable, constantGlobal(global, { name, value, position: value.position }));
        return [name, variable];
      })
  );
}

/** An array the vertex stage writes into a local array, which main copies into its varyings at its end. */
interface WrittenArrayVarying {
  readonly name: string;
  readonly type: ValueType;
  readonly count: number;
  readonly varying: Value;
}

/** Each `out` and `in` varying but the result. An array `out` is a local array a computed index writes. */
function stageVaryings(
  stage: TemplateStageNode['stage'],
  global: GlobalNode,
  result: StageResult,
  varyings: StageVaryings,
  values: Map<string, Value>,
  written: WrittenArrayVarying[]
): void {
  const { words } = global.qualifiers;
  const passes = stage === 'vertex' ? words.includes('out') : stage === 'fragment' && words.includes('in');
  if (!passes) return;
  const isFlat = words.includes('flat');
  for (const { name, arraySize } of global.declarators) {
    if (name === result.name) continue;
    if (!arraySize) values.set(name, varyings.of(global.type, name, isFlat));
    else if (stage === 'fragment') values.set(name, varyings.ofArray(global.type, name, arraySize, isFlat));
    else
      written.push({
        name,
        type: global.type,
        count: arraySize,
        varying: varyings.ofArray(global.type, name, arraySize, isFlat),
      });
  }
}

/** Filled by `passedOnce`, an entry cleared with its stage, so `loweredOnce` finds the same functions. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const PASSED = new WeakMap<TemplateStageNode, Map<string, TemplateStageNode>>();

function passedOnce(stage: TemplateStageNode, result: StageResult): TemplateStageNode {
  let byResult = PASSED.get(stage);
  if (!byResult) PASSED.set(stage, (byResult = new Map()));
  let passed = byResult.get(result.name);
  if (!passed) byResult.set(result.name, (passed = withGlobalParameters(withSquareMatrices(stage), result)));
  return passed;
}

/** Filled by `loweredOnce`, an entry cleared with its function: a stage lowers once. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const LOWERED = new WeakMap<FunctionNode, EmittedTree>();

function loweredOnce(definition: FunctionNode): EmittedTree {
  let tree = LOWERED.get(definition);
  if (!tree) LOWERED.set(definition, (tree = emittedGlslTree(definition)));
  return tree;
}

/** Three keeps a sampler's state on the texture, so `sampler3D(t, s)` reads `t` alone. */
function uniformGlobals(
  global: GlobalNode,
  values: Map<string, Value>,
  textures: Map<string, TextureNode>
): void {
  const { words } = global.qualifiers;
  for (const declarator of global.declarators) {
    if (words.includes('uniform') && isTextureType(global.type)) {
      values.set(declarator.name, textureValue(global.type, declarator, textures));
    } else if (words.includes('uniform') && global.type === 'sampler') {
      values.set(declarator.name, int(0) as unknown as Node);
    } else if (words.includes('const')) {
      values.set(declarator.name, constantGlobal(global, declarator));
    }
  }
}

/** The value glslang folds a `const` global to, or a refusal that names it. */
function constantGlobal(global: GlobalNode, declarator: GlobalNode['declarators'][number]): Node {
  const lanes = declarator.value && !declarator.arraySize && FOLDING.lanesOf(declarator.value);
  if (!lanes)
    throw new Error(`expected a const global the emitter folds, got ${global.type} ${declarator.name}`);
  return constantNode(global.type as ValueType, lanes);
}

/** Folds the const globals. A tree never changes, so every stage shares one. */
const FOLDING = new GlslangFolding();

/** Every texture type, so a type the emitter has no node for fails by its name. */
const isTextureType = (type: string) => /^[iu]?texture[A-Z0-9]/.test(type);

/** A texture's node, or an array of them by `name[index]`. Three binds only the nodes a stage reads. */
function textureValue(
  type: string,
  declarator: GlobalNode['declarators'][number],
  textures: Map<string, TextureNode>
): Value {
  const named = (name: string) => {
    const node = textures.get(name) ?? textureNode(type, name);
    textures.set(name, node);
    return node;
  };
  if (!declarator.arraySize) return named(declarator.name);
  return {
    kind: 'array',
    count: declarator.arraySize,
    element: (index) => {
      if (typeof index !== 'number')
        throw new Error(
          `expected a constant index of the texture array ${declarator.name}, got a computed one`
        );
      return named(`${declarator.name}[${index}]`);
    },
  };
}

/** The caller binds a texture with the filter and the wrap that Godot's sampler names. */
function textureNode(type: string, name: string): TextureNode {
  if (type === 'texture3D')
    return texture3D(new THREE.Data3DTexture(new Uint8Array(4), 1, 1, 1)) as TextureNode;
  if (type === 'texture2DArray')
    return texture(new THREE.DataArrayTexture(new Uint8Array(4), 1, 1, 1)) as TextureNode;
  if (type === 'textureCube') return cubeTexture(new THREE.CubeTexture()) as unknown as TextureNode;
  if (type === 'texture2D') return texture(new THREE.DataTexture(new Uint8Array(4), 1, 1)) as TextureNode;
  throw new Error(`expected a texture type the emitter has a node for, got ${type} ${name}`);
}
