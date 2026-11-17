import { instruction, isBuiltInNameOf, keywordInstruction } from './instructions.js';
import { INSTRUCTION_TABLE } from './instructionTable.generated.js';
import { StatementParser, type ScopeHolder } from './parseBlock.js';
import { ExpressionParser, type ExpressionScope } from './parseExpression.js';
import { UniformParser } from './parseUniform.js';
import type { RenderingMethod } from '../preprocessor/preprocessor.js';
import { ModeParser } from './parseModes.js';
import { parseDeclaration } from './parseDeclaration.js';
import { parseVarying, VaryingStages } from './parseVarying.js';
import { BlockScope, type Identifier } from './scope.js';
import { callTarget, type FunctionSignature } from './parseCall.js';
import { StageRules } from './stageRules.js';
import type {
  Argument,
  BlockNode,
  CallNode,
  DeclarationNode,
  Expression,
  FunctionNode,
  Qualifier,
  ShaderNode,
  StructMember,
  GlobalEntry,
  StructNode,
  ValueType,
  VaryingNode,
} from './shaderTree.js';
import type { SourcePosition } from './shadingLanguageError.js';
import { TokenCursor } from './tokenCursor.js';
import { isPrecisionToken, type Token } from './tokenizer.js';
import { shapeOf } from './types.js';
import { everyStatement, isReturn } from './treeWalk.js';

/** The shader types in Godot's order (`shader_types.cpp:523`), from their `shader_type` rows. */
const SHADER_TYPES = INSTRUCTION_TABLE.filter((row) => row.id.startsWith('shader_type ')).map((row) =>
  row.id.slice(12)
);

/** The tree of the tokens of a shader text, for the project's renderer. */
export function parse(
  tokens: readonly Token[],
  renderingMethod: RenderingMethod = 'forward_plus'
): ShaderNode {
  return new ShaderParser(new TokenCursor(tokens), renderingMethod).shader();
}

class ShaderParser implements ExpressionScope {
  private readonly structs: StructNode[] = [];
  private readonly order: GlobalEntry[] = [];
  private readonly functions: FunctionNode[] = [];
  /** Each function declared so far by its name in the text, its own included while its body is read. */
  private readonly signatures = new Map<string, FunctionSignature[]>();
  /** The type the shader head names. Written only by `shader`. */
  private shaderType: string | undefined;
  /** The function whose body is read: set at its `{` and cleared at its `}`. */
  private current: FunctionSignature | undefined;
  /** The uniforms, varyings and constants by name, which every body sees. */
  private readonly globals = new Map<string, Identifier>();
  /** The block a statement is read in. Outside a body, the one that sees only the globals. */
  private readonly holder: ScopeHolder = {
    current: new BlockScope(undefined, 'plain', [], this.globals),
  };
  private readonly varyings = new Map<string, VaryingNode>();
  private readonly constants: DeclarationNode[] = [];
  private readonly expressions: ExpressionParser;
  private readonly statements: StatementParser;
  private readonly uniforms: UniformParser;
  private readonly modes: ModeParser;
  private readonly varyingStages: VaryingStages;
  private readonly stageRules: StageRules;
  /** The processor functions declared so far, which no call reaches (`callable`, :10673). */
  private readonly processors = new Set<string>();

  constructor(
    private readonly tokens: TokenCursor,
    renderingMethod: RenderingMethod
  ) {
    this.expressions = new ExpressionParser(tokens, this);
    this.uniforms = new UniformParser(tokens, this.expressions, {
      shaderType: () => this.shaderType,
      renderingMethod,
      isStruct: (name) => this.struct(name) !== undefined,
      isTaken: (name) => this.isGlobalName(name) || this.isBuiltInName(name),
      globals: this.globals,
    });
    this.modes = new ModeParser(tokens, () => this.shaderTypeName());
    this.varyingStages = new VaryingStages(tokens);
    this.stageRules = new StageRules(tokens, {
      shaderType: () => this.shaderTypeName(),
      currentFunction: () => this.current?.name,
      varyingStage: (name) => this.varyingStages.stageOf(name),
    });
    this.statements = new StatementParser(
      tokens,
      this.expressions,
      this.holder,
      (name) => this.struct(name) !== undefined,
      () => this.current!,
      this.stageRules
    );
  }

  identifier(name: string): Identifier | undefined {
    // Outside a body, the globals declared so far: a default that reads a uniform is not a constant.
    const found = this.holder.current.find(name, false);
    if (found) return found;
    if (this.signatures.has(name) || this.stageRules.isStageFunctionHere(name)) return { kind: 'function' };
    return this.builtIn(name);
  }

  /** A function or a global of the name, as `_find_identifier` finds one outside a function. */
  private isGlobalName(name: string): boolean {
    return this.signatures.has(name) || this.globals.has(name);
  }

  /** Godot's checks of a read or a write of a varying, which only a function body has. */
  useVarying(name: string): void {
    if (!this.current) return;
    this.stageRules.useVarying(name);
    this.varyingStages.use(this.varying(name)!, this.current.rname);
  }

  private varying(name: string): VaryingNode | undefined {
    return this.varyings.get(name);
  }

  checkCall(rname: string, args: readonly Expression[]): void {
    this.stageRules.call(callTarget(this, rname, args));
  }

  stageCall(name: string, args: readonly Expression[], position: SourcePosition): CallNode | undefined {
    return this.stageRules.stageCall(name, args, position);
  }

  isProcessor(name: string): boolean {
    return this.processors.has(name);
  }

  /** A varying, or an element of one, passed for a parameter (`shader_language.cpp:6368`). */
  varyingRefusal(arg: Expression, qualifier: Qualifier): string | undefined {
    const variable = arg.kind === 'array element' ? arg.array : arg;
    const varying =
      variable.kind === 'variable' && variable.isVarying ? this.varying(variable.name) : undefined;
    return (
      varying && this.current && this.varyingStages.argumentRefusal(varying, qualifier, this.current.rname)
    );
  }

  /** From the stage function, `global` or the constants; outside a function, the constants only. */
  private builtIn(name: string): Identifier | undefined {
    const shaderType = this.shaderTypeName();
    const scopes = this.current ? [this.current.rname, 'global', 'constants'] : ['constants'];
    const row = scopes.map((scope) => instruction(`${shaderType}.${scope}.${name}`)).find(Boolean);
    if (!row?.returns) return undefined;
    return {
      kind: 'built-in',
      type: row.returns,
      arraySize: 0,
      isConst: row.family.endsWith('(read only)'),
      row: row.id,
    };
  }

  functionsNamed(rname: string): readonly FunctionSignature[] {
    return this.signatures.get(rname) ?? [];
  }

  currentFunction(): string | undefined {
    return this.current?.name;
  }

  isLocal(name: string): boolean {
    return this.holder.current.findLocal(name) !== undefined;
  }

  struct(name: string): StructNode | undefined {
    return this.structs.find((struct) => struct.name === name);
  }

  shader(): ShaderNode {
    const headPosition = this.tokens.peek().position;
    this.shaderType = this.shaderHead();
    const head = this.shaderType ? { shaderType: this.shaderType, headPosition } : {};
    for (;;) {
      const token = this.tokens.next();
      if (token.type === 'TK_EOF') return this.tree(head);
      const before = this.globalCounts();
      this.globalStatement(token);
      this.recordOrder(before);
    }
  }

  private globalCounts(): Record<GlobalEntry['kind'], number> {
    return {
      struct: this.structs.length,
      uniform: this.uniforms.uniforms.length,
      varying: this.varyings.size,
      constant: this.constants.length,
      function: this.functions.length,
    };
  }

  /** An entry for each global the statement added, after `before`. */
  private recordOrder(before: Record<GlobalEntry['kind'], number>): void {
    const after = this.globalCounts();
    for (const kind of Object.keys(after) as GlobalEntry['kind'][])
      for (let index = before[kind]; index < after[kind]; index++) this.order.push({ kind, index });
  }

  /** One statement outside a function (`shader_language.cpp:9237`). */
  private globalStatement(token: Token): void {
    switch (token.type) {
      case 'TK_RENDER_MODE':
        return this.modes.renderModeStatement();
      case 'TK_STENCIL_MODE':
        return this.modes.stencilModeStatement();
      case 'TK_STRUCT':
        return void this.structs.push(this.structDefinition(token));
      case 'TK_UNIFORM_GROUP':
        return this.uniforms.groupStatement(token);
      case 'TK_VARYING':
        return this.varyingDeclaration();
      case 'TK_SHADER_TYPE':
        return this.tokens.fail('Shader type is already defined.');
      default:
        if (isUniformWord(token.type)) return this.uniforms.declaration(token);
        if (token.type === 'TK_CONST') return this.constantOrFunction(token);
        return void this.functions.push(this.functionDefinition(token));
    }
  }

  private varyingDeclaration(): void {
    const varying = parseVarying(this.tokens, this.expressions, {
      shaderType: () => this.shaderType,
      isStruct: (name) => this.struct(name) !== undefined,
      isTaken: (name) => this.isGlobalName(name) || this.isBuiltInName(name),
    });
    this.varyings.set(varying.name, varying);
    this.globals.set(varying.name, {
      kind: 'varying',
      type: varying.type,
      arraySize: varying.arraySize ?? 0,
      isConst: false,
    });
  }

  /** A global after `const`: a constant, or a function Godot refuses at its `(` (:10268). */
  private constantOrFunction(first: Token): void {
    const mark = this.tokens.mark();
    const type = this.constantType();
    if (this.tokens.peek().type === 'TK_BRACKET_OPEN') {
      this.tokens.next();
      this.expressions.arrays.size(false);
    }
    const nameToken = this.tokens.next();
    if (nameToken.type !== 'TK_IDENTIFIER') this.tokens.fail("Expected an identifier or '[' after type.");
    if (this.isConstantNameTaken(nameToken.text!)) this.tokens.fail(`Redefinition of '${nameToken.text}'.`);
    if (this.tokens.next().type === 'TK_PARENTHESIS_OPEN')
      this.tokens.fail("'const' qualifier cannot be used with a function return type.");
    if (type === 'void') this.tokens.fail("Expected '(' after function identifier.");
    this.tokens.reset(mark);
    this.constantDeclaration(first, nameToken.text!);
  }

  /** The type after `const` and a precision: a value type, `void` or a struct's name. */
  private constantType(): ValueType {
    let token = this.tokens.next();
    const hasPrecision = isPrecisionToken(token);
    if (hasPrecision) token = this.tokens.next();
    if (token.type === 'TK_IDENTIFIER' && this.struct(token.text!)) {
      if (hasPrecision) this.tokens.fail('The precision modifier cannot be used on structs.');
      return token.text!;
    }
    const row = keywordInstruction(token.type);
    if (row?.family !== 'data type') this.tokens.fail('Expected constant, function, uniform or varying.');
    const shape = shapeOf(row.id);
    if (shape === undefined && row.id !== 'void')
      this.tokens.fail('Invalid constant type (samplers are not allowed).');
    if (hasPrecision && shape?.scalar === 'bool')
      this.tokens.fail('The precision modifier cannot be used on boolean types.');
    return row.id;
  }

  /** A struct, a global or a built-in of the shader type, but not a function, has the name (:10347). */
  private isConstantNameTaken(name: string): boolean {
    return this.struct(name) !== undefined || this.globals.has(name) || this.isBuiltInName(name);
  }

  private isBuiltInName(name: string): boolean {
    return isBuiltInNameOf(this.shaderTypeName(), name);
  }

  /** A text with no head is a probe's, which Godot draws as a `canvas_item`. */
  private shaderTypeName(): string {
    return this.shaderType ?? 'canvas_item';
  }

  /** `const float a = 1.0, b[2] = {a, a};` outside a function (`shader_language.cpp:10364`). */
  private constantDeclaration(first: Token, firstName: string): void {
    const declaration = parseDeclaration(first, this.tokens, this.expressions, this.holder.current, {
      isStruct: (name) => this.struct(name) !== undefined,
      // A function's name refuses each name after the first, which `isConstantNameTaken` read (:10617).
      isTaken: (name) => this.isBuiltInName(name) || (name !== firstName && this.signatures.has(name)),
    });
    this.constants.push(declaration);
    for (const { name } of declaration.declarators) {
      const variable = this.holder.current.variables.get(name)!;
      this.globals.set(name, { kind: 'constant', ...variable });
    }
  }

  private tree(head: Pick<ShaderNode, 'shaderType' | 'headPosition'>): ShaderNode {
    return {
      kind: 'shader',
      ...head,
      renderModes: this.modes.modes.render_mode,
      stencilModes: this.modes.modes.stencil_mode,
      ...(this.modes.stencilReference !== undefined ? { stencilReference: this.modes.stencilReference } : {}),
      varyings: [...this.varyings.values()],
      constants: this.constants,
      structs: this.structs,
      order: this.order,
      uniforms: this.uniforms.uniforms,
      uniformGroups: this.uniforms.groups,
      functions: this.functions,
    };
  }

  /** `shader_type sky;`, or nothing for a text with no head (`shader_language.cpp:9178`). */
  private shaderHead(): string | undefined {
    if (this.tokens.peek().type !== 'TK_SHADER_TYPE') return undefined;
    this.tokens.next();
    const name = this.tokens.next();
    const valid = `Valid types are: ${SHADER_TYPES.map((type) => `'${type}'`).join(', ')}`;
    if (name.type !== 'TK_IDENTIFIER')
      this.tokens.fail(
        `Expected an identifier after 'shader_type', indicating the type of shader. ${valid}.`
      );
    if (!SHADER_TYPES.includes(name.text!)) this.tokens.fail(`Invalid shader type. ${valid}`);
    // Peeked, not read: Godot names the line of the type, not of the token after it.
    if (this.tokens.peek().type !== 'TK_SEMICOLON')
      this.tokens.fail(`Expected a ';' after 'shader_type ${name.text}'.`);
    this.tokens.next();
    return name.text;
  }

  /** `struct Name { members };` (`shader_language.cpp:9314`). */
  private structDefinition(first: Token): StructNode {
    const nameToken = this.tokens.next();
    if (nameToken.type !== 'TK_IDENTIFIER') this.tokens.fail('Expected a struct identifier.');
    const name = nameToken.text!;
    if (this.struct(name)) this.tokens.fail(`Redefinition of '${name}'.`);
    if (this.tokens.next().type !== 'TK_CURLY_BRACKET_OPEN') this.tokens.fail("Expected a '{'.");
    const members: StructMember[] = [];
    for (;;) {
      const token = this.tokens.next();
      if (token.type === 'TK_CURLY_BRACKET_CLOSE') break;
      members.push(...this.memberDeclaration(token, members));
    }
    if (members.length === 0) this.tokens.fail('Empty structs are not allowed.');
    if (this.tokens.next().type !== 'TK_SEMICOLON') this.tokens.fail("Expected a ';'.");
    return { kind: 'struct', name, members, position: first.position };
  }

  /** One line of members, `vec2 a, b[2];`, each name once in the struct. */
  private memberDeclaration(first: Token, declared: readonly StructMember[]): StructMember[] {
    if (first.type === 'TK_STRUCT') this.tokens.fail('Nested structs are not allowed.');
    const typeToken = this.precededType(first, () => this.tokens.fail('Expected data type.'));
    const type =
      typeToken.type === 'TK_IDENTIFIER' && this.struct(typeToken.text!)
        ? typeToken.text!
        : this.memberValueType(typeToken);
    const members: StructMember[] = [];
    let typeSize: number | undefined;
    for (;;) {
      let token = this.tokens.next();
      if (members.length === 0) {
        if (token.type !== 'TK_IDENTIFIER' && token.type !== 'TK_BRACKET_OPEN')
          this.tokens.fail("Expected an identifier or '['.");
        if (token.type === 'TK_BRACKET_OPEN') {
          typeSize = this.expressions.arrays.size(true);
          token = this.tokens.next();
        }
      }
      if (token.type !== 'TK_IDENTIFIER') this.tokens.fail('Expected an identifier.');
      const name = token.text!;
      if ([...declared, ...members].some((member) => member.name === name))
        this.tokens.fail(`Redefinition of '${name}'.`);
      const arraySize = this.tokens.accept('TK_BRACKET_OPEN') ? this.expressions.arrays.size(true) : typeSize;
      members.push({ name, type, ...(arraySize !== undefined ? { arraySize } : {}) });
      const end = this.tokens.next();
      if (end.type === 'TK_SEMICOLON') return members;
      if (end.type !== 'TK_COMMA') this.tokens.fail("Expected a ',' or ';'.");
    }
  }

  /** A member's value type: Godot refuses `void` and the samplers there. */
  private memberValueType(token: Token): string {
    const row = keywordInstruction(token.type);
    if (row?.family !== 'data type') this.tokens.fail('Expected data type.');
    if (shapeOf(row.id) === undefined) this.tokens.fail(`A '${row.id}' data type is not allowed here.`);
    return row.id;
  }

  /** A function, from its return type (`shader_language.cpp:10258`). */
  private functionDefinition(first: Token): FunctionNode {
    const typeToken = this.precededType(first, () => this.refuseGlobal());
    const returnType = this.returnTypeOf(typeToken);
    const returnArraySize = this.tokens.peek().type === 'TK_BRACKET_OPEN' ? this.arraySize() : 0;
    const nameToken = this.tokens.next();
    if (nameToken.type !== 'TK_IDENTIFIER') this.tokens.fail('Expected a function name after type.');
    const rname = nameToken.text!;
    if (this.struct(rname) || this.globals.has(rname) || this.isBuiltInName(rname))
      this.tokens.fail(`Redefinition of '${rname}'.`);
    if (this.tokens.peek().type !== 'TK_PARENTHESIS_OPEN')
      this.refuseGlobalVariable(returnType, returnArraySize);
    this.tokens.next();
    if (this.processors.has(rname)) this.tokens.fail(`Redefinition of '${rname}'.`);
    const args = this.argumentList();
    const header = { rname, returnType, returnArraySize, arguments: args };
    this.stageRules.checkSignature(rname, args.length, returnType);
    const signature = this.stageRules.stage(rname) ? this.processor(header) : this.declare(header);
    this.tokens.expect('TK_CURLY_BRACKET_OPEN', "Expected a '{' to begin function.");
    this.stageRules.begin(signature.name);
    this.current = signature;
    const body = this.statements.body(args, this.globals, this.tokens.lastPosition());
    this.current = undefined;
    if (returnType !== 'void' && !hasReturn(body)) {
      this.tokens.fail("Expected at least one 'return' statement in a non-void function.");
    }
    const { name } = signature;
    return {
      kind: 'function',
      name,
      rname,
      returnType,
      ...(returnArraySize > 0 ? { returnArraySize } : {}),
      arguments: args,
      body,
      position: first.position,
    };
  }

  /** A global with no `const`: Godot reads it as a constant, then refuses it (:10378). */
  private refuseGlobalVariable(type: ValueType, typeSize: number): never {
    let token = this.tokens.next();
    if (type === 'void') this.tokens.fail("Expected '(' after function identifier.");
    const isArray = typeSize > 0 || token.type === 'TK_BRACKET_OPEN';
    if (token.type === 'TK_BRACKET_OPEN') {
      this.expressions.arrays.size(false);
      token = this.tokens.next();
    }
    if (token.type === 'TK_OP_ASSIGN')
      this.tokens.fail(
        "Global non-constant variables are not supported. Expected 'const' keyword before constant definition."
      );
    this.tokens.fail(isArray ? 'Expected array initialization.' : 'Expected initialization of constant.');
  }

  /** A return type: a value type, `void` or a struct's name. Godot refuses a sampler. */
  private returnTypeOf(typeToken: Token): ValueType {
    if (typeToken.type === 'TK_IDENTIFIER' && this.struct(typeToken.text!)) return typeToken.text!;
    if (keywordInstruction(typeToken.type)?.family !== 'data type') this.refuseGlobal();
    const type = this.dataType(typeToken);
    if (shapeOf(type) === undefined && type !== 'void') {
      this.tokens.fail('Invalid function type (samplers are not allowed).');
    }
    return type;
  }

  /** `[n]` of an array type, whose size must be known (`_parse_array_size`). */
  private arraySize(): number {
    this.tokens.next();
    return this.expressions.arrays.size(true)!;
  }

  /** `_validate_precision` (`shader_language.cpp:9117`). `refuse` handles a `const` first. */
  private precededType(first: Token, refuse: () => never): Token {
    if (first.type === 'TK_CONST') refuse();
    if (!isPrecisionToken(first)) return first;
    const typeToken = this.tokens.next();
    const shape = shapeOf(keywordInstruction(typeToken.type)?.id ?? '');
    if (shape?.scalar === 'bool') this.tokens.fail('The precision modifier cannot be used on boolean types.');
    return typeToken;
  }

  private refuseGlobal(): never {
    this.tokens.fail('Expected constant, function, uniform or varying.');
  }

  private dataType(token: Token): string {
    return keywordInstruction(token.type)!.id;
  }

  /** The arguments after `(`, up to `)`; Godot accepts a `,` before the `)` (`shader_language.cpp:10704`). */
  private argumentList(): Argument[] {
    const args: Argument[] = [];
    let token = this.tokens.next();
    while (token.type !== 'TK_PARENTHESIS_CLOSE') {
      args.push(this.argumentDeclaration(token, args));
      token = this.tokens.next();
      if (token.type === 'TK_COMMA') token = this.tokens.next();
      else if (token.type !== 'TK_PARENTHESIS_CLOSE') this.tokens.fail("Expected a ',' or ')'.");
    }
    return args;
  }

  /** `const`, a qualifier, a precision, the type, a size before or after the name (:10724). */
  private argumentDeclaration(first: Token, declared: readonly Argument[]): Argument {
    const isConst = first.type === 'TK_CONST';
    let token = isConst ? this.tokens.next() : first;
    const qualifier = qualifierOf(token);
    if (qualifier) {
      if (isConst && qualifier !== 'in')
        this.tokens.fail(
          `The '${qualifier}' qualifier cannot be used within a function parameter declared with 'const'.`
        );
      token = this.tokens.next();
    }
    const typeToken = this.precededType(token, () =>
      this.tokens.fail('Expected a valid data type for argument.')
    );
    const type = this.argumentType(typeToken);
    let arraySize = this.tokens.peek().type === 'TK_BRACKET_OPEN' ? this.arraySize() : 0;
    const nameToken = this.tokens.next();
    if (nameToken.type !== 'TK_IDENTIFIER') this.tokens.fail('Expected an identifier for argument name.');
    const name = nameToken.text!;
    const isTaken = declared.some((argument) => argument.name === name) || this.globals.has(name);
    if (isTaken || this.isBuiltInName(name)) {
      this.tokens.fail(`Redefinition of '${name}'.`);
    }
    if (this.tokens.peek().type === 'TK_BRACKET_OPEN') arraySize = this.arraySize();
    return {
      name,
      type,
      qualifier: qualifier ?? 'in',
      ...(isConst ? { isConst } : {}),
      ...(arraySize > 0 ? { arraySize } : {}),
      position: nameToken.position,
    };
  }

  /** An argument's type: a struct's name or a data type other than `void`. */
  private argumentType(typeToken: Token): ValueType {
    if (typeToken.type === 'TK_IDENTIFIER' && this.struct(typeToken.text!)) return typeToken.text!;
    if (keywordInstruction(typeToken.type)?.family !== 'data type' || typeToken.type === 'TK_STRUCT') {
      this.tokens.fail('Expected a valid data type for argument.');
    }
    const type = this.dataType(typeToken);
    if (type === 'void') this.tokens.fail('Void type not allowed as argument.');
    return type;
  }

  /** A processor function, which keeps its name and which no call reaches. */
  private processor(header: Omit<FunctionSignature, 'name'>): FunctionSignature {
    this.processors.add(header.rname);
    return { name: header.rname, ...header };
  }

  /** `f@2` names the second `f`. Godot refuses equal argument types and sizes (:10921). */
  private declare(header: Omit<FunctionSignature, 'name'>): FunctionSignature {
    const overloads = this.signatures.get(header.rname) ?? [];
    if (overloads.some((declared) => isSameArguments(declared.arguments, header.arguments)))
      this.tokens.fail(`Redefinition of '${header.rname}'.`);
    const name = overloads.length === 0 ? header.rname : `${header.rname}@${overloads.length + 1}`;
    const signature = { name, ...header };
    this.signatures.set(header.rname, [...overloads, signature]);
    return signature;
  }
}

/** The parameter qualifier a token names, from its row of the table: `in`, `out` or `inout`. */
function qualifierOf(token: Token): Qualifier | undefined {
  if (!token.type.startsWith('TK_ARG_')) return undefined;
  return keywordInstruction(token.type)?.id as Qualifier | undefined;
}

const isSameArguments = (a: readonly Argument[], b: readonly Argument[]) =>
  a.length === b.length &&
  a.every(
    (argument, index) => argument.type === b[index]!.type && argument.arraySize === b[index]!.arraySize
  );

const isUniformWord = (type: string) =>
  type === 'TK_UNIFORM' || type === 'TK_GLOBAL' || type === 'TK_INSTANCE';

/** Searches as `_find_last_flow_op_in_block` does (`shader_language.cpp:11088`). */
function hasReturn(block: BlockNode): boolean {
  for (const statement of everyStatement(block)) if (isReturn(statement)) return true;
  return false;
}
