import { describe, expect, it } from 'vitest';
import { docsShaders, inlineShaders, oneChange } from './corpusSources.mjs';

const RST = `Some text.

.. code-block:: glsl

    shader_type canvas_item;

    void fragment() {
        COLOR = vec4(1.0);
    }

A fragment, not a whole shader:

.. code-block:: glsl

    void fragment() {
        COLOR.r = 0.5;
    }
`;

describe('the shaders of a documentation page', () => {
  it('reads each code block that is a whole shader, dedented', () => {
    expect(docsShaders(RST)).toEqual([
      { index: 0, text: 'shader_type canvas_item;\n\nvoid fragment() {\n    COLOR = vec4(1.0);\n}\n' },
    ]);
  });
});

describe('the shaders written inside a scene or resource file', () => {
  it('reads the code of each Shader resource, with its escapes undone', () => {
    const tres =
      '[sub_resource type="Shader" id="1"]\ncode = "shader_type spatial;\nuniform vec4 c = vec4(1.0);\n// \\"quoted\\"\n"\n';
    expect(inlineShaders(tres)).toEqual(['shader_type spatial;\nuniform vec4 c = vec4(1.0);\n// "quoted"\n']);
  });
});

describe('a rejected shader made by one change', () => {
  const text = 'shader_type spatial;\nvoid fragment() {\n\tALBEDO = vec3(1.0);\n}\n';

  it('drops the last semicolon for the first kind', () => {
    expect(oneChange(text, 0)).toEqual({
      change: 'drops the last semicolon',
      text: 'shader_type spatial;\nvoid fragment() {\n\tALBEDO = vec3(1.0)\n}\n',
    });
  });

  it('misspells the first vector type for the second kind', () => {
    expect(oneChange(text, 1).text).toContain('vex3(1.0)');
  });

  it('calls a function the shader does not define for the third kind', () => {
    expect(oneChange(text, 2).text).toContain('void fragment() {\n\tnot_defined();');
  });

  it('throws for a text with no change it can apply', () => {
    expect(() => oneChange('// no statement here\n', 0)).toThrow(/semicolon/);
  });
});
