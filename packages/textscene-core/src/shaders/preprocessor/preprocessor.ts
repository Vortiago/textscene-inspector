import { decodersOf, type ShaderDecoders } from './decoders.js';
import { stripComments, type StrippedCode } from './commentRemover.js';
import { conditionRefusal, isConditionTrue } from './conditions.js';
import { DirectiveTokenizer } from './directiveTokenizer.js';
import { utilityHost, type UtilityHost } from '../../godot/variant/utility/utilityHost.js';
import { getBaseDir, isAbsolutePath, pathJoin, simplifyPath, stripEdges } from '../../godot/string/string.js';
import { PreprocessedOutput } from './preprocessedOutput.js';
import { END, isCharEnd, isCharSpace } from './preprocessorChars.js';
import { type Define, Defines, expandMacros } from './macros.js';
import { PreprocessorError } from './preprocessorError.js';
import type { Renderer, RenderingMethod } from './renderingMethod.js';

/** `path` is the loaded resource's path, which marks the include and keeps it from loading twice. */
export interface ShaderInclude {
  readonly path: string;
  readonly code: string;
}

export interface PreprocessOptions {
  readonly file?: string;
  /** Nothing when the file is missing, which `str_to_var` of a `Resource(...)` also asks. */
  readonly readInclude?: (path: string) => ShaderInclude | undefined;
  readonly renderingMethod?: RenderingMethod;
  readonly decoders?: ShaderDecoders;
}

/** shader_preprocessor.cpp:1353 */
const RENDERERS: Readonly<Record<Renderer, string>> = {
  gl_compatibility: '0',
  mobile: '1',
  forward_plus: '2',
};

/** Any method but Forward+ and Mobile is compatibility here (`shader_preprocessor.cpp:1352-1358`). */
function currentRenderer(method: RenderingMethod): string {
  if (method === 'forward_plus') return RENDERERS.forward_plus;
  return method === 'mobile' ? RENDERERS.mobile : RENDERERS.gl_compatibility;
}

// shader_preprocessor.cpp:752
const INCLUDE_DEPTH_AT_MOST = 25;

interface Branch {
  readonly conditions: boolean[];
  readonly parent: Branch | undefined;
  isElseDefined: boolean;
}

/** Shared by the shader and every file it includes. */
interface State {
  readonly defines: Defines;
  readonly host: UtilityHost;
  currentBranch: Branch | undefined;
  conditionDepth: number;
  readonly includes: Set<string>;
  // Godot keeps hashes of the open texts, so two files of one text count as a cycle.
  readonly openTexts: string[];
  currentFile: string;
  isDisabled: boolean;
  readonly readInclude: (path: string) => ShaderInclude | undefined;
}

/** Throws `PreprocessorError` for a text Godot's preprocessor refuses. */
export function preprocess(code: string, options: PreprocessOptions = {}): string {
  const renderer = currentRenderer(options.renderingMethod ?? 'forward_plus');
  const builtIn = (body: string): Define => ({ body, arguments: [], isBuiltIn: true });
  const readInclude = options.readInclude ?? (() => undefined);
  const state: State = {
    defines: new Defines([
      ['CURRENT_RENDERER', builtIn(renderer)],
      ['RENDERER_COMPATIBILITY', builtIn(RENDERERS.gl_compatibility)],
      ['RENDERER_MOBILE', builtIn(RENDERERS.mobile)],
      ['RENDERER_FORWARD_PLUS', builtIn(RENDERERS.forward_plus)],
    ]),
    host: utilityHost((path) => readInclude(path) !== undefined, decodersOf(options.decoders)),
    currentBranch: undefined,
    conditionDepth: 0,
    includes: new Set(),
    openTexts: [],
    currentFile: options.file ?? '',
    isDisabled: false,
    readInclude,
  };
  return new FilePreprocessor(state, code).run();
}

// One file's text. Its include runs a FilePreprocessor of its own over the same state.
class FilePreprocessor {
  private readonly output = new PreprocessedOutput();
  private readonly tokenizer: DirectiveTokenizer;
  private readonly stripped: StrippedCode;

  constructor(
    private readonly state: State,
    private readonly code: string
  ) {
    this.stripped = stripComments(code);
    this.tokenizer = new DirectiveTokenizer(this.stripped.code);
  }

  run(): string {
    try {
      return this.read();
    } catch (error) {
      if (!(error instanceof PreprocessorError) || error.file !== '') throw error;
      throw new PreprocessorError(error.reason, error.line, this.state.currentFile);
    }
  }

  /** shader_preprocessor.cpp:1264 */
  private read(): string {
    const { error } = this.stripped;
    if (error) throw new PreprocessorError(error.message, error.line);
    this.state.openTexts.push(this.code);
    let hasSymbolsBeforeDirective = false;
    for (let token = this.tokenizer.token(); token !== END; token = this.tokenizer.token()) {
      this.output.append(this.tokenizer.takeGenerated());
      if (this.state.isDisabled) {
        this.output.append(token);
      } else if (token === '#') {
        if (hasSymbolsBeforeDirective)
          throw new PreprocessorError('Invalid symbols placed before directive.', this.tokenizer.line);
        this.directive();
      } else {
        if (isCharEnd(token)) {
          this.expandOutputMacros(this.tokenizer.line);
          hasSymbolsBeforeDirective = false;
        } else if (!isCharSpace(token)) {
          hasSymbolsBeforeDirective = true;
        }
        this.output.append(token);
      }
    }
    this.state.openTexts.splice(this.state.openTexts.indexOf(this.code), 1);
    if (!this.state.isDisabled) {
      if (this.state.conditionDepth !== 0)
        throw new PreprocessorError('Unmatched conditional statement.', this.tokenizer.line);
      this.expandOutputMacros(this.tokenizer.line);
    }
    return this.output.text();
  }

  // The tokenizer is already on the next line.
  private expandOutputMacros(line: number): void {
    this.output.expandOpenText((text) => expandMacros(text, this.state.defines, line - 1));
  }

  /** shader_preprocessor.cpp:377 */
  private directive(): void {
    const column = this.tokenizer.columnOfLast();
    const name = this.tokenizer.directiveName();
    switch (name) {
      case 'if':
        return this.if(column);
      case 'elif':
        return this.elif(column);
      case 'ifdef':
        return this.ifdef(true);
      case 'ifndef':
        return this.ifdef(false);
      case 'else':
        return this.else();
      case 'endif':
        return this.endif();
      case 'error':
        return this.error();
      case 'define':
        return this.define();
      case 'undef':
        return this.undef();
      case 'include':
        return this.include();
      case 'pragma':
        return this.pragma();
      default:
        throw new PreprocessorError('Unknown directive.', this.tokenizer.line);
    }
  }

  private define(): void {
    const line = this.tokenizer.line;
    const label = this.tokenizer.identifier();
    if (label === '') throw new PreprocessorError('Invalid macro name.', line);
    if (this.state.defines.has(label)) throw new PreprocessorError('Macro redefinition.', line);
    const names = this.tokenizer.peek() === '(' ? this.argumentNames(line) : [];
    const body = stripEdges(this.tokenizer.advance('\n'));
    if (body.startsWith('##'))
      throw new PreprocessorError("'##' must not appear at beginning of macro expansion.", line);
    if (body.endsWith('##'))
      throw new PreprocessorError("'##' must not appear at end of macro expansion.", line);
    this.state.defines.set(label, { body, arguments: names, isBuiltIn: false });
  }

  private argumentNames(line: number): string[] {
    this.tokenizer.token();
    const names: string[] = [];
    for (;;) {
      const name = this.tokenizer.identifier();
      if (name === '') throw new PreprocessorError('Invalid argument name.', line);
      names.push(name);
      this.tokenizer.skipWhitespace();
      const next = this.tokenizer.token();
      if (next === ')') return names;
      if (next !== ',') throw new PreprocessorError('Expected a comma in the macro argument list.', line);
    }
  }

  private undef(): void {
    const line = this.tokenizer.line;
    const label = this.tokenizer.identifier();
    if (label === '' || !this.tokenizer.consumeEmptyLine())
      throw new PreprocessorError("Invalid 'undef' directive.", line);
    if (this.state.defines.get(label)?.isBuiltIn)
      throw new PreprocessorError("Cannot use 'undef' on built-in define.", line);
    this.state.defines.delete(label);
  }

  private ifdef(isDefinedTaken: boolean): void {
    const line = this.tokenizer.line;
    const label = this.tokenizer.identifier();
    if (label === '') throw new PreprocessorError('Invalid macro name.', line);
    if (!this.tokenizer.consumeEmptyLine())
      throw new PreprocessorError(`Invalid '${isDefinedTaken ? 'ifdef' : 'ifndef'}' directive.`, line);
    this.startBranch(this.state.defines.has(label) === isDefinedTaken);
  }

  private if(column: number): void {
    this.startBranch(this.isConditionTrue('if', column));
  }

  // Godot evaluates the condition even after a taken branch, so its errors still show.
  private elif(column: number): void {
    const line = this.tokenizer.line;
    const branch = this.state.currentBranch;
    if (branch === undefined || branch.isElseDefined)
      throw new PreprocessorError("Unmatched 'elif' directive.", line);
    const isTrue = this.isConditionTrue('elif', column);
    const isTaken = isTrue && !branch.conditions.some((wasTaken) => wasTaken);
    branch.conditions.push(isTaken);
    if (!isTaken) this.skipToDirective(['elif', 'else', 'endif']);
  }

  private isConditionTrue(directive: 'if' | 'elif', column: number): boolean {
    const line = this.tokenizer.line;
    const condition = stripEdges(this.tokenizer.advance('\n'));
    try {
      return isConditionTrue(condition, this.state, line);
    } catch (error) {
      const position = { file: this.state.currentFile, line: line + 1, column };
      throw conditionRefusal(error, directive, `#${directive} ${condition}`, position);
    }
  }

  private startBranch(isTaken: boolean): void {
    this.state.conditionDepth += 1;
    this.state.currentBranch = {
      conditions: [isTaken],
      parent: this.state.currentBranch,
      isElseDefined: false,
    };
    if (!isTaken) this.skipToDirective(['elif', 'else', 'endif']);
  }

  private else(): void {
    const line = this.tokenizer.line;
    const branch = this.state.currentBranch;
    if (branch === undefined || branch.isElseDefined)
      throw new PreprocessorError("Unmatched 'else' directive.", line);
    if (!this.tokenizer.consumeEmptyLine()) throw new PreprocessorError("Invalid 'else' directive.", line);
    branch.isElseDefined = true;
    if (branch.conditions.some((isTaken) => isTaken)) this.skipToDirective(['endif']);
  }

  private endif(): void {
    const line = this.tokenizer.line;
    this.state.conditionDepth -= 1;
    if (this.state.conditionDepth < 0) throw new PreprocessorError("Unmatched 'endif' directive.", line);
    if (!this.tokenizer.consumeEmptyLine()) throw new PreprocessorError("Invalid 'endif' directive.", line);
    this.state.currentBranch = this.state.currentBranch?.parent;
  }

  /** shader_preprocessor.cpp:1193 */
  private skipToDirective(directives: readonly string[]): void {
    const line = this.tokenizer.line;
    let nesting = 0;
    for (;;) {
      this.tokenizer.advance('#');
      const id = this.tokenizer.peekIdentifier();
      if (id === '') break;
      if (nesting === 0 && directives.includes(id)) {
        this.tokenizer.backtrack('#');
        return;
      }
      if (id === 'ifdef' || id === 'ifndef' || id === 'if') nesting += 1;
      else if (id === 'endif') nesting -= 1;
    }
    throw new PreprocessorError("Can't find matching branch directive.", line);
  }

  private error(): void {
    const line = this.tokenizer.line;
    throw new PreprocessorError(stripEdges(this.tokenizer.advance('\n')) || ' ', line);
  }

  private pragma(): void {
    const line = this.tokenizer.line;
    const label = this.tokenizer.identifier();
    if (label !== 'disable_preprocessor') throw new PreprocessorError("Invalid 'pragma' directive.", line);
    this.state.isDisabled = true;
    if (!this.tokenizer.consumeEmptyLine()) throw new PreprocessorError("Invalid 'pragma' directive.", line);
  }

  /** shader_preprocessor.cpp:686 */
  private include(): void {
    const line = this.tokenizer.line;
    this.tokenizer.advance('"');
    const quoted = this.tokenizer.advance('"').slice(0, -1);
    if (quoted === '' || !this.tokenizer.consumeEmptyLine())
      throw new PreprocessorError('Invalid path.', line);
    const path = this.resolvedPath(quoted);
    const include = this.state.readInclude(path);
    // Godot words a failed load and a wrong type apart, but a game refuses all three alike.
    if (include === undefined)
      throw new PreprocessorError(`Shader include file does not exist: ${path}`, line);
    if (include.code !== '' && this.state.openTexts.includes(include.code))
      throw new PreprocessorError(`Cyclic include found: ${path}`, line);
    if (this.state.includes.has(include.path)) return;
    this.state.includes.add(include.path);
    this.output.append(`@@>${include.path}\n${this.includedText(include, line)}\n@@<${include.path}\n`);
  }

  private resolvedPath(quoted: string): string {
    const path = simplifyPath(quoted);
    return isAbsolutePath(path) ? path : pathJoin(getBaseDir(this.state.currentFile), path);
  }

  private includedText(include: ShaderInclude, line: number): string {
    const { state } = this;
    if (state.openTexts.length > INCLUDE_DEPTH_AT_MOST)
      throw new PreprocessorError('Shader max include depth exceeded.', line);
    const outerFile = state.currentFile;
    const outerDepth = state.conditionDepth;
    state.currentFile = include.path;
    state.conditionDepth = 0;
    const text = new FilePreprocessor(state, include.code).run();
    state.currentFile = outerFile;
    state.conditionDepth = outerDepth;
    return text;
  }
}
