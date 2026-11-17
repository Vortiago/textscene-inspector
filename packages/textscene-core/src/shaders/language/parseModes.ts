import { doubleToInt32 } from '../../godot/variant/cInteger.js';
import { godotIntegerConstant } from './godotNumber.js';
import { SHADER_MODES, type ShaderMode } from './instructionTable.generated.js';
import { tokenText } from './parseExpression.js';
import type { ShaderModeNode } from './shaderTree.js';
import type { TokenCursor } from './tokenCursor.js';
import type { Token } from './tokenizer.js';

type ModeKind = ShaderMode['kind'];

/** The words Godot's messages name each kind by. */
const WORDS: Readonly<Record<ModeKind, string>> = { render_mode: 'render', stencil_mode: 'stencil' };

/** The largest stencil reference value, which fits the 8 bits of the stencil buffer. */
const MAX_STENCIL_REFERENCE = 255;

/** The `render_mode` and `stencil_mode` statements of a shader (`shader_language.cpp:9238`). */
export class ModeParser {
  readonly modes: Readonly<Record<ModeKind, ShaderModeNode[]>> = { render_mode: [], stencil_mode: [] };
  /** Written only by `stencilModeStatement`. */
  stencilReference: number | undefined;
  /** Each mode with values set so far, by its name, `blend`, to the name the text sets, `blend_mix`. */
  private readonly defined: Readonly<Record<ModeKind, Map<string, string>>> = {
    render_mode: new Map(),
    stencil_mode: new Map(),
  };

  constructor(
    private readonly tokens: TokenCursor,
    private readonly shaderType: () => string | undefined
  ) {}

  /** The names after `render_mode`, up to its `;`. */
  renderModeStatement(): void {
    do this.mode('render_mode');
    while (this.isListGoingOn());
  }

  /** The names and the reference value after `stencil_mode`, up to its `;`. */
  stencilModeStatement(): void {
    do {
      const mark = this.tokens.mark();
      const token = this.tokens.next();
      if (isIntegerConstant(token)) this.reference(token);
      else {
        this.tokens.reset(mark);
        this.mode('stencil_mode');
      }
    } while (this.isListGoingOn());
  }

  private isListGoingOn(): boolean {
    const token = this.tokens.next();
    if (token.type === 'TK_COMMA') return true;
    if (token.type !== 'TK_SEMICOLON') this.tokens.fail(`Unexpected token: '${tokenText(token)}'.`);
    return false;
  }

  private reference(token: Token): void {
    const value = doubleToInt32(godotIntegerConstant(token.text!));
    if (this.stencilReference !== undefined)
      this.tokens.fail(`Duplicated stencil mode reference value: '${value}'.`);
    if (value < 0) this.tokens.fail(`Stencil mode reference value cannot be negative: '${value}'.`);
    if (value > MAX_STENCIL_REFERENCE)
      this.tokens.fail(
        `Stencil mode reference value cannot be greater than ${MAX_STENCIL_REFERENCE}: '${value}'.`
      );
    this.stencilReference = value;
  }

  /** `_parse_shader_mode` (`shader_language.cpp:11118`). */
  private mode(kind: ModeKind): void {
    const word = WORDS[kind];
    const token = this.tokens.next();
    if (token.type !== 'TK_IDENTIFIER') this.tokens.fail(`Expected an identifier for ${word} mode.`);
    const name = token.text!;
    const modes = this.modes[kind];
    if (modes.some((mode) => mode.name === name)) this.tokens.fail(`Duplicated ${word} mode: '${name}'.`);
    if (!this.isKnown(kind, name)) this.tokens.fail(`Invalid ${word} mode: '${name}'.`);
    modes.push({ name, position: token.position });
  }

  /** Godot matches a mode by its start, so `unshaded_x` is `unshaded`, which no table then reads. */
  private isKnown(kind: ModeKind, name: string): boolean {
    const word = WORDS[kind];
    for (const mode of this.candidates(kind)) {
      if (!name.startsWith(mode.name)) continue;
      if (mode.options.length === 0) return true;
      if (!mode.options.includes(name.slice(mode.name.length + 1))) continue;
      const set = this.defined[kind].get(mode.name);
      if (set !== undefined)
        this.tokens.fail(
          `Redefinition of ${word} mode: '${name}'. The '${mode.name}' mode has already been set to '${set}'.`
        );
      this.defined[kind].set(mode.name, name);
      return true;
    }
    return false;
  }

  /** The modes of the shader's type, or of a `canvas_item` for a probe's text with no head. */
  private candidates(kind: ModeKind): readonly ShaderMode[] {
    const shaderType = this.shaderType() ?? 'canvas_item';
    return SHADER_MODES.filter((mode) => mode.kind === kind && mode.shaderType === shaderType);
  }
}

const isIntegerConstant = (token: Token) =>
  token.type === 'TK_INT_CONSTANT' || token.type === 'TK_UINT_CONSTANT';
