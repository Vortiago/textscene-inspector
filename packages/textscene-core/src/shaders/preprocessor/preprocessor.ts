import { instruction, notTranspiled } from '../language/instructions.js';
import { stripComments } from './commentRemover.js';
import { DirectiveTokenizer } from './directiveTokenizer.js';
import { baseDir, isRelativePath, pathJoin, simplifyPath } from './godotPath.js';
import { END, isCharEnd, isCharSpace, stripEdges } from './godotString.js';
import { type Define, expandMacros } from './macros.js';
import { PreprocessorError } from './preprocessorError.js';

/** `path` is the loaded resource's path, which marks the include and keeps it from loading twice. */
export interface ShaderInclude {
  readonly path: string;
  readonly code: string;
}

/** The project's `rendering/renderer/rendering_method`. */
export type RenderingMethod = 'forward_plus' | 'mobile' | 'gl_compatibility';

export interface PreprocessOptions {
  readonly file?: string;
  /** Nothing when the file is missing. A path with no `res://` is relative to the project. */
  readonly readInclude?: (path: string) => ShaderInclude | undefined;
  readonly renderingMethod?: RenderingMethod;
}

/** shader_preprocessor.cpp:1353 */
const RENDERERS: Readonly<Record<RenderingMethod, string>> = {
  gl_compatibility: '0',
  mobile: '1',
  forward_plus: '2',
};

const INCLUDE_DEPTH_AT_MOST = 25;

interface Branch {
  readonly conditions: boolean[];
  readonly parent: Branch | undefined;
  isElseDefined: boolean;
}

/** Shared by the shader and every file it includes. */
interface State {
  readonly defines: Map<string, Define>;
  currentBranch: Branch | undefined;
  conditionDepth: number;
  readonly includes: Set<string>;
  // Godot keeps hashes of the open texts, so two files of one text count as a cycle.
  readonly openTexts: string[];
  includeDepth: number;
  currentFile: string;
  isDisabled: boolean;
  readonly readInclude: (path: string) => ShaderInclude | undefined;
}

/** Throws `PreprocessorError` for a text Godot's preprocessor refuses. */
export function preprocess(code: string, options: PreprocessOptions = {}): string {
  const renderer = RENDERERS[options.renderingMethod ?? 'forward_plus'];
  const builtIn = (body: string): Define => ({ body, arguments: [], isBuiltIn: true });
  const state: State = {
    defines: new Map([
      ['CURRENT_RENDERER', builtIn(renderer)],
      ['RENDERER_COMPATIBILITY', builtIn(RENDERERS.gl_compatibility)],
      ['RENDERER_MOBILE', builtIn(RENDERERS.mobile)],
      ['RENDERER_FORWARD_PLUS', builtIn(RENDERERS.forward_plus)],
    ]),
    currentBranch: undefined,
    conditionDepth: 0,
    includes: new Set(),
    openTexts: [],
    includeDepth: 0,
    currentFile: options.file ?? '',
    isDisabled: false,
    readInclude: options.readInclude ?? (() => undefined),
  };
  return new FilePreprocessor(state).run(code);
}

class FilePreprocessor {
  private output = '';
  private tokenizer = new DirectiveTokenizer('');

  constructor(private readonly state: State) {}

  run(code: string): string {
    try {
      return this.read(code);
    } catch (error) {
      if (!(error instanceof PreprocessorError) || error.file !== '') throw error;
      throw new PreprocessorError(error.reason, error.line, this.state.currentFile);
    }
  }

  /** shader_preprocessor.cpp:1264 */
  private read(code: string): string {
    const stripped = stripComments(code);
    if (stripped.error) throw new PreprocessorError(stripped.error.message, stripped.error.line);
    this.state.openTexts.push(code);
    this.tokenizer = new DirectiveTokenizer(stripped.code);
    let lineStart = 0;
    let hasSymbolsBeforeDirective = false;
    for (let token = this.tokenizer.token(); token !== END; token = this.tokenizer.token()) {
      this.output += this.tokenizer.takeGenerated();
      if (this.state.isDisabled) {
        this.output += token;
      } else if (token === '#') {
        if (hasSymbolsBeforeDirective)
          throw new PreprocessorError('Invalid symbols placed before directive.', this.tokenizer.line);
        this.directive();
      } else {
        if (isCharEnd(token)) {
          this.expandOutputMacros(lineStart, this.tokenizer.line);
          lineStart = this.output.length;
          hasSymbolsBeforeDirective = false;
        } else if (!isCharSpace(token)) {
          hasSymbolsBeforeDirective = true;
        }
        this.output += token;
      }
    }
    this.state.openTexts.splice(this.state.openTexts.indexOf(code), 1);
    if (!this.state.isDisabled) {
      if (this.state.conditionDepth !== 0)
        throw new PreprocessorError('Unmatched conditional statement.', this.tokenizer.line);
      this.expandOutputMacros(lineStart, this.tokenizer.line);
    }
    return this.output;
  }

  // The tokenizer is already on the next line.
  private expandOutputMacros(start: number, line: number): void {
    this.output =
      this.output.slice(0, start) + expandMacros(this.output.slice(start), this.state.defines, line - 1);
  }

  /** shader_preprocessor.cpp:377 */
  private directive(): void {
    const name = this.tokenizer.identifier(true);
    switch (name) {
      case 'if':
      case 'elif':
        throw notTranspiled(instruction(`#${name}`)!, {
          file: this.state.currentFile,
          line: this.tokenizer.line + 1,
          column: 1,
        });
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
    this.output += `@@>${include.path}\n${this.includedText(include, line)}\n@@<${include.path}\n`;
  }

  private resolvedPath(quoted: string): string {
    const path = simplifyPath(quoted);
    return isRelativePath(path) ? pathJoin(baseDir(this.state.currentFile), path) : path;
  }

  private includedText(include: ShaderInclude, line: number): string {
    const { state } = this;
    state.includeDepth += 1;
    if (state.includeDepth > INCLUDE_DEPTH_AT_MOST)
      throw new PreprocessorError('Shader max include depth exceeded.', line);
    const outerFile = state.currentFile;
    const outerDepth = state.conditionDepth;
    state.currentFile = include.path;
    state.conditionDepth = 0;
    const text = new FilePreprocessor(state).run(include.code);
    state.currentFile = outerFile;
    state.conditionDepth = outerDepth;
    state.includeDepth -= 1;
    return text;
  }
}
