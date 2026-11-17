import { treeOf as parsedTree } from './parsedTree.testkit';
import { describe, expect, it } from 'vitest';

const treeOf = (source: string) => parsedTree(source, 'user.gdshader');

describe('the shader head', () => {
  it('reads the shader type', () => {
    expect(treeOf('shader_type sky;\nvoid sky() {}').shaderType).toBe('sky');
  });

  it('refuses a type Godot has not, with the valid ones', () => {
    expect(() => treeOf('shader_type water;')).toThrow(
      "Invalid shader type. Valid types are: 'spatial', 'canvas_item', 'particles', 'sky', 'fog'"
    );
  });

  it("refuses a head with no ';'", () => {
    expect(() => treeOf('shader_type sky\nvoid sky() {}')).toThrow("Expected a ';' after 'shader_type sky'.");
  });

  it("names the line of the type in a head with no ';', as Godot does", () => {
    expect(() => treeOf('shader_type sky\nvoid sky() {}')).toThrow(
      expect.objectContaining({ position: expect.objectContaining({ line: 1 }) })
    );
  });

  it("reads a built-in of the type's stage function as a variable that names its row", () => {
    const [sky] = treeOf('shader_type sky;\nvoid sky() {\n\tCOLOR = vec3(0.0);\n}').functions;
    const [assignment] = sky!.body.statements;
    expect(assignment?.kind === 'operator' && assignment.operands[0]).toMatchObject({
      kind: 'variable',
      name: 'COLOR',
      type: 'vec3',
      builtIn: 'sky.sky.COLOR',
      position: { line: 3 },
    });
  });

  it('reads a built-in of every function of the type in a function of the shader', () => {
    const [helper] = treeOf('shader_type sky;\nfloat t() { return TIME; }').functions;
    expect(helper!.body.statements[0]).toMatchObject({ expressions: [{ builtIn: 'sky.global.TIME' }] });
  });

  it('reads no built-in of a stage function outside it', () => {
    expect(() => treeOf('shader_type sky;\nvec3 c() { return COLOR; }')).toThrow();
  });
});

const refusal = (source: string) => {
  try {
    treeOf(source);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return 'accepted';
};

describe('render modes', () => {
  it('reads each render mode of the type, with its position', () => {
    const tree = treeOf('shader_type spatial;\nrender_mode unshaded, cull_disabled;\nrender_mode blend_add;');
    expect(tree.renderModes.map(({ name, position }) => [name, position.line])).toEqual([
      ['unshaded', 2],
      ['cull_disabled', 2],
      ['blend_add', 3],
    ]);
  });

  it("refuses a mode the type has not, as Godot's `_parse_shader_mode` does", () => {
    expect(refusal('shader_type sky;\nrender_mode unshaded;')).toMatch("Invalid render mode: 'unshaded'.");
  });

  it('accepts a name that starts with a mode of no values, which Godot keeps and ignores', () => {
    expect(treeOf('shader_type spatial;\nrender_mode unshaded_please;').renderModes[0]!.name).toBe(
      'unshaded_please'
    );
  });

  it('refuses a mode named twice', () => {
    expect(refusal('shader_type spatial;\nrender_mode unshaded, unshaded;')).toMatch(
      "Duplicated render mode: 'unshaded'."
    );
  });

  it('refuses a second value of one mode, naming the first', () => {
    expect(refusal('shader_type spatial;\nrender_mode blend_mix;\nrender_mode blend_add;')).toMatch(
      "Redefinition of render mode: 'blend_add'. The 'blend' mode has already been set to 'blend_mix'."
    );
  });

  it('refuses a token other than a comma or a semicolon after a mode', () => {
    expect(refusal('shader_type spatial;\nrender_mode unshaded cull_back;')).toMatch(
      "Unexpected token: 'IDENTIFIER(cull_back)'."
    );
  });

  it('refuses a mode that is no identifier', () => {
    expect(refusal('shader_type spatial;\nrender_mode 1;')).toMatch(
      'Expected an identifier for render mode.'
    );
  });

  it("reads a text with no head with a canvas item's modes, as Godot draws a probe", () => {
    expect(refusal('render_mode light_only;\nrender_mode use_half_res_pass;')).toMatch(
      "Invalid render mode: 'use_half_res_pass'."
    );
  });
});

describe('stencil modes', () => {
  it('reads the modes and the reference value', () => {
    const tree = treeOf('shader_type spatial;\nstencil_mode read, compare_less, 3;');
    expect([tree.stencilModes.map(({ name }) => name), tree.stencilReference]).toEqual([
      ['read', 'compare_less'],
      3,
    ]);
  });

  it('refuses a reference over 255', () => {
    expect(refusal('shader_type spatial;\nstencil_mode read, 256;')).toMatch(
      "Stencil mode reference value cannot be greater than 255: '256'."
    );
  });

  it('refuses a second reference value', () => {
    expect(refusal('shader_type spatial;\nstencil_mode 1, 2;')).toMatch(
      "Duplicated stencil mode reference value: '2'."
    );
  });

  it('refuses a stencil mode in a type that has none', () => {
    expect(refusal('shader_type canvas_item;\nstencil_mode read;')).toMatch("Invalid stencil mode: 'read'.");
  });
});

describe('the shader type', () => {
  it('is named once', () => {
    expect(refusal('shader_type spatial;\nshader_type spatial;')).toMatch('Shader type is already defined.');
  });
});

describe('varyings', () => {
  it('reads the interpolation, type, name and array size', () => {
    const tree = treeOf('shader_type spatial;\nvarying flat highp ivec2 cell[3];\nvarying vec3 tint;');
    expect(
      tree.varyings.map(({ name, type, interpolation, arraySize }) => [name, type, interpolation, arraySize])
    ).toEqual([
      ['cell', 'ivec2', 'flat', 3],
      ['tint', 'vec3', undefined, undefined],
    ]);
  });

  it('refuses a varying in a sky shader', () => {
    expect(refusal('shader_type sky;\nvarying float v;')).toMatch(
      "Varyings cannot be used in 'sky' shaders."
    );
  });

  it('refuses an interpolation on a boolean varying', () => {
    expect(refusal('shader_type spatial;\nvarying flat bool b;')).toMatch(
      "Interpolation modifier 'flat' cannot be used with boolean types."
    );
  });

  it('refuses a sampler varying', () => {
    expect(refusal('shader_type spatial;\nvarying sampler2D s;')).toMatch('Invalid data type for varying.');
  });

  it('refuses an assignment in the light function', () => {
    expect(refusal('shader_type spatial;\nvarying float v;\nvoid light() {\n\tv = 1.0;\n}')).toMatch(
      "Varying may not be assigned in the 'light' function."
    );
  });

  it('refuses a fragment write of a varying the vertex function writes', () => {
    const source =
      'shader_type spatial;\nvarying float v;\nvoid vertex() { v = 1.0; }\nvoid fragment() { v = 2.0; }';
    expect(refusal(source)).toMatch(
      "Varyings which assigned in 'vertex' function may not be reassigned in 'fragment' or 'light'."
    );
  });

  it('refuses a read of a boolean varying before the fragment function writes it', () => {
    expect(refusal('shader_type spatial;\nvarying bool b;\nvoid light() { bool c = b; }')).toMatch(
      "Varying 'b' must be assigned in the 'fragment' function first."
    );
  });

  it('reads a varying in a function as a variable of its type', () => {
    const [vertex] = treeOf(
      'shader_type spatial;\nvarying vec2 v;\nvoid vertex() { v = vec2(1.0); }'
    ).functions;
    const [assignment] = vertex!.body.statements;
    expect(assignment?.kind === 'operator' && assignment.operands[0]).toMatchObject({
      kind: 'variable',
      name: 'v',
      type: 'vec2',
      isVarying: true,
    });
  });
});

describe('global constants', () => {
  it('reads a constant and its value', () => {
    const tree = treeOf('const float K = 2.0, L = 3.0;\nfloat f() { return K * L; }');
    expect(tree.constants.flatMap((constant) => constant.declarators.map(({ name }) => name))).toEqual([
      'K',
      'L',
    ]);
  });

  it('reads a constant in a function as a constant of its type', () => {
    const [f] = treeOf('const vec2 K = vec2(1.0, 2.0);\nfloat f() { return K.y; }').functions;
    expect(f!.body.statements[0]).toMatchObject({
      expressions: [{ owner: { kind: 'variable', name: 'K', type: 'vec2', isConst: true } }],
    });
  });

  it('sizes an array by a constant', () => {
    expect(() => treeOf('const int N = 2;\nfloat f() { float a[N]; return a[0]; }')).not.toThrow();
  });

  it('refuses a global variable that is not constant', () => {
    expect(refusal('float x = 1.0;')).toMatch(
      "Global non-constant variables are not supported. Expected 'const' keyword before constant definition."
    );
  });

  it('refuses a constant with no value', () => {
    expect(refusal('const float K;')).toMatch('Expected initialization of constant.');
  });

  it('refuses a constant written in a function', () => {
    expect(refusal('const float K = 1.0;\nvoid f() { K = 2.0; }')).toMatch('Constants cannot be modified.');
  });

  it('refuses a local that hides a constant', () => {
    expect(refusal('const float K = 1.0;\nvoid f() { float K = 2.0; }')).toMatch("Redefinition of 'K'.");
  });
});
