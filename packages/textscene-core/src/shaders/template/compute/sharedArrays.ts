import { variable } from '../../language/lowering/nodes.js';
import { swizzled } from '../../language/swizzle.js';
import { writtenTargets } from '../../language/assignment.js';
import type { SourcePosition } from '../../language/shadingLanguageError.js';
import type { BlockNode, Expression, Statement } from '../../language/shaderTree.js';
import {
  everyExpression,
  isCall,
  statementBlocks,
  statementExpressions,
  withSubExpressions,
} from '../../language/treeWalk.js';
import type { GlobalNode, TemplateStageNode } from '../templateTree.js';
import { BARRIER_CALLS, constructed, glslCall, scalar } from './computeCalls.js';

/** A `shared` array of a compute stage, which a pass of its own fills as a texture one texel an entry. */
export interface SharedArray {
  readonly name: string;
  readonly elementType: string;
  readonly length: number;
}

/** The texture a pass after the fill reads a shared array from. */
const sharedTextureName = (name: string) => `compute_shared_${name}`;

/** The lanes of a texel an element type of up to four floats takes. */
const FLOAT_LANES: ReadonlyMap<string, string> = new Map([
  ['float', 'x'],
  ['vec2', 'xy'],
  ['vec3', 'xyz'],
  ['vec4', 'xyzw'],
]);

/** Each `shared` array of `stage`, or a refusal for one a texel cannot hold. */
export function sharedArraysOf(stage: TemplateStageNode): SharedArray[] {
  return stage.declarations.flatMap((part) => {
    if (part.kind !== 'global' || !part.qualifiers.words.includes('shared')) return [];
    return part.declarators.map(({ name, arraySize }) => {
      if (!arraySize)
        throw new Error(`expected an array for the shared variable ${name}, found one ${part.type}`);
      if (!FLOAT_LANES.has(part.type))
        throw new Error(`expected a shared array of float vectors, found ${part.type} ${name}[${arraySize}]`);
      return { name, elementType: part.type, length: arraySize };
    });
  });
}

/** The sampler globals a stage reads its shared arrays from after their fill. */
export function sharedTextureGlobals(arrays: readonly SharedArray[], position: SourcePosition): GlobalNode[] {
  return arrays.map(({ name }) => ({
    kind: 'global',
    qualifiers: { layout: [], words: ['uniform'] },
    type: 'sampler2D',
    declarators: [{ name: sharedTextureName(name), position }],
    position,
  }));
}

/** The shared array `array`, a variable, names, or nothing. */
function sharedArrayOf(array: Expression & { kind: 'variable' }, arrays: readonly SharedArray[]) {
  return arrays.find(({ name }) => name === array.name);
}

/** The shared array an assignment statement writes an element of, or nothing. */
export function sharedWriteOf(statement: Statement, arrays: readonly SharedArray[]): SharedWrite | undefined {
  if (statement.kind !== 'operator' || statement.op !== 'OP_ASSIGN') return undefined;
  const [target, value] = statement.operands as [Expression, Expression];
  if (target.kind !== 'array element' || target.array.kind !== 'variable') return undefined;
  const array = sharedArrayOf(target.array, arrays);
  return array && { array, index: target.index, value };
}

export interface SharedWrite {
  readonly array: SharedArray;
  readonly index: Expression;
  readonly value: Expression;
}

const isBarrier = (statement: Statement) =>
  statement.kind === 'operator' && isCall(statement) && BARRIER_CALLS.has(statement.function);

const containsBarrier = (statement: Statement): boolean =>
  isBarrier(statement) || statementBlocks(statement).some((inner) => inner.statements.some(containsBarrier));

/** `body` without its barriers. */
export function withoutBarriers(body: BlockNode): BlockNode {
  const statements = body.statements
    .filter((statement) => !isBarrier(statement))
    .map(withInnerBlocks(withoutBarriers));
  return { ...body, statements };
}

/** The statements of `body` before its barrier: a statement that holds it keeps its part before it. */
export function beforeBarrier(body: BlockNode): BlockNode {
  const statements: Statement[] = [];
  for (const statement of body.statements) {
    if (isBarrier(statement)) break;
    if (!containsBarrier(statement)) {
      statements.push(statement);
      continue;
    }
    if (statement.kind === 'control flow' && statement.flow !== 'FLOW_OP_IF')
      throw new Error(
        `expected a barrier outside every loop, found one in a loop at line ${statement.position.line}`
      );
    statements.push(
      withInnerBlocks((inner) => (inner.statements.some(containsBarrier) ? beforeBarrier(inner) : inner))(
        statement
      )
    );
    break;
  }
  return { ...body, statements };
}

const withInnerBlocks =
  (map: (inner: BlockNode) => BlockNode) =>
  (statement: Statement): Statement => {
    if (statement.kind === 'block') return map(statement);
    if (statement.kind !== 'control flow') return statement;
    return { ...statement, blocks: statement.blocks.map(map) };
  };

/** `body` with each read of a shared array an element of its texture. */
export function withSharedReads(body: BlockNode, arrays: readonly SharedArray[]): BlockNode {
  const read = (expression: Expression): Expression => {
    const mapped = withSubExpressions(expression, read);
    if (mapped.kind !== 'array element' || mapped.array.kind !== 'variable') return mapped;
    const array = sharedArrayOf(mapped.array, arrays);
    return array ? texelOf(array, mapped.index, mapped.position) : mapped;
  };
  const statement = (part: Statement): Statement => {
    if (part.kind === 'block') return withSharedReads(part, arrays);
    if (part.kind === 'control flow')
      return {
        ...part,
        expressions: part.expressions.map(read),
        blocks: part.blocks.map((inner) => withSharedReads(inner, arrays)),
      };
    if (part.kind === 'declaration')
      return {
        ...part,
        declarators: part.declarators.map((d) => (d.value ? { ...d, value: read(d.value) } : d)),
      };
    if (part.kind === 'slot') return part;
    return read(part);
  };
  return { ...body, statements: body.statements.map(statement) };
}

/** `body` without its writes into shared arrays, which their texture holds already. */
export function withoutSharedWrites(body: BlockNode, arrays: readonly SharedArray[]): BlockNode {
  const statements = body.statements
    .filter((statement) => !sharedWriteOf(statement, arrays))
    .map(withInnerBlocks((inner) => withoutSharedWrites(inner, arrays)));
  return { ...body, statements };
}

function texelOf(array: SharedArray, index: Expression, position: SourcePosition): Expression {
  const texture = variable(sharedTextureName(array.name), 'sampler2D', position);
  const column = index.type === 'int' ? index : constructed('int', [index], position);
  const texel = constructed('ivec2', [column, scalar('int', 0, position)], position);
  const fetched = glslCall('texelFetch', [texture, texel, scalar('int', 0, position)], position);
  const lanes = FLOAT_LANES.get(array.elementType)!;
  if (lanes === 'xyzw') return fetched;
  const member = swizzled(fetched, lanes);
  if (typeof member === 'string') throw new Error(member);
  return member;
}

/** Whether the value or position of `write`, or a branch it stands in, reads an id that differs by group. */
export function dependsOnGroup(body: BlockNode, write: SharedWrite, context: readonly Expression[]): boolean {
  const tainted = groupTainted(body);
  return [write.index, write.value, ...context].some((expression) => readsAny(expression, tainted));
}

function readsAny(expression: Expression, names: ReadonlySet<string>): boolean {
  return [...everyExpression(expression)].some((part) => part.kind === 'variable' && names.has(part.name));
}

/** The ids that differ from one group to the next, and every local a value or a branch of them reaches. */
const GROUP_IDS = ['gl_GlobalInvocationID', 'gl_WorkGroupID'];

function groupTainted(body: BlockNode): Set<string> {
  const tainted = new Set(GROUP_IDS);
  const reads = (expression: Expression) => readsAny(expression, tainted);
  const walk = (inner: BlockNode, isTaintedBranch: boolean): boolean => {
    let changed = false;
    const mark = (name: string) => {
      if (!tainted.has(name)) {
        tainted.add(name);
        changed = true;
      }
    };
    for (const statement of inner.statements) {
      if (statement.kind === 'declaration')
        for (const { name, value } of statement.declarators)
          if (isTaintedBranch || (value && reads(value))) mark(name);
      for (const expression of statementExpressions(statement))
        for (const target of writtenTargets(expression))
          if (isTaintedBranch || reads(expression)) mark(rootOf(target));
      const isBranchTainted =
        isTaintedBranch || (statement.kind === 'control flow' && statement.expressions.some(reads));
      for (const nested of statementBlocks(statement)) changed = walk(nested, isBranchTainted) || changed;
    }
    return changed;
  };
  while (walk(body, false));
  return tainted;
}

function rootOf(target: Expression): string {
  if (target.kind === 'variable') return target.name;
  if (target.kind === 'member' || target.kind === 'field') return rootOf(target.owner);
  if (target.kind === 'array element') return rootOf(target.array);
  throw new Error(`expected a place to write, got ${target.kind}`);
}
