import { describe, expect, it } from 'vitest';
import { stringLiteral } from '../../../godot/string/string';
import { shaderCodeOf } from './shaderCode';

const CODE =
  'shader_type sky;\n#define BLUE vec3(0.0, \\\n\t0.0, 1.0)\n// "quoted"\nvoid sky() { COLOR = BLUE; }\n';

describe('shaderCodeOf', () => {
  it('reads the code back as Godot writes it, with its backslashes and quotes escaped', () => {
    expect(shaderCodeOf({ code: stringLiteral(CODE) })).toBe(CODE);
  });

  it('decodes the newline and tab escapes a hand-written text may use', () => {
    expect(shaderCodeOf({ code: '"shader_type sky;\\nvoid sky() {\\n\\tCOLOR = vec3(1.0);\\n}"' })).toBe(
      'shader_type sky;\nvoid sky() {\n\tCOLOR = vec3(1.0);\n}'
    );
  });

  it('reads an absent code as no text (edge case)', () => {
    expect(shaderCodeOf({})).toBe('');
  });
});
