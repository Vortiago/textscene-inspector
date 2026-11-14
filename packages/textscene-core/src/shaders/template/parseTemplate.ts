/**
 * The parser of one stage of a template variant: the preprocessed tokens to the template tree,
 * by GLSL 4.50's grammar for declarations outside a function (section 4) and for statements
 * (section 6). Every token goes into the tree: a token the grammar has no place for fails the
 * parse, so nothing of a template is dropped.
 */

import type { SourcePosition } from '../language/shadingLanguageError.js';
import type {
  Argument,
  BlockNode,
  ControlFlowNode,
  DeclarationNode,
  Declarator,
  Expression,
  Flow,
  FunctionNode,
  Qualifier,
  Scalar,
  Statement,
  StructMember,
  StructNode,
} from '../language/shaderTree.js';
import { STAGE_VARIABLES } from './glslBuiltIns.js';
import {
  arrayOf,
  canonicalType,
  elementOf,
  initialiserPart,
  isTypeKeyword,
  type SizedType,
} from './glslTypes.js';
import { constantScalar } from './constantValue.js';
import { namedRow } from './glslRows.js';
import {
  GlslExpressionParser,
  RUNTIME_SIZED,
  type TemplateFunction,
  type TemplateScope,
  type TemplateVariable,
} from './parseGlslExpression.js';
import type { PpToken } from './ppScanner.js';
import type { Preprocessed } from './preprocess.js';
import type { StageName } from './stages.js';
import { TemplateCursor } from './templateCursor.js';
import type {
  BlockMember,
  GlobalDeclarator,
  GlobalQualifiers,
  InterfaceBlockNode,
  LayoutEntry,
  SlotNode,
  TemplateDeclaration,
  TemplateStageNode,
} from './templateTree.js';

/** The tree of one stage of a preprocessed template variant. */
export function parseTemplateStage(stage: StageName, preprocessed: Preprocessed): TemplateStageNode {
  const declarations = new TemplateParser(stage, new TemplateCursor(preprocessed.tokens)).declarations();
  return { kind: 'template stage', stage, directives: preprocessed.directives, declarations };
}

/** The qualifier words of GLSL 4.50 that stand before a type (section 4.3 to 4.10). */
const QUALIFIER_WORDS = new Set([
  'const',
  'in',
  'out',
  'inout',
  'uniform',
  'buffer',
  'shared',
  'attribute',
  'varying',
  'centroid',
  'sample',
  'patch',
  'flat',
  'smooth',
  'noperspective',
  'invariant',
  'precise',
  'highp',
  'mediump',
  'lowp',
  'coherent',
  'volatile',
  'restrict',
  'readonly',
  'writeonly',
]);

const PRECISIONS = new Set(['highp', 'mediump', 'lowp']);

/** A variable of a block, a function or a stage, and its constant lanes for a `const` with a value. */
interface ScopeEntry extends TemplateVariable {
  readonly values?: readonly Scalar[];
}

class Scope {
  readonly variables = new Map<string, ScopeEntry>();
  constructor(readonly parent?: Scope) {}

  find(name: string): ScopeEntry | undefined {
    return this.variables.get(name) ?? this.parent?.find(name);
  }
}

class TemplateParser implements TemplateScope {
  private readonly globals = new Scope();
  private scope: Scope;
  private readonly structs = new Map<string, readonly StructMember[]>();
  private readonly functions = new Map<string, TemplateFunction[]>();
  private readonly expressions: GlslExpressionParser;

  constructor(
    stage: StageName,
    private readonly tokens: TemplateCursor
  ) {
    for (const [name, variable] of Object.entries(STAGE_VARIABLES[stage]))
      this.globals.variables.set(name, variable);
    this.scope = new Scope(this.globals);
    this.expressions = new GlslExpressionParser(tokens, this);
  }

  variable(name: string): TemplateVariable | undefined {
    return this.scope.find(name);
  }

  members(type: string): readonly StructMember[] | undefined {
    return this.structs.get(type);
  }

  functionsNamed(name: string): readonly TemplateFunction[] {
    return this.functions.get(name) ?? [];
  }

  private constantLanes = (name: string) => this.scope.find(name)?.values;

  declarations(): TemplateDeclaration[] {
    const declarations: TemplateDeclaration[] = [];
    while (!this.tokens.isAtEnd()) {
      const token = this.tokens.peek()!;
      if (token.kind === 'slot') {
        this.tokens.next();
        declarations.push({ kind: 'slot', slot: token.slot!, position: token.position });
        continue;
      }
      if (this.tokens.accept(';')) continue;
      declarations.push(...this.declaration());
    }
    return declarations;
  }

  /** One declaration, or a struct and the globals of its type: `struct S { ... } s;`. */
  private declaration(): TemplateDeclaration[] {
    const position = this.tokens.position();
    if (this.tokens.peekText() === 'precision') return [this.precision(position)];
    if (this.tokens.peekText() === 'struct') {
      const struct = this.struct();
      if (this.tokens.accept(';')) return [struct];
      return [struct, this.global({ layout: [], words: [] }, struct.name, position)];
    }
    const qualifiers = this.qualifiers();
    if (this.tokens.accept(';')) return [{ kind: 'default layout', qualifiers, position }];
    const next = this.tokens.peek()!;
    if (next.kind === 'identifier' && this.tokens.peekText(1) === '{' && !this.structs.has(next.text))
      return [this.interfaceBlock(qualifiers, position)];
    if (qualifiers.words.includes('invariant') && !this.isTypeStart())
      return [this.invariant(qualifiers, position)];
    const type = this.typeName();
    if (this.tokens.peek()?.kind === 'identifier' && this.tokens.peekText(1) === '(')
      return [this.functionDeclaration(type, position)];
    return [this.global(qualifiers, type, position)];
  }

  /** `invariant gl_Position;`: names declared before, made invariant (section 4.8.1). */
  private invariant(qualifiers: GlobalQualifiers, position: SourcePosition): TemplateDeclaration {
    if (qualifiers.layout.length > 0 || qualifiers.words.length > 1) this.tokens.fail('expected a type');
    const names: string[] = [];
    for (;;) {
      const name = this.tokens.identifier();
      if (!this.scope.find(name.text)) this.tokens.fail(`undeclared identifier: ${name.text}`, name.position);
      names.push(name.text);
      if (this.tokens.accept(';')) return { kind: 'invariant', names, position };
      this.tokens.expect(',');
    }
  }

  private precision(position: SourcePosition): TemplateDeclaration {
    this.tokens.expect('precision');
    const precision = this.tokens.identifier().text;
    const type = this.tokens.identifier().text;
    this.tokens.expect(';');
    return { kind: 'precision', precision, type, position };
  }

  /** `layout(...)` and the qualifier words, in the order of the text. */
  private qualifiers(): GlobalQualifiers {
    const layout: LayoutEntry[] = [];
    const words: string[] = [];
    for (;;) {
      const text = this.tokens.peekText();
      if (text === 'layout') {
        this.tokens.next();
        layout.push(...this.layoutEntries());
      } else if (QUALIFIER_WORDS.has(text) && this.tokens.peek()?.kind === 'identifier') {
        words.push(this.tokens.next().text);
      } else return { layout, words };
    }
  }

  private layoutEntries(): LayoutEntry[] {
    this.tokens.expect('(');
    const entries: LayoutEntry[] = [];
    for (;;) {
      const name = this.tokens.identifier().text;
      if (this.tokens.accept('=')) entries.push({ name, value: this.expressions.constantInteger() });
      else entries.push({ name });
      if (this.tokens.accept(')')) return entries;
      this.tokens.expect(',');
    }
  }

  /** A type name: a GLSL type keyword or a struct's name. */
  private typeName(): string {
    const token = this.tokens.identifier();
    if (isTypeKeyword(token.text)) return canonicalType(token.text);
    if (this.structs.has(token.text)) return token.text;
    return this.tokens.fail(`expected a type, found ${token.text}`, token.position);
  }

  private isTypeStart(): boolean {
    const text = this.tokens.peekText();
    return this.tokens.peek()?.kind === 'identifier' && (isTypeKeyword(text) || this.structs.has(text));
  }

  private struct(): StructNode {
    const position = this.tokens.expect('struct').position;
    const name = this.tokens.identifier().text;
    this.tokens.expect('{');
    const members = this.memberList()
      .filter((member): member is BlockMember => member.kind === 'block member')
      .map(({ name: member, type, arraySize }) => ({
        name: member,
        type,
        ...(arraySize !== undefined ? { arraySize } : {}),
      }));
    this.structs.set(name, members);
    return { kind: 'struct', name, members, position };
  }

  /** The members up to `}`, each with its qualifiers, and the slot of a material's uniforms. */
  private memberList(): (BlockMember | SlotNode)[] {
    const members: (BlockMember | SlotNode)[] = [];
    for (;;) {
      const token = this.tokens.peek();
      if (token?.kind === 'slot') {
        this.tokens.next();
        members.push({ kind: 'slot', slot: token.slot!, position: token.position });
        continue;
      }
      if (this.tokens.accept('}')) return members;
      const qualifiers = this.qualifiers();
      const base = this.typeName();
      const typeSizes = this.arraySizes();
      for (;;) {
        const name = this.tokens.identifier();
        const { type, arraySize } = this.declared(base, typeSizes);
        members.push({
          kind: 'block member',
          name: name.text,
          type,
          qualifiers,
          position: name.position,
          ...(arraySize !== undefined ? { arraySize } : {}),
          ...(arraySize === RUNTIME_SIZED ? { isRuntimeSized: true } : {}),
        });
        if (this.tokens.accept(';')) break;
        this.tokens.expect(',');
      }
    }
  }

  /** The sizes of `[n][m]`, outermost first, with `RUNTIME_SIZED` for `[]`. */
  private arraySizes(): number[] {
    const sizes: number[] = [];
    while (this.tokens.accept('[')) {
      sizes.push(this.tokens.peekText() === ']' ? RUNTIME_SIZED : this.arraySize());
      this.tokens.expect(']');
    }
    return sizes;
  }

  /** The type of a name of `base` with the sizes after the name, then `typeSizes` after the type. */
  private declared(base: string, typeSizes: readonly number[] = []): SizedType {
    return arrayOf(base, [...this.arraySizes(), ...typeSizes]);
  }

  private arraySize(): number {
    const expression = this.expressions.constantInteger();
    const value = constantScalar(expression, this.constantLanes);
    if (typeof value !== 'number' || value <= 0)
      this.tokens.fail(
        'array size must be a constant integer expression greater than zero',
        expression.position
      );
    return value;
  }

  private interfaceBlock(qualifiers: GlobalQualifiers, position: SourcePosition): InterfaceBlockNode {
    const blockName = this.tokens.identifier().text;
    this.tokens.expect('{');
    const members = this.memberList();
    if (members.length === 0) this.tokens.fail('syntax error, unexpected RIGHT_BRACE');
    const fields = members.filter((member): member is BlockMember => member.kind === 'block member');
    const instance = this.tokens.peek()?.kind === 'identifier' ? this.tokens.next().text : undefined;
    const arraySize = instance ? this.declared(blockName).arraySize : undefined;
    this.tokens.expect(';');
    if (instance) {
      this.structs.set(blockName, fields);
      this.globals.variables.set(instance, {
        type: blockName,
        ...(arraySize !== undefined ? { arraySize } : {}),
      });
    } else
      for (const field of fields)
        this.globals.variables.set(field.name, {
          type: field.type,
          ...(field.arraySize !== undefined ? { arraySize: field.arraySize } : {}),
        });
    return {
      kind: 'interface block',
      qualifiers,
      blockName,
      members,
      position,
      ...(instance ? { instanceName: instance } : {}),
      ...(arraySize !== undefined ? { arraySize } : {}),
    };
  }

  private global(qualifiers: GlobalQualifiers, base: string, position: SourcePosition): TemplateDeclaration {
    const isConst = qualifiers.words.includes('const');
    const declarators: GlobalDeclarator[] = [];
    let type: string | undefined;
    for (;;) {
      const name = this.tokens.identifier();
      const declared = this.declared(base);
      type = this.sameElementType(type, declared, name);
      const size = declared.arraySize;
      const value = this.tokens.accept('=') ? this.initialiser(declared) : undefined;
      const arraySize = size === RUNTIME_SIZED && value ? arraySizeOf(value) : size;
      const values = isConst && value ? constantLanes(value, this.constantLanes) : undefined;
      this.globals.variables.set(name.text, {
        type,
        ...(arraySize !== undefined ? { arraySize } : {}),
        ...(isConst ? { isConst } : {}),
        ...(values ? { values } : {}),
      });
      declarators.push({
        name: name.text,
        position: name.position,
        ...(arraySize !== undefined ? { arraySize } : {}),
        ...(arraySize === RUNTIME_SIZED ? { isRuntimeSized: true } : {}),
        ...(value ? { value } : {}),
      });
      if (this.tokens.accept(';')) break;
      this.tokens.expect(',');
    }
    return { kind: 'global', qualifiers, type, declarators, position };
  }

  /**
   * The element type the names of one declaration share. The tree holds one type for a
   * declaration, so names with other inner array sizes fail: Godot's templates have none.
   */
  private sameElementType(shared: string | undefined, declared: SizedType, name: PpToken): string {
    if (shared !== undefined && shared !== declared.type)
      this.tokens.fail(
        `expected the element type ${shared} of the names before, found ${declared.type}`,
        name.position
      );
    return declared.type;
  }

  /** The value after `=`: an expression, or an initialiser list in braces (section 4.1.11). */
  private initialiser(declared: SizedType): Expression {
    if (this.tokens.peekText() === '{') return this.initialiserList(declared);
    const value = this.expressions.expression();
    if (declared.arraySize !== undefined) return value;
    return this.expressions.converted(value, declared.type);
  }

  /** `{ a, b }`: the constructor of an array, a struct, a vector or a matrix, in its parts. */
  private initialiserList(declared: SizedType): Expression {
    const position = this.tokens.expect('{').position;
    const parts = initialiserParts(declared, (type) => this.structs.get(type));
    const elements: Expression[] = [];
    while (!this.tokens.accept('}')) {
      const part = parts(elements.length);
      if (!part) this.tokens.fail(`too many initialisers for ${declared.type}`);
      elements.push(this.initialiser(part));
      if (this.tokens.peekText() !== '}') this.tokens.expect(',');
    }
    return this.expressions.constructed(declared, elements, position);
  }

  private functionDeclaration(returnType: string, position: SourcePosition): TemplateDeclaration {
    const rname = this.tokens.identifier().text;
    const args = this.parameterList();
    const overloads = this.functions.get(rname) ?? [];
    const sameArguments = overloads.find(
      (overload) =>
        overload.parameters.length === args.length &&
        overload.parameters.every(
          (parameter, index) =>
            parameter.type === args[index]!.type &&
            (parameter.arraySize ?? 0) === (args[index]!.arraySize ?? 0)
        )
    );
    const name = sameArguments?.name ?? (overloads.length === 0 ? rname : `${rname}@${overloads.length + 1}`);
    if (!sameArguments)
      this.functions.set(rname, [
        ...overloads,
        {
          name,
          rname,
          returnType,
          parameters: args.map(({ type, qualifier, arraySize }) => ({
            type,
            qualifier,
            ...(arraySize !== undefined ? { arraySize } : {}),
          })),
        },
      ]);
    const header = { name, rname, returnType, arguments: args, position };
    if (this.tokens.accept(';')) return { kind: 'prototype', function: header, position };
    const body = this.functionBody(args);
    const definition: FunctionNode = { kind: 'function', ...header, body };
    return definition;
  }

  private parameterList(): Argument[] {
    this.tokens.expect('(');
    const args: Argument[] = [];
    if (this.tokens.accept(')')) return args;
    if (this.tokens.peekText() === 'void' && this.tokens.peekText(1) === ')') {
      this.tokens.next();
      this.tokens.next();
      return args;
    }
    for (;;) {
      const qualifiers = this.qualifiers();
      const base = this.typeName();
      const nameToken = this.tokens.peek()?.kind === 'identifier' ? this.tokens.next() : undefined;
      const { type, arraySize } = this.declared(base);
      const qualifier: Qualifier =
        (['inout', 'out', 'in'] as const).find((word) => qualifiers.words.includes(word)) ?? 'in';
      const otherWords = qualifiers.words.filter((word) => !['in', 'out', 'inout', 'const'].includes(word));
      args.push({
        name: nameToken?.text ?? '',
        type,
        qualifier,
        position: nameToken?.position ?? this.tokens.position(),
        ...(qualifiers.words.includes('const') ? { isConst: true } : {}),
        ...(arraySize !== undefined ? { arraySize } : {}),
        ...(otherWords.length > 0 ? { words: otherWords } : {}),
      });
      if (this.tokens.accept(')')) return args;
      this.tokens.expect(',');
    }
  }

  private functionBody(args: readonly Argument[]): BlockNode {
    const outer = this.scope;
    this.scope = new Scope(this.globals);
    for (const argument of args)
      if (argument.name)
        this.scope.variables.set(argument.name, {
          type: argument.type,
          ...(argument.arraySize !== undefined ? { arraySize: argument.arraySize } : {}),
          ...(argument.isConst ? { isConst: true } : {}),
        });
    try {
      return this.block(this.tokens.expect('{').position);
    } finally {
      this.scope = outer;
    }
  }

  /** The statements after a `{`, up to its `}`, in a scope of their own. */
  private block(position: SourcePosition): BlockNode {
    return this.within(() => {
      const statements: Statement[] = [];
      while (!this.tokens.accept('}')) statements.push(this.statement());
      return { kind: 'block', statements, position };
    });
  }

  private within<T>(read: () => T): T {
    const outer = this.scope;
    this.scope = new Scope(outer);
    try {
      return read();
    } finally {
      this.scope = outer;
    }
  }

  /** One statement as its own block, the body of a branch or a loop. */
  private body(): BlockNode {
    const position = this.tokens.position();
    if (this.tokens.accept('{')) return this.block(position);
    return this.within(() => ({ kind: 'block', statements: [this.statement()], position }));
  }

  private statement(): Statement {
    const token = this.tokens.peek()!;
    if (token.kind === 'slot') {
      this.tokens.next();
      return { kind: 'slot', name: token.slot!.name, position: token.position };
    }
    const attributes = this.attributes();
    const position = this.tokens.position();
    switch (this.tokens.peek()?.kind === 'identifier' ? this.tokens.peekText() : '') {
      case 'if':
        return this.ifStatement(position, attributes);
      case 'for':
        return this.forStatement(position, attributes);
      case 'while':
        return this.whileStatement(position, attributes);
      case 'do':
        return this.doStatement(position, attributes);
      case 'switch':
        return this.switchStatement(position, attributes);
      case 'case':
      case 'default':
        return this.label(position);
      case 'break':
      case 'continue':
      case 'discard':
        return this.simpleFlow(position);
      case 'return':
        return this.returnStatement(position);
    }
    if (this.tokens.accept('{')) return this.block(position);
    if (this.tokens.accept(';')) return emptyStatement(position);
    if (this.startsDeclaration()) return this.localDeclaration(position);
    const expression = this.expressions.expression();
    this.tokens.expect(';');
    return expression;
  }

  /** `[[dont_unroll]]` and the other attributes of `GL_EXT_control_flow_attributes`. */
  private attributes(): string[] {
    const attributes: string[] = [];
    while (this.tokens.peekText() === '[' && this.tokens.peekText(1) === '[') {
      this.tokens.next();
      this.tokens.next();
      for (;;) {
        attributes.push(this.tokens.identifier().text);
        if (!this.tokens.accept(',')) break;
      }
      this.tokens.expect(']');
      this.tokens.expect(']');
    }
    return attributes;
  }

  /** A declaration starts with `const`, a precision, or a type and then a name, maybe after `[n]`. */
  private startsDeclaration(): boolean {
    const text = this.tokens.peekText();
    if (text === 'const' || PRECISIONS.has(text)) return true;
    if (!this.isTypeStart()) return false;
    let offset = 1;
    while (this.tokens.peekText(offset) === '[') {
      while (this.tokens.peek(offset) && this.tokens.peekText(offset) !== ']') offset += 1;
      offset += 1;
    }
    return this.tokens.peek(offset)?.kind === 'identifier';
  }

  private localDeclaration(position: SourcePosition): DeclarationNode {
    const isConst = this.tokens.accept('const');
    const words: string[] = [];
    while (PRECISIONS.has(this.tokens.peekText())) words.push(this.tokens.next().text);
    const base = this.typeName();
    const typeSizes = this.arraySizes();
    const declarators: Declarator[] = [];
    let type: string | undefined;
    for (;;) {
      const name = this.tokens.identifier();
      const declared = this.declared(base, typeSizes);
      type = this.sameElementType(type, declared, name);
      const size = declared.arraySize;
      const value = this.tokens.accept('=') ? this.initialiser(declared) : undefined;
      const arraySize = size === RUNTIME_SIZED && value ? arraySizeOf(value) : size;
      const values = isConst && value ? constantLanes(value, this.constantLanes) : undefined;
      this.scope.variables.set(name.text, {
        type,
        ...(arraySize !== undefined ? { arraySize } : {}),
        ...(isConst ? { isConst } : {}),
        ...(values ? { values } : {}),
      });
      declarators.push({
        name: name.text,
        position: name.position,
        ...(arraySize !== undefined ? { arraySize } : {}),
        ...(value ? { value } : {}),
      });
      if (this.tokens.accept(';')) break;
      this.tokens.expect(',');
    }
    return {
      kind: 'declaration',
      type,
      isConst,
      declarators,
      position,
      ...(words.length > 0 ? { words } : {}),
    };
  }

  private condition(): Expression {
    this.tokens.expect('(');
    const condition = this.expressions.expression();
    this.tokens.expect(')');
    return condition;
  }

  private ifStatement(position: SourcePosition, attributes: readonly string[]): ControlFlowNode {
    this.tokens.next();
    const condition = this.condition();
    const blocks = [this.body()];
    if (this.tokens.accept('else')) blocks.push(this.body());
    return flow('FLOW_OP_IF', [condition], blocks, position, attributes);
  }

  private forStatement(position: SourcePosition, attributes: readonly string[]): ControlFlowNode {
    this.tokens.next();
    this.tokens.expect('(');
    return this.within(() => {
      const initPosition = this.tokens.position();
      const init: BlockNode = {
        kind: 'block',
        statements: this.tokens.accept(';') ? [] : [this.forInit()],
        position: initPosition,
      };
      const conditions = this.expressionsUntil(';');
      const steps = this.expressionsUntil(')');
      const body = this.body();
      return flow('FLOW_OP_FOR', [], [init, conditions, steps, body], position, attributes);
    });
  }

  private forInit(): Statement {
    if (this.startsDeclaration()) return this.localDeclaration(this.tokens.position());
    const expression = this.expressions.expression();
    this.tokens.expect(';');
    return expression;
  }

  /** The `,`-separated expressions of a `for` part, up to `end`, as a block of them. */
  private expressionsUntil(end: string): BlockNode {
    const position = this.tokens.position();
    const statements: Expression[] = [];
    while (!this.tokens.accept(end)) {
      statements.push(this.expressions.expression());
      if (this.tokens.peekText() !== end) this.tokens.expect(',');
    }
    return { kind: 'block', statements, position };
  }

  private whileStatement(position: SourcePosition, attributes: readonly string[]): ControlFlowNode {
    this.tokens.next();
    const condition = this.condition();
    return flow('FLOW_OP_WHILE', [condition], [this.body()], position, attributes);
  }

  private doStatement(position: SourcePosition, attributes: readonly string[]): ControlFlowNode {
    this.tokens.next();
    const body = this.body();
    this.tokens.expect('while');
    const condition = this.condition();
    this.tokens.expect(';');
    return flow('FLOW_OP_DO', [condition], [body], position, attributes);
  }

  /** `switch (v) { ... }`: its labels and statements in one block, as GLSL falls through. */
  private switchStatement(position: SourcePosition, attributes: readonly string[]): ControlFlowNode {
    this.tokens.next();
    const value = this.condition();
    const blockPosition = this.tokens.expect('{').position;
    const block = this.block(blockPosition);
    return flow('FLOW_OP_SWITCH', [value], [block], position, attributes);
  }

  /** `case n:` or `default:`, a statement of its own in the switch's block. */
  private label(position: SourcePosition): ControlFlowNode {
    const word = this.tokens.next().text;
    const expressions = word === 'case' ? [this.expressions.constantInteger()] : [];
    this.tokens.expect(':');
    const empty: BlockNode = { kind: 'block', statements: [], position };
    return flow(word === 'case' ? 'FLOW_OP_CASE' : 'FLOW_OP_DEFAULT', expressions, [empty], position, []);
  }

  private simpleFlow(position: SourcePosition): ControlFlowNode {
    const word = this.tokens.next().text;
    this.tokens.expect(';');
    const flows: Readonly<Record<string, Flow>> = {
      break: 'FLOW_OP_BREAK',
      continue: 'FLOW_OP_CONTINUE',
      discard: 'FLOW_OP_DISCARD',
    };
    return flow(flows[word]!, [], [], position, []);
  }

  private returnStatement(position: SourcePosition): ControlFlowNode {
    this.tokens.next();
    if (this.tokens.accept(';')) return flow('FLOW_OP_RETURN', [], [], position, []);
    const value = this.expressions.expression();
    this.tokens.expect(';');
    return flow('FLOW_OP_RETURN', [value], [], position, []);
  }
}

const emptyStatement = (position: SourcePosition): Expression => ({
  kind: 'operator',
  type: 'void',
  op: 'OP_EMPTY',
  row: namedRow('OP_EMPTY'),
  operands: [],
  position,
});

function flow(
  name: Flow,
  expressions: readonly Expression[],
  blocks: readonly BlockNode[],
  position: SourcePosition,
  attributes: readonly string[]
): ControlFlowNode {
  return {
    kind: 'control flow',
    flow: name,
    expressions,
    blocks,
    position,
    ...(attributes.length > 0 ? { attributes } : {}),
  };
}

/** The type of each part of an initialiser list of `declared`, by its index: nothing past the last. */
function initialiserParts(
  declared: SizedType,
  members: (type: string) => readonly StructMember[] | undefined
): (index: number) => SizedType | undefined {
  const { type, arraySize } = declared;
  if (arraySize !== undefined) {
    const element = elementOf(type);
    return (index) => (index < arraySize ? element : undefined);
  }
  const fields = members(type);
  if (fields) return (index) => fields[index];
  return (index) => initialiserPart(type, index);
}

function arraySizeOf(value: Expression): number | undefined {
  return value.kind === 'array construct' ? value.arraySize : undefined;
}

/** The lanes of a constant value: a literal's, or a folded scalar's. */
function constantLanes(
  value: Expression,
  lookup: (name: string) => readonly Scalar[] | undefined
): readonly Scalar[] | undefined {
  if (value.kind === 'constant') return value.values;
  const scalar = constantScalar(value, lookup);
  return scalar === undefined ? undefined : [scalar];
}

export type { PpToken };
