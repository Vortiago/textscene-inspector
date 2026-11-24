import type {
  Argument,
  BlockNode,
  CallNode,
  ControlFlowNode,
  Expression,
  FunctionNode,
  Statement,
  StructMember,
} from '../language/shaderTree.js';
import { everyExpressionIn, isCall, withSubExpressions } from '../language/treeWalk.js';
import type { GlobalNode, TemplateDeclaration, TemplateStageNode } from './templateTree.js';

/** The storage words of a global whose value a stage function cannot write, or the next stage gives. */
const READ_ONLY_WORDS = new Set(['uniform', 'buffer', 'const', 'in', 'shared']);

/** A TSL function reads only its parameters, so each writable global it touches is an `inout` one. */
export function withGlobalParameters(
  stage: TemplateStageNode,
  result: StructMember,
  written: readonly StructMember[] = []
): TemplateStageNode {
  const writable = writableGlobals(stage, [result, ...written]);
  const functions = stage.declarations.filter(
    (declaration): declaration is FunctionNode => declaration.kind === 'function'
  );
  const touched = touchedGlobals(functions, writable);
  const parameterNames = new Map([...touched].map(([name, globals]) => [name, [...globals]]));
  const passed = (name: string): readonly string[] =>
    name === 'main' ? [] : (parameterNames.get(name) ?? []);
  const declaration = (part: TemplateDeclaration): TemplateDeclaration => {
    if (part.kind === 'prototype')
      return { ...part, function: withParameters(part.function, passed(part.function.name), writable) };
    if (part.kind !== 'function') return part;
    const body = withPassedGlobals(part, passed, writable);
    const names = passed(part.name);
    if (names.length === 0 && body === part.body) return part;
    return { ...withParameters(part, names, writable), body };
  };
  return { ...stage, declarations: stage.declarations.map(declaration) };
}

/** The results and each global of the stage a function may write: no storage, or `out`. */
function writableGlobals(
  stage: TemplateStageNode,
  results: readonly StructMember[]
): ReadonlyMap<string, StructMember> {
  const globals = new Map<string, StructMember>(results.map((result) => [result.name, result]));
  const isWritable = (global: GlobalNode) =>
    !global.qualifiers.words.some((word) => READ_ONLY_WORDS.has(word));
  for (const declaration of stage.declarations)
    if (declaration.kind === 'global' && isWritable(declaration))
      for (const { name, arraySize } of declaration.declarators)
        globals.set(name, { name, type: declaration.type, ...(arraySize ? { arraySize } : {}) });
  return globals;
}

/** The writable globals of each function, its own and its callees', in the order of `writable`. */
function touchedGlobals(
  functions: readonly FunctionNode[],
  writable: ReadonlyMap<string, StructMember>
): ReadonlyMap<string, ReadonlySet<string>> {
  const own = new Map(functions.map((definition) => [definition.name, globalsReadIn(definition, writable)]));
  const callees = new Map(functions.map((definition) => [definition.name, calleesOf(definition.body)]));
  const touched = new Map<string, Set<string>>();
  const visit = (name: string, seen: Set<string>): Set<string> => {
    const known = touched.get(name);
    if (known) return known;
    const names = new Set(own.get(name) ?? []);
    for (const callee of callees.get(name) ?? [])
      if (!seen.has(callee))
        for (const global of visit(callee, new Set([...seen, callee]))) names.add(global);
    const ordered = new Set([...writable.keys()].filter((global) => names.has(global)));
    touched.set(name, ordered);
    return ordered;
  };
  for (const definition of functions) visit(definition.name, new Set([definition.name]));
  return touched;
}

/** The names of the functions `block` calls, built-ins included. */
function calleesOf(block: BlockNode): Set<string> {
  return new Set([...everyExpressionIn(block)].filter(isCall).map((call) => call.function));
}

/** Each writable global `definition` names that no parameter or local of its scope hides. */
function globalsReadIn(definition: FunctionNode, writable: ReadonlyMap<string, StructMember>): Set<string> {
  const names = new Set<string>();
  const parameters = new Set(definition.arguments.map((argument) => argument.name));
  walkScoped(definition.body, parameters, (expression, hidden) => {
    if (expression.kind === 'variable' && writable.has(expression.name) && !hidden.has(expression.name))
      names.add(expression.name);
  });
  return names;
}

type ScopedMap = (expression: Expression, hidden: ReadonlySet<string>) => Expression;

/** `block` with each expression mapped, parts first, with the local names in scope where it stands. */
function mapScoped(block: BlockNode, outer: ReadonlySet<string>, map: ScopedMap): BlockNode {
  const hidden = new Set(outer);
  return { ...block, statements: block.statements.map((statement) => mapStatement(statement, hidden, map)) };
}

function mapStatement(statement: Statement, hidden: Set<string>, map: ScopedMap): Statement {
  const deep = (expression: Expression): Expression => map(withSubExpressions(expression, deep), hidden);
  switch (statement.kind) {
    case 'block':
      return mapScoped(statement, hidden, map);
    case 'control flow': {
      const expressions = statement.expressions.map(deep);
      const shared = sharedScope(statement, hidden);
      const blocks = statement.blocks.map((inner) =>
        shared
          ? { ...inner, statements: inner.statements.map((part) => mapStatement(part, shared, map)) }
          : mapScoped(inner, hidden, map)
      );
      return { ...statement, expressions, blocks };
    }
    case 'declaration': {
      const declarators = statement.declarators.map((declarator) => {
        const value = declarator.value && deep(declarator.value);
        hidden.add(declarator.name);
        return value ? { ...declarator, value } : declarator;
      });
      return { ...statement, declarators };
    }
    case 'slot':
      return statement;
    default:
      return deep(statement);
  }
}

/** The one scope a flow's blocks share, or nothing when each block has a scope of its own. */
function sharedScope(flow: ControlFlowNode, hidden: Set<string>): Set<string> | undefined {
  // A `for` initialiser's names stay in scope in its later blocks: the condition, the step and the body.
  if (flow.flow === 'FLOW_OP_FOR') return new Set(hidden);
  return undefined;
}

/** Calls `visit` with each expression of `block` and the local names in scope where it stands. */
function walkScoped(
  block: BlockNode,
  outer: ReadonlySet<string>,
  visit: (expression: Expression, hidden: ReadonlySet<string>) => void
): void {
  mapScoped(block, outer, (expression, hidden) => {
    visit(expression, hidden);
    return expression;
  });
}

/** `signature` with an `inout` parameter for each of `names`. */
function withParameters<Signature extends Omit<FunctionNode, 'body' | 'kind'>>(
  signature: Signature,
  names: readonly string[],
  writable: ReadonlyMap<string, StructMember>
): Signature {
  if (names.length === 0) return signature;
  const own = new Set(signature.arguments.map((argument) => argument.name));
  const added = names.map((name): Argument => {
    if (own.has(name))
      throw new Error(`expected no parameter of ${signature.rname} named as the global ${name} it touches`);
    const { type, arraySize } = writable.get(name)!;
    return {
      name,
      type,
      qualifier: 'inout',
      ...(arraySize ? { arraySize } : {}),
      position: signature.position,
    };
  });
  return { ...signature, arguments: [...signature.arguments, ...added] };
}

/** `definition`'s body with each call of a function that touches globals passing them by name. */
function withPassedGlobals(
  definition: FunctionNode,
  passed: (name: string) => readonly string[],
  writable: ReadonlyMap<string, StructMember>
): BlockNode {
  const passes = (expression: Expression): expression is CallNode =>
    isCall(expression) && passed(expression.function).length > 0;
  if (![...calleesOf(definition.body)].some((name) => passed(name).length > 0)) return definition.body;
  const parameters = new Set(definition.arguments.map((argument) => argument.name));
  return mapScoped(definition.body, parameters, (expression, hidden) =>
    passes(expression)
      ? withGlobalOperands(expression, passed(expression.function), writable, hidden)
      : expression
  );
}

function withGlobalOperands(
  call: CallNode,
  names: readonly string[],
  writable: ReadonlyMap<string, StructMember>,
  hidden: ReadonlySet<string>
): CallNode {
  const operands = names.map((name): Expression => {
    if (hidden.has(name))
      throw new Error(`expected no local named ${name} where ${call.rname} needs the global ${name}`);
    const { type, arraySize } = writable.get(name)!;
    return { kind: 'variable', name, type, ...(arraySize ? { arraySize } : {}), position: call.position };
  });
  return {
    ...call,
    operands: [...call.operands, ...operands],
    qualifiers: [...call.qualifiers, ...names.map(() => 'inout' as const)],
  };
}
