/**
 * The preprocessor of a template variant, with glslang's rules (`preprocessor/Pp.cpp`), the one
 * Godot's GLSL goes through: object-like and function-like macros, `#if` and its kin with a define
 * set, `defined`, and the directives the parser keeps: `#version`, `#extension` and `#pragma`.
 * It records each conditional branch it decides, so a test can see that every branch of a template
 * is read under some define set.
 */

import { ShadingLanguageError, type SourcePosition } from '../language/shadingLanguageError.js';
import { evaluateCondition } from './ppCondition.js';
import { type PpToken, scanLines } from './ppScanner.js';
import type { VariantLine } from './variant.js';

/** A directive the parser keeps in the tree: `#version 450`, `#extension GL_EXT_multiview : enable`. */
export interface KeptDirective {
  readonly name: 'version' | 'extension' | 'pragma';
  /** The tokens after the directive's name, as text joined by spaces. */
  readonly text: string;
  readonly position: SourcePosition;
}

/** One branch of a conditional: `#if`, `#ifdef`, `#ifndef`, `#elif` or `#else`, and whether it is read. */
export interface BranchRecord {
  readonly file: string;
  readonly line: number;
  readonly directive: string;
  readonly isTaken: boolean;
}

export interface Preprocessed {
  /** The tokens the parser reads: no line ends, no directives. */
  readonly tokens: readonly PpToken[];
  readonly directives: readonly KeptDirective[];
  /** The branches decided, in the order of the text. A branch inside a branch not read is not decided. */
  readonly branches: readonly BranchRecord[];
}

export interface Macro {
  readonly name: string;
  /** The parameter names of a function-like macro, nothing for an object-like one. */
  readonly parameters?: readonly string[];
  readonly body: readonly PpToken[];
  /** Set while the macro's expansion is read: glslang expands no macro inside its own expansion. */
  busy: boolean;
}

/** The preprocessed text of `lines`, under `macros` defined before its first line. */
export function preprocess(
  lines: readonly VariantLine[],
  macros: ReadonlyMap<string, Macro> = new Map()
): Preprocessed {
  return new Preprocessor(scanLines(lines), macros).run();
}

/** An input the preprocessor reads tokens from: the text, a macro's expansion or a macro argument. */
interface Input {
  readonly tokens: readonly PpToken[];
  index: number;
  readonly macro?: Macro;
}

/** A conditional open at this point: whether its current branch is read, and whether one was. */
interface Conditional {
  readonly isOuterActive: boolean;
  isActive: boolean;
  wasTaken: boolean;
  sawElse: boolean;
}

/** Tokens that no macro expands again: glslang's `fullyExpanded`. */
const FULLY_EXPANDED = new WeakSet<PpToken>();

class Preprocessor {
  readonly macros = new Map<string, Macro>();
  private readonly inputs: Input[] = [];
  private readonly base: Input;
  private readonly conditionals: Conditional[] = [];
  private readonly directives: KeptDirective[] = [];
  private readonly branches: BranchRecord[] = [];
  private atLineStart = true;

  constructor(tokens: readonly PpToken[], macros: ReadonlyMap<string, Macro>) {
    this.base = { tokens, index: 0 };
    for (const [name, macro] of macros) this.macros.set(name, macro);
  }

  run(): Preprocessed {
    const tokens: PpToken[] = [];
    for (;;) {
      const token = this.nextExpanded(true);
      if (token.kind === 'end') break;
      if (token.kind === 'slot') tokens.push({ ...token, macros: new Map(this.macros) });
      else if (token.kind !== 'newline') tokens.push(token);
    }
    if (this.conditionals.length > 0)
      this.fail("'#endif' : missing #endif", this.base.tokens.at(-1)!.position);
    return { tokens, directives: this.directives, branches: this.branches };
  }

  private isActive(): boolean {
    return this.conditionals.at(-1)?.isActive ?? true;
  }

  /** The next token with macros expanded. */
  nextExpanded(fromText: boolean): PpToken {
    for (;;) {
      const token = fromText ? this.nextRaw() : this.nextFromInputs();
      if (token.kind !== 'identifier' || FULLY_EXPANDED.has(token)) return token;
      const macro = this.macros.get(token.text);
      if (!macro) return token;
      if (macro.busy) {
        FULLY_EXPANDED.add(token);
        return token;
      }
      if (!this.expand(macro, token, fromText)) return token;
    }
  }

  /** A token from a macro's expansion or argument, or the end when they run out. */
  private nextFromInputs(): PpToken {
    for (;;) {
      const input = this.inputs.at(-1);
      if (!input) return END;
      const token = input.tokens[input.index];
      if (token) {
        input.index += 1;
        return token;
      }
      if (input === this.argumentInput) return END;
      this.inputs.pop();
      if (input.macro) input.macro.busy = false;
    }
  }

  /** Set while a macro argument is expanded: its end ends that expansion. */
  private argumentInput: Input | undefined;

  /** The next token of the text, past the directives and the lines of branches not read. */
  private nextRaw(): PpToken {
    if (this.inputs.length > 0) {
      const token = this.nextFromInputs();
      if (token !== END) return token;
    }
    for (;;) {
      const token = this.base.tokens[this.base.index]!;
      if (token.kind !== 'end') this.base.index += 1;
      const lineStart = this.atLineStart;
      this.atLineStart = token.kind === 'newline';
      if (lineStart && token.kind === 'punctuator' && token.text === '#') {
        this.directive(token);
        this.atLineStart = true;
        continue;
      }
      if (token.kind === 'end' || this.isActive()) return token;
    }
  }

  /** The tokens of the directive line after `#`, up to its line end. */
  private directiveLine(): PpToken[] {
    const tokens: PpToken[] = [];
    for (;;) {
      const token = this.base.tokens[this.base.index]!;
      if (token.kind === 'end') return tokens;
      this.base.index += 1;
      if (token.kind === 'newline') return tokens;
      tokens.push(token);
    }
  }

  private directive(hash: PpToken): void {
    const line = this.directiveLine();
    const [name, ...rest] = line;
    const word = name?.kind === 'identifier' ? name.text : '';
    if (isConditional(word)) return this.conditional(word, rest, hash);
    if (!this.isActive()) return;
    switch (word) {
      case '':
        if (name) this.fail(`'#' : invalid directive`, hash.position);
        return;
      case 'define':
        return this.define(rest, hash);
      case 'undef':
        if (rest[0]?.kind !== 'identifier')
          this.fail("'#undef' : must be followed by macro name", hash.position);
        this.macros.delete(rest[0].text);
        return;
      case 'version':
      case 'extension':
      case 'pragma':
        this.directives.push({
          name: word,
          text: rest.map((token) => token.text).join(' '),
          position: hash.position,
        });
        return;
      case 'error':
        this.fail(`'#error' : ${rest.map((token) => token.text).join(' ')}`, hash.position);
        return;
      case 'include':
        this.fail(
          "'#include' : required extension not requested: GL_GOOGLE_include_directive or GL_ARB_shading_language_include",
          hash.position
        );
        return;
      default:
        this.fail(`'#' : invalid directive: ${word}`, hash.position);
    }
  }

  /** `#define`, with glslang's checks (`Pp.cpp:96`). */
  private define(tokens: readonly PpToken[], hash: PpToken): void {
    const [name, ...rest] = tokens;
    if (name?.kind !== 'identifier') this.fail("'#define' : must be followed by macro name", hash.position);
    if (name.text.startsWith('GL_'))
      this.fail(`'#define' : names beginning with "GL_" can't be (un)defined: ${name.text}`, name.position);
    let body = rest;
    let parameters: string[] | undefined;
    if (rest[0]?.text === '(' && !rest[0].space) {
      const close = rest.findIndex((token) => token.text === ')');
      if (close === -1) this.fail("'#define' : missing parenthesis", name.position);
      parameters = rest
        .slice(1, close)
        .filter((token) => token.text !== ',')
        .map((token) => token.text);
      body = rest.slice(close + 1);
    }
    const existing = this.macros.get(name.text);
    const macro: Macro = { name: name.text, ...(parameters ? { parameters } : {}), body, busy: false };
    if (existing && !isSameMacro(existing, macro))
      this.fail(`'#define' : Macro redefined; different substitutions: ${name.text}`, name.position);
    this.macros.set(name.text, macro);
  }

  /** `#if`, `#ifdef`, `#ifndef`, `#elif`, `#else` and `#endif`. */
  private conditional(word: string, rest: readonly PpToken[], hash: PpToken): void {
    const position = hash.position;
    if (word === 'if' || word === 'ifdef' || word === 'ifndef') {
      const isOuterActive = this.isActive();
      const isTaken = isOuterActive && this.condition(word, rest, hash);
      this.conditionals.push({ isOuterActive, isActive: isTaken, wasTaken: isTaken, sawElse: false });
      if (isOuterActive) this.record(word, position, isTaken);
      return;
    }
    const open = this.conditionals.at(-1);
    if (!open) this.fail(`'#${word}' : unexpected tokens following directive`, position);
    if (word === 'endif') {
      this.conditionals.pop();
      return;
    }
    if (open.sawElse) this.fail(`'#${word}' : #${word} after #else`, position);
    if (word === 'else') open.sawElse = true;
    const isTaken =
      open.isOuterActive && !open.wasTaken && (word === 'else' || this.condition('if', rest, hash));
    open.isActive = isTaken;
    open.wasTaken ||= isTaken;
    if (open.isOuterActive) this.record(word, position, isTaken);
  }

  private record(directive: string, position: SourcePosition, isTaken: boolean): void {
    this.branches.push({ file: position.file, line: position.line, directive, isTaken });
  }

  private condition(word: string, rest: readonly PpToken[], hash: PpToken): boolean {
    if (word === 'if') return evaluateCondition(rest, this, hash.position) !== 0;
    if (rest[0]?.kind !== 'identifier')
      this.fail(`'#${word}' : must be followed by macro name`, hash.position);
    return this.macros.has(rest[0].text) === (word === 'ifdef');
  }

  /**
   * Starts the expansion of `macro` at `name`: a function-like macro needs its `(` next, or it
   * stays a name. Gives whether the expansion started.
   */
  private expand(macro: Macro, name: PpToken, fromText: boolean): boolean {
    if (!macro.parameters) {
      this.pushExpansion(macro, macro.body, name);
      return true;
    }
    const args = this.macroArguments(macro, name, fromText);
    if (!args) return false;
    const expandedArgs = args.map((arg) => this.expandedArgument(arg));
    const body = macro.body.flatMap((token) => {
      const index = token.kind === 'identifier' ? macro.parameters!.indexOf(token.text) : -1;
      return index === -1 ? [token] : expandedArgs[index]!;
    });
    this.pushExpansion(macro, body, name);
    return true;
  }

  /** Pushes a macro's tokens, each at the place of the name it replaces, as glslang reports them. */
  private pushExpansion(macro: Macro, tokens: readonly PpToken[], name: PpToken): void {
    macro.busy = true;
    const placed = tokens.map((token) => ({ ...token, position: name.position }));
    this.inputs.push({ tokens: placed, index: 0, macro });
  }

  /**
   * The arguments of a call of a function-like macro, or nothing when no `(` follows the name.
   * Line ends inside the call are white space, as in glslang's text.
   */
  private macroArguments(macro: Macro, name: PpToken, fromText: boolean): PpToken[][] | undefined {
    const read = () => (fromText ? this.nextRaw() : this.nextFromInputs());
    let open = read();
    while (open.kind === 'newline') open = read();
    if (open.text !== '(') {
      // glslang gives back the one token it read, and the line ends before it stay read.
      if (open !== END) this.inputs.push({ tokens: [open], index: 0 });
      return undefined;
    }
    const args: PpToken[][] = [[]];
    let depth = 0;
    for (;;) {
      const token = read();
      if (token.kind === 'end')
        this.fail(`'macro expansion' : End of input in macro ${macro.name}`, name.position);
      if (token.kind === 'newline') continue;
      if (depth === 0 && (token.text === ',' || token.text === ')')) {
        if (token.text === ')') break;
        args.push([]);
        continue;
      }
      if (token.text === '(') depth += 1;
      if (token.text === ')') depth -= 1;
      args.at(-1)!.push(token);
    }
    const count = macro.parameters!.length;
    if (count === 0 && args.length === 1 && args[0]!.length === 0) return [];
    if (args.length < count)
      this.fail(`'macro expansion' : Too few args in Macro ${macro.name}`, name.position);
    if (args.length > count)
      this.fail(`'macro expansion' : Too many args in Macro ${macro.name}`, name.position);
    return args;
  }

  /** An argument with its macros expanded, before it takes a parameter's place (`PrescanMacroArg`). */
  expandedArgument(tokens: readonly PpToken[]): PpToken[] {
    const outer = this.argumentInput;
    const input: Input = { tokens, index: 0 };
    this.argumentInput = input;
    this.inputs.push(input);
    const expanded: PpToken[] = [];
    try {
      for (;;) {
        const token = this.nextExpanded(false);
        if (token === END) return expanded;
        expanded.push(token);
      }
    } finally {
      this.inputs.splice(this.inputs.indexOf(input), 1);
      this.argumentInput = outer;
    }
  }

  fail(message: string, position: SourcePosition): never {
    throw new ShadingLanguageError(message, position);
  }
}

const END: PpToken = { kind: 'end', text: '', position: { file: '', line: 0, column: 0 }, space: false };

const isConditional = (word: string) => ['if', 'ifdef', 'ifndef', 'elif', 'else', 'endif'].includes(word);

/** glslang's identical replacement lists: the same tokens and the same spaces between them. */
function isSameMacro(a: Macro, b: Macro): boolean {
  if (a.parameters?.join(',') !== b.parameters?.join(',')) return false;
  if (a.body.length !== b.body.length) return false;
  return a.body.every(
    (token, index) =>
      token.text === b.body[index]!.text && (index === 0 || token.space === b.body[index]!.space)
  );
}
