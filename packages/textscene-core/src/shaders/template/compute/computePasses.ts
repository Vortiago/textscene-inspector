import { FreshNames } from '../../language/lowering/freshNames.js';
import { lowerFunction } from '../../language/lowering/lower.js';
import {
  assign,
  boolean,
  declaration,
  flow,
  ifStatement,
  not,
  variable,
} from '../../language/lowering/nodes.js';
import { rewriteFunction } from '../../language/lowering/rewrite.js';
import { writtenNames } from '../../language/assignment.js';
import type { CallNode, Expression, FunctionNode, Statement } from '../../language/shaderTree.js';
import { everyStatement, isCall } from '../../language/treeWalk.js';
import type { TemplateStageNode } from '../templateTree.js';

/** The variable a pass's `main` leaves the stored value in, which the emitter takes as its result. */
export const COMPUTE_COLOR = 'compute_color';

/** A render pass of a compute stage: the fragment at a texel of `image` is the invocation storing there. */
export interface ComputePass {
  /** The image the pass draws into, by its name in the template. */
  readonly image: string;
  /** The stage with that `main`, whose `gl_GlobalInvocationID` the pass gives from its texel. */
  readonly stage: TemplateStageNode;
}

/**
 * The render passes of `stage`, a compute stage of a Godot template, in the order they draw.
 * @canonical Lower a compute stage of a Godot template to render passes
 */
export function computePasses(stage: TemplateStageNode): ComputePass[] {
  if (stage.stage !== 'compute') throw new Error(`expected a compute stage, got a ${stage.stage} stage`);
  const main = lowerFunction(mainOf(stage));
  const stores = storesIn(main);
  if (stores.length === 0) throw new Error('expected an imageStore in the compute stage, found none');
  for (const store of stores) refuseUnlessAtInvocation(store, main);
  const images = [...new Set(stores.map(imageOf))];
  return images.map((image) => ({ image, stage: withMain(stage, storingInto(main, image)) }));
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
  const address = store.operands[1]!;
  if (isInvocationTexel(address, main)) return;
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
  const position = main.position;
  const stored = variable(new FreshNames(main).next('stored'), 'bool', position);
  const color = variable(COMPUTE_COLOR, 'vec4', position);
  const rewritten = rewriteFunction(main, (statement) => {
    if (!isStore(statement)) return statement;
    if (imageOf(statement) !== image) return [];
    return [assign(color, statement.operands[2]!), assign(stored, boolean(true, statement.position))];
  });
  const discard = ifStatement(not(stored), [flow('FLOW_OP_DISCARD', [], [], position)], position);
  const body = [
    declaration(stored.name, 'bool', boolean(false, position), position),
    ...rewritten.body.statements,
    discard,
  ];
  return { ...rewritten, body: { ...rewritten.body, statements: body } };
}
