/**
 * The shader language's reading of a shader's type, which picks the shader's mode
 * (`servers/rendering/shader_language.cpp:11223-11302`, `scene/resources/shader.cpp:111-123`).
 */

/** `Shader::Mode` (`scene/resources/shader.h:45-51`), the values `VisualShader.mode` stores. */
export enum ShaderMode {
  SPATIAL = 0,
  CANVAS_ITEM = 1,
  PARTICLES = 2,
  SKY = 3,
  FOG = 4,
}

/** The mode each `shader_type` names. Any other type runs spatial (`scene/resources/shader.cpp:113-123`). */
const SHADER_MODE_BY_TYPE: ReadonlyMap<string, ShaderMode> = new Map([
  ['canvas_item', ShaderMode.CANVAS_ITEM],
  ['particles', ShaderMode.PARTICLES],
  ['sky', ShaderMode.SKY],
  ['fog', ShaderMode.FOG],
]);

/** Characters at or below a space end an identifier (`shader_language.cpp:11279`). */
const LAST_SEPARATOR_CODE = 32;

/**
 * Where the first identifier starts, past the leading comments and whitespace. A comment that runs
 * to the end of the code gives 0, the start of the code (`shader_language.cpp:11223-11268`).
 */
function firstIdentifierIndex(code: string): number {
  let index = 0;
  for (;;) {
    if (code.startsWith('//', index)) {
      const end = code.indexOf('\n', index + 2);
      if (end < 0) return 0;
      index = end + 1;
    } else if (code.startsWith('/*', index)) {
      const end = code.indexOf('*/', index + 2);
      if (end < 0) return 0;
      index = end + 2;
    } else if (index < code.length && ' \t\r\n'.includes(code[index]!)) {
      index++;
    } else {
      return index;
    }
  }
}

/**
 * The type `shader_type <type>;` names at the start of `code`, or `''` where the code opens with
 * anything else (`ShaderLanguage::get_shader_type`, `shader_language.cpp:11270-11302`).
 */
function shaderTypeOf(code: string): string {
  let isReadingType = false;
  let identifier = '';
  for (let i = firstIdentifierIndex(code); i < code.length; i++) {
    const char = code[i]!;
    if (char === ';') break;
    if (char.charCodeAt(0) > LAST_SEPARATOR_CODE) {
      identifier += char;
    } else if (identifier !== '') {
      if (isReadingType) return identifier;
      if (identifier !== 'shader_type') return '';
      isReadingType = true;
      identifier = '';
    }
  }
  return isReadingType ? identifier : '';
}

/** A preprocessor directive's line: `#` with only space before it (`shader_preprocessor.cpp:1302-1308`). */
const DIRECTIVE_LINE = /^[ \t]*#.*$/gm;

/**
 * The mode a Shader with `code` runs in. Godot reads the type after the preprocessor
 * (`scene/resources/shader.cpp:91-111`), whose output keeps no directive line. This drops those
 * lines but expands no macro or include, so a type an include or a macro writes reads as spatial.
 */
export function shaderModeOf(code: string): ShaderMode {
  return SHADER_MODE_BY_TYPE.get(shaderTypeOf(code.replace(DIRECTIVE_LINE, ''))) ?? ShaderMode.SPATIAL;
}
