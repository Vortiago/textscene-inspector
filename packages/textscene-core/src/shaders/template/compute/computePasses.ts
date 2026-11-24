import { writtenNames } from '../../language/assignment.js';
import { FreshNames } from '../../language/lowering/freshNames.js';
import { lowerFunction } from '../../language/lowering/lower.js';
import {
  assign,
  block,
  boolean,
  breakUnless,
  declaration,
  flow,
  ifStatement,
  loop,
  not,
  operator,
  variable,
} from '../../language/lowering/nodes.js';
import { rewriteFunction } from '../../language/lowering/rewrite.js';
import type { SourcePosition } from '../../language/shadingLanguageError.js';
import type { BlockNode, CallNode, Expression, FunctionNode, Statement } from '../../language/shaderTree.js';
import { everyStatement, isCall, withExpressionsMapped } from '../../language/treeWalk.js';
import { constantScalar } from '../constantValue.js';
import { constructorRow } from '../glslRows.js';
import type { TemplateDeclaration, TemplateStageNode } from '../templateTree.js';
import { glslCall, scalar } from './computeCalls.js';
import {
  beforeBarrier,
  dependsOnGroup,
  sharedArraysOf,
  sharedTextureGlobals,
  sharedWriteOf,
  withoutBarriers,
  withoutSharedWrites,
  withSharedReads,
  type SharedArray,
} from './sharedArrays.js';

/** The variable a pass's `main` leaves the stored value in, which the emitter takes as its result. */
export const COMPUTE_COLOR = 'compute_color';

/** The entry of a shared array the fragment of its fill pass draws. */
export const COMPUTE_ENTRY = 'compute_entry';

/** What a pass draws into: a texel of an image a fragment, or an entry of a shared array a fragment. */
export type ComputeTarget =
  | { readonly kind: 'image'; readonly name: string }
  | { readonly kind: 'shared'; readonly array: SharedArray };

/** A render pass of a compute stage: the fragment at a texel of its target is the invocation storing it. */
export interface ComputePass {
  readonly target: ComputeTarget;
  /** The stage with that `main`. The pass gives `gl_GlobalInvocationID` from its texel. */
  readonly stage: TemplateStageNode;
  /** The stage's `local_size_x`, `_y` and `_z`, from which the pass gives the other ids. */
  readonly groupSize: readonly [number, number, number];
}

/**
 * The render passes of `stage`, a compute stage of a Godot template, in the order they draw.
 * @canonical Lower a compute stage of a Godot template to render passes
 */
export function computePasses(stage: TemplateStageNode): ComputePass[] {
  if (stage.stage !== 'compute') throw new Error(`expected a compute stage, got a ${stage.stage} stage`);
  const main = withLevelZeroReads(lowerFunction(mainOf(stage)));
  const groupSize = groupSizeOf(stage);
  const arrays = sharedArraysOf(stage);
  const fills = arrays.map((array): ComputePass => ({
    target: { kind: 'shared', array },
    stage: withMain(stage, fillMain(main, array, arrays, groupSize)),
    groupSize,
  }));
  const used = {
    ...main,
    body: withSharedReads(withoutSharedWrites(withoutBarriers(main.body), arrays), arrays),
  };
  const usedStage = withDeclarations(stage, sharedTextureGlobals(arrays, main.position));
  const stores = storesIn(used);
  if (stores.length === 0) throw new Error('expected an imageStore in the compute stage, found none');
  for (const store of stores) refuseUnlessAtInvocation(store, used);
  const images = [...new Set(stores.map(imageOf))].map((name): ComputePass => ({
    target: { kind: 'image', name },
    stage: withMain(usedStage, storingInto(used, name)),
    groupSize,
  }));
  return [...fills, ...images];
}

function mainOf(stage: TemplateStageNode): FunctionNode {
  const main = stage.declarations.find(
    (declaration): declaration is FunctionNode =>
      declaration.kind === 'function' && declaration.name === 'main'
  );
  if (!main) throw new Error('expected a main function in the compute stage');
  return main;
}

function withMain(stage: TemplateStageNode, main: FunctionNode): TemplateStageNode {
  const declarations = stage.declarations.map((part) =>
    part.kind === 'function' && part.name === 'main' ? main : part
  );
  return { ...stage, declarations };
}

/** `stage` with `globals` declared before its first function. */
function withDeclarations(
  stage: TemplateStageNode,
  globals: readonly TemplateDeclaration[]
): TemplateStageNode {
  if (globals.length === 0) return stage;
  const at = stage.declarations.findIndex((part) => part.kind === 'function');
  const declarations = [...stage.declarations.slice(0, at), ...globals, ...stage.declarations.slice(at)];
  return { ...stage, declarations };
}

/** A compute stage has no derivatives, so `texture` reads level 0 (GLSL 4.60, 8.9). */
function withLevelZeroReads(main: FunctionNode): FunctionNode {
  const body = withExpressionsMapped(main.body, (expression) => {
    if (!isCall(expression) || expression.function !== 'texture' || expression.operands.length !== 2)
      return expression;
    const level = scalar('float', 0, expression.position);
    return glslCall('textureLod', [...expression.operands, level], expression.position);
  });
  return { ...main, body };
}

/** The `local_size_x`, `_y` and `_z` of the stage's `in` layout, 1 where it names none. */
function groupSizeOf(stage: TemplateStageNode): [number, number, number] {
  const entries = stage.declarations.flatMap((part) =>
    part.kind === 'default layout' ? part.qualifiers.layout : []
  );
  const size = (name: string) => {
    const entry = entries.find((candidate) => candidate.name === name);
    const value = entry?.value && constantScalar(entry.value, () => undefined);
    return typeof value === 'number' ? value : 1;
  };
  return [size('local_size_x'), size('local_size_y'), size('local_size_z')];
}

const isStore = (statement: Statement): statement is CallNode =>
  statement.kind === 'operator' && isCall(statement) && statement.function === 'imageStore';

function storesIn(main: FunctionNode): CallNode[] {
  return [...everyStatement(main.body)].filter(isStore);
}

function imageOf(store: CallNode): string {
  const image = store.operands[0]!;
  if (image.kind !== 'variable')
    throw new Error(`expected an image variable to store into, got ${image.kind}`);
  return image.name;
}

/** A pass's fragment is its invocation, so a store must write the texel of `gl_GlobalInvocationID.xy`. */
function refuseUnlessAtInvocation(store: CallNode, main: FunctionNode): void {
  if (isInvocationTexel(store.operands[1]!, main)) return;
  throw new Error(
    `expected an imageStore at ivec2(gl_GlobalInvocationID.xy), at line ${store.position.line}`
  );
}

/** `ivec2(id)`, where `id` is a local set once to `gl_GlobalInvocationID.xy`. */
function isInvocationTexel(address: Expression, main: FunctionNode): boolean {
  if (address.kind !== 'operator' || address.op !== 'OP_CONSTRUCT' || address.operands.length !== 1)
    return false;
  const id = address.operands[0]!;
  if (id.kind !== 'variable' || writtenNames(main.body).has(id.name)) return false;
  return [...everyStatement(main.body)].some(
    (statement) =>
      statement.kind === 'declaration' &&
      statement.declarators.some(({ name, value }) => name === id.name && value && isInvocationXy(value))
  );
}

const isInvocationXy = (value: Expression): boolean =>
  value.kind === 'member' &&
  value.name === 'xy' &&
  value.owner.kind === 'variable' &&
  value.owner.name === 'gl_GlobalInvocationID';

/** `main` with a store into `image` kept in `compute_color`, others gone, and a discard where none ran. */
function storingInto(main: FunctionNode, image: string): FunctionNode {
  return storingWhere(main, (statement, keep) => {
    if (!isStore(statement)) return statement;
    return imageOf(statement) === image ? keep(statement.operands[2]!) : [];
  });
}

/** What a store becomes: `keep` of the value the fragment leaves, or the statement itself. */
type StoreRewrite = (
  statement: Statement,
  keep: (value: Expression) => Statement[]
) => Statement | Statement[];

/** `main` with each store `rewrite` keeps left in `compute_color`, and a discard where none ran. */
function storingWhere(main: FunctionNode, rewrite: StoreRewrite): FunctionNode {
  const position = main.position;
  const stored = variable(new FreshNames(main).next('stored'), 'bool', position);
  const color = variable(COMPUTE_COLOR, 'vec4', position);
  const keep = (value: Expression) => [assign(color, value), assign(stored, boolean(true, position))];
  const rewritten = rewriteFunction(main, (statement) => rewrite(statement, keep));
  const discard = ifStatement(not(stored), [flow('FLOW_OP_DISCARD', [], [], position)], position);
  const statements = [
    declaration(stored.name, 'bool', boolean(false, position), position),
    ...rewritten.body.statements,
    discard,
  ];
  return { ...rewritten, body: { ...rewritten.body, statements } };
}

/** The fill of `array`: an entry's fragment runs one group up to the barrier and keeps its write. */
function fillMain(
  main: FunctionNode,
  array: SharedArray,
  arrays: readonly SharedArray[],
  groupSize: readonly [number, number, number]
): FunctionNode {
  const before = withoutStores({ ...main, body: beforeBarrier(main.body) });
  refuseGroupDependentWrites(before.body, array, arrays);
  const entry = variable(COMPUTE_ENTRY, 'int', main.position);
  const group = { ...before, body: overOneGroup(before.body, groupSize, new FreshNames(before)) };
  return storingWhere(group, (statement, keep) => {
    const write = sharedWriteOf(statement, arrays);
    if (!write) return statement;
    if (write.array !== array) return [];
    const isEntry = operator('OP_EQUAL', [asInt(write.index), entry], statement.position);
    return [ifStatement(isEntry, keep(asTexel(write.value)), statement.position)];
  });
}

/** `main` without its image stores, which the passes of the images draw. */
function withoutStores(main: FunctionNode): FunctionNode {
  return rewriteFunction(main, (statement) => (isStore(statement) ? [] : statement));
}

/** A fill draws one group, so an entry whose value or position differs by group has no one value. */
function refuseGroupDependentWrites(
  body: BlockNode,
  array: SharedArray,
  arrays: readonly SharedArray[]
): void {
  const visit = (inner: BlockNode, context: readonly Expression[]) => {
    for (const statement of inner.statements) {
      const write = sharedWriteOf(statement, arrays);
      if (write?.array === array && dependsOnGroup(body, write, context))
        throw new Error(
          `expected the shared array ${array.name} to fill the same in every group, at line ${statement.position.line}`
        );
      if (statement.kind === 'block') visit(statement, context);
      if (statement.kind === 'control flow')
        for (const nested of statement.blocks) visit(nested, [...context, ...statement.expressions]);
    }
  };
  visit(body, []);
}

/** `body` once for each invocation of a group, in the order of `gl_LocalInvocationIndex`. */
function overOneGroup(
  body: BlockNode,
  [x, y, z]: readonly [number, number, number],
  names: FreshNames
): BlockNode {
  const position = body.position;
  const uint = (value: number) => scalar('uint', value, position);
  const index = variable(names.next('invocation'), 'uint', position);
  const local = constructed(
    'uvec3',
    [
      operator('OP_MOD', [index, uint(x)], position),
      operator('OP_MOD', [operator('OP_DIV', [index, uint(x)], position), uint(y)], position),
      operator('OP_DIV', [index, uint(x * y)], position),
    ],
    position
  );
  const ids: Statement[] = [
    declaration('gl_LocalInvocationIndex', 'uint', index, position),
    declaration('gl_LocalInvocationID', 'uvec3', local, position),
    declaration(
      'gl_GlobalInvocationID',
      'uvec3',
      variable('gl_LocalInvocationID', 'uvec3', position),
      position
    ),
    declaration('gl_WorkGroupID', 'uvec3', constructed('uvec3', [uint(0)], position), position),
  ];
  const step = assign(index, operator('OP_ADD', [index, uint(1)], position));
  const invocations = operator('OP_LESS', [index, uint(x * y * z)], position);
  const each = loop(
    [breakUnless(invocations), block([...ids, ...body.statements], position), step],
    position
  );
  return block([declaration(index.name, 'uint', uint(0), position), each], position);
}

function asInt(index: Expression): Expression {
  return index.type === 'int' ? index : constructed('int', [index], index.position);
}

/** A value of up to four floats as the texel that holds it. */
function asTexel(value: Expression): Expression {
  if (value.type === 'vec4') return value;
  const lanes = { float: 1, vec2: 2, vec3: 3 }[value.type as 'float'];
  const zeros = Array.from({ length: 4 - lanes }, () => scalar('float', 0, value.position));
  return constructed('vec4', [value, ...zeros], value.position);
}

function constructed(type: string, operands: readonly Expression[], position: SourcePosition): Expression {
  const row = constructorRow(
    type,
    operands.map((operand) => operand.type)
  );
  return { kind: 'operator', type, op: 'OP_CONSTRUCT', row, operands, position };
}
