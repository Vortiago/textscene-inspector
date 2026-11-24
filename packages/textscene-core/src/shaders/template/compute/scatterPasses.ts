import { FreshNames } from '../../language/lowering/freshNames.js';
import {
  assign,
  block,
  declaration,
  ifStatement,
  operator,
  variable,
} from '../../language/lowering/nodes.js';
import { rewriteFunction } from '../../language/lowering/rewrite.js';
import type { SourcePosition } from '../../language/shadingLanguageError.js';
import type {
  BlockNode,
  ControlFlowNode,
  Expression,
  FunctionNode,
  Statement,
} from '../../language/shaderTree.js';
import { constructed, glslCall, imageOf, isStore, scalar } from './computeCalls.js';

/** The variable a scatter pass's `main` leaves the clip position of its point in. */
export const COMPUTE_PLACE = 'compute_place';

/** The varying a scatter pass's `main` leaves the stored value in, which its point draws. */
export const COMPUTE_VALUE = 'compute_value';

/** The size of the atlas a scatter pass draws its images into, in texels. */
export const COMPUTE_ATLAS_SIZE = 'compute_atlas_size';

/** Where image `index` of a scatter pass starts in its atlas, and its size, in texels. */
export const computeOriginName = (index: number) => `compute_origin_${index}`;
export const computeSizeName = (index: number) => `compute_size_${index}`;

/** The most stores one invocation of `main`, as the template writes it, runs on any path. */
export function mostStoresPerInvocation(main: FunctionNode): number {
  return mostStores(main.body);
}

function mostStores(body: BlockNode): number {
  return body.statements.reduce((sum, statement) => sum + mostStoresOf(statement), 0);
}

function mostStoresOf(statement: Statement): number {
  if (isStore(statement)) return 1;
  if (statement.kind === 'block') return mostStores(statement);
  if (statement.kind !== 'control flow') return 0;
  switch (statement.flow) {
    case 'FLOW_OP_IF':
      return Math.max(0, ...statement.blocks.map(mostStores));
    case 'FLOW_OP_SWITCH':
      return mostStoresOfSwitch(statement);
    case 'FLOW_OP_FOR':
    case 'FLOW_OP_WHILE':
    case 'FLOW_OP_DO':
      if (statement.blocks.some((inner) => mostStores(inner) > 0))
        throw new Error(
          `expected no imageStore in a loop of a scattering stage, at line ${statement.position.line}`
        );
      return 0;
    default:
      return 0;
  }
}

/** The most stores a switch runs: from each label, its body and those it falls into, up to a `break`. */
function mostStoresOfSwitch(statement: ControlFlowNode): number {
  const labels = statement.blocks[0]!.statements as ControlFlowNode[];
  const runs = labels.map((_, start) => {
    let sum = 0;
    for (const label of labels.slice(start)) {
      const body = label.blocks[0]!;
      sum += mostStores(body);
      if (endsWithBreak(body)) break;
    }
    return sum;
  });
  return Math.max(0, ...runs);
}

const endsWithBreak = (body: BlockNode): boolean =>
  body.statements.some(
    (statement) =>
      (statement.kind === 'control flow' && statement.flow === 'FLOW_OP_BREAK') ||
      (statement.kind === 'block' && endsWithBreak(statement))
  );

/** Lowered `main` keeping its `ordinal`th store: its value, and its clip place in the atlas or off it. */
export function scatterMain(main: FunctionNode, images: readonly string[], ordinal: number): FunctionNode {
  const position = main.position;
  const uint = (value: number) => scalar('uint', value, position);
  const stores = variable(new FreshNames(main).next('stores'), 'uint', position);
  const value = variable(COMPUTE_VALUE, 'vec4', position);
  const place = variable(COMPUTE_PLACE, 'vec4', position);
  const rewritten = rewriteFunction(main, (statement) => {
    if (!isStore(statement)) return statement;
    const [, address, stored] = statement.operands as [Expression, Expression, Expression];
    const at = statement.position;
    const isOrdinal = operator('OP_EQUAL', [stores, uint(ordinal)], at);
    const kept = ifStatement(
      operator('OP_AND', [isOrdinal, isInImage(address, images.indexOf(imageOf(statement)))], at),
      [assign(value, stored), assign(place, atlasPlace(address, images.indexOf(imageOf(statement))))],
      at
    );
    return [kept, assign(stores, operator('OP_ADD', [stores, uint(1)], at))];
  });
  const statements = [
    declaration(stores.name, 'uint', uint(0), position),
    assign(place, OFF_TARGET(position)),
    ...rewritten.body.statements,
  ];
  return { ...rewritten, body: block(statements, position) };
}

/** A point outside the clip volume, which draws nothing. */
const OFF_TARGET = (position: SourcePosition) =>
  constructed(
    'vec4',
    [2, 2, 0, 1].map((lane) => scalar('float', lane, position)),
    position
  );

/** Whether `address` is a texel of image `index`, as an image drops a store outside it. */
function isInImage(address: Expression, index: number): Expression {
  const position = address.position;
  const texel = constructed('vec2', [address], position);
  const zero = constructed('vec2', [scalar('float', 0, position)], position);
  const size = variable(computeSizeName(index), 'vec2', position);
  const above = glslCall('all', [glslCall('greaterThanEqual', [texel, zero], position)], position);
  const below = glslCall('all', [glslCall('lessThan', [texel, size], position)], position);
  return operator('OP_AND', [above, below], position);
}

/** The clip position of the centre of `address` in image `index`, where the atlas holds it. */
function atlasPlace(address: Expression, index: number): Expression {
  const position = address.position;
  const float = (lane: number) => scalar('float', lane, position);
  const texel = constructed('vec2', [address], position);
  const origin = variable(computeOriginName(index), 'vec2', position);
  const atlas = variable(COMPUTE_ATLAS_SIZE, 'vec2', position);
  const centre = operator('OP_ADD', [operator('OP_ADD', [texel, origin], position), float(0.5)], position);
  const clip = operator(
    'OP_SUB',
    [operator('OP_MUL', [operator('OP_DIV', [centre, atlas], position), float(2)], position), float(1)],
    position
  );
  return constructed('vec4', [clip, float(0), float(1)], position);
}
