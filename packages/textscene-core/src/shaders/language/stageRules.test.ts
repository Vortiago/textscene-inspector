import { treeOf as parsedTree } from './parsedTree.testkit';
import { describe, expect, it } from 'vitest';

const treeOf = (source: string) => parsedTree(source, 'user.gdshader');

const refusalOf = (source: string) => {
  try {
    treeOf(source);
    return 'accepted';
  } catch (error) {
    const { reason, position } = error as { reason: string; position: { line: number } };
    return `${position.line}: ${reason}`;
  }
};

describe('the processor functions', () => {
  it.each([
    ['shader_type spatial;\nvoid fragment(float a) {}', "2: Function 'fragment' expects no arguments."],
    [
      'shader_type spatial;\nfloat fragment() { return 1.0; }',
      "2: Function 'fragment' must be of 'void' return type.",
    ],
    ['shader_type spatial;\nvoid fragment() {}\nvoid fragment() {}', "3: Redefinition of 'fragment'."],
    [
      'shader_type spatial;\nvoid vertex() {}\nvoid fragment() {\n\tvertex();\n}',
      "4: Function 'vertex' can't be called from source code.",
    ],
    [
      'shader_type spatial;\nvoid vertex() {}\nvoid fragment() {\n\tfloat a = vertex;\n}',
      "4: Unknown identifier in expression: 'vertex'.",
    ],
    [
      'shader_type canvas_item;\nvoid fragment() {\n\tif (true) {\n\t\treturn;\n\t}\n}',
      "4: Using 'return' in the 'fragment' processor function is incorrect.",
    ],
  ])("keeps Godot's rule for %j", (source, verdict) => {
    expect(refusalOf(source)).toBe(verdict);
  });

  it('lets a function of the shader return', () => {
    expect(refusalOf('shader_type spatial;\nvoid f() {\n\treturn;\n}\nvoid fragment() {\n\tf();\n}')).toBe(
      'accepted'
    );
  });
});

describe('discard', () => {
  it.each([
    [
      'shader_type spatial;\nvoid vertex() {\n\tdiscard;\n}',
      "3: 'discard' cannot be used within the 'vertex' processor function.",
    ],
    [
      'shader_type sky;\nvoid sky() {\n\tdiscard;\n}',
      "3: Use of 'discard' is not supported for the 'sky' shader type.",
    ],
    [
      'shader_type canvas_item;\nvoid f() {\n\tdiscard;\n}\nvoid g() {\n\tf();\n}\nvoid vertex() {\n\tg();\n}',
      "3: 'discard' cannot be used here, because 'f' is called by the 'vertex' processor function (which is not allowed).",
    ],
    ['shader_type spatial;\nvoid f() {\n\tdiscard;\n}\nvoid fragment() {\n\tf();\n}', 'accepted'],
  ])("keeps Godot's rule for %j", (source, verdict) => {
    expect(refusalOf(source)).toBe(verdict);
  });
});

describe('what vertex() may reach', () => {
  it.each([
    [
      'shader_type spatial;\nvoid vertex() {\n\tfloat d = dFdx(1.0);\n}',
      "3: 'dFdx' cannot be used within the 'vertex' processor function.",
    ],
    [
      'shader_type fog;\nvoid fog() {\n\tfloat d = dFdy(1.0, 2.0);\n}',
      "3: Built-in function 'dFdy' is not supported for the 'fog' shader type.",
    ],
    [
      'shader_type spatial;\nfloat f(float a) {\n\treturn dFdx(a);\n}\nfloat g() {\n\treturn 1.0;\n}\nvoid vertex() {\n\tfloat d = g();\n}',
      'accepted',
    ],
    [
      'shader_type spatial;\nvarying float v;\nvoid vertex() {\n\tv = 1.0;\n\tfloat d = dFdx(v);\n}',
      'accepted',
    ],
    [
      'shader_type spatial;\nvarying float v;\nvoid vertex() {\n\tfloat a = v;\n\tfloat d = dFdx(a);\n}',
      "4: 'v' cannot be used within the 'vertex' processor function.",
    ],
  ])("keeps Godot's rule for %j", (source, verdict) => {
    expect(refusalOf(source)).toBe(verdict);
  });
});

describe('stage functions', () => {
  const emit = 'emit_subparticle(mat4(1.0), vec3(0.0), vec4(1.0), vec4(0.0), 0u)';

  it('reads a call of one in a function of the shader, typed by its row', () => {
    const [f] = treeOf(`shader_type particles;\nvoid f() {\n\tbool b = ${emit};\n}`).functions;
    const [declaration] = f!.body.statements;
    expect(declaration?.kind === 'declaration' && declaration.declarators[0]!.value).toMatchObject({
      op: 'OP_CALL',
      type: 'bool',
      row: { id: 'particles.start.emit_subparticle(mat4,vec3,vec4,vec4,uint)' },
    });
  });

  it.each([
    [
      'shader_type canvas_item;\nvoid fragment() {\n\tfloat d = texture_sdf(vec2(0.0), 1.0);\n}',
      "3: Invalid number of arguments when calling stage function 'texture_sdf', which expects 1 argument(s).",
    ],
    [
      'shader_type canvas_item;\nvoid fragment() {\n\tfloat d = texture_sdf(1);\n}',
      "3: Invalid argument type when calling stage function 'texture_sdf', type expected is 'vec2'.",
    ],
    [
      'shader_type canvas_item;\nvoid vertex() {\n\tfloat d = texture_sdf(vec2(0.0));\n}',
      "3: 'texture_sdf' cannot be used within the 'vertex' processor function.",
    ],
    [
      'shader_type canvas_item;\nvoid fragment() {\n\tfloat d = texture_sdf;\n}',
      "3: Can't use function as identifier: 'texture_sdf'.",
    ],
  ])("keeps Godot's rule for %j", (source, verdict) => {
    expect(refusalOf(source)).toBe(verdict);
  });
});

describe('varyings passed to a function', () => {
  const setter = 'void set(out float a) {\n\ta = 1.0;\n}\n';

  it.each([
    [
      `shader_type spatial;\nvarying float v;\n${setter}void fragment() {\n\tv = 0.0;\n}\nvoid light() {\n\tset(v);\n}`,
      "10: Varying 'v' cannot be passed for the 'out' parameter in that context.",
    ],
    [
      `shader_type spatial;\nvarying float v;\n${setter}void vertex() {\n\tv = 0.0;\n\tset(v);\n}`,
      'accepted',
    ],
    [
      'shader_type spatial;\nvarying vec2 v;\nvoid vertex() {\n\tv = vec2(0.0);\n\tvec2 f = modf(vec2(1.5), v);\n}',
      "5: Varyings cannot be passed for the 'out' parameter.",
    ],
  ])("keeps Godot's rule for %j", (source, verdict) => {
    expect(refusalOf(source)).toBe(verdict);
  });
});
