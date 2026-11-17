import { describe, expect, it } from 'vitest';
import { instruction } from './instructions.js';
import { treeOf } from './parsedTree.testkit.js';
import type {
  CallNode,
  DeclarationNode,
  Expression,
  FunctionNode,
  OperatorNode,
  ShaderNode,
} from './shaderTree.js';
import { treeFault } from './treeCheck.js';

/** `shader` with the value of its first function's return replaced by `change(value)`. */
function withReturn(shader: ShaderNode, change: (value: Expression) => Expression): ShaderNode {
  const definition = shader.functions[0]!;
  const statements = definition.body.statements.map((statement) =>
    statement.kind === 'control flow'
      ? { ...statement, expressions: [change(statement.expressions[0]!)] }
      : statement
  );
  return { ...shader, functions: [{ ...definition, body: { ...definition.body, statements } }] };
}

/** `shader` with the first declarator of its first function's first statement named `name`. */
function withDeclared(shader: ShaderNode, name: string): ShaderNode {
  const definition = shader.functions[0]!;
  const [first, ...rest] = definition.body.statements;
  const declaration = first as DeclarationNode;
  const renamed = { ...declaration, declarators: [{ ...declaration.declarators[0]!, name }] };
  const body = { ...definition.body, statements: [renamed, ...rest] };
  return { ...shader, functions: [{ ...definition, body }] };
}

describe('treeFault', () => {
  it('finds no fault in a parsed tree', () => {
    expect(treeFault(treeOf('ivec2 f(ivec2 a, int b) { a.y += b; return a << 1; }'))).toBeUndefined();
  });

  it('finds no fault in a sampler read and a sampler argument', () => {
    const source =
      'uniform sampler2D s;\nvec4 read(sampler2D t) { return texture(t, vec2(0.5)); }\nvec4 probe() { return read(s); }';
    expect(treeFault(treeOf(source))).toBeUndefined();
  });

  it('finds an operator whose row does not fit its operand types', () => {
    const tree = withReturn(treeOf('vec2 f(vec2 a, vec2 b) { return a + b; }'), (value) => ({
      ...(value as OperatorNode),
      op: 'OP_SHIFT_LEFT',
    }));
    expect(treeFault(tree)).toMatch(/the row OP_ADD\(vec2,vec2\) over vec2, vec2/);
  });

  it('finds a return of another type than its function', () => {
    const tree = withReturn(
      treeOf('vec2 f(vec2 a, vec2 b) { return a + b; }'),
      (value) => ({ ...value, type: 'vec3' }) as Expression
    );
    expect(treeFault(tree)).toMatch(/return of vec3 in a function of vec2/);
  });

  it('finds a node with no line and column of its text', () => {
    const tree = withReturn(treeOf('float f(float a) { return a; }'), (value) => ({
      ...value,
      position: { file: '', line: 0, column: 0 },
    }));
    expect(treeFault(tree)).toMatch(/a variable at no line and column/);
  });

  it('finds a name that is no argument', () => {
    const tree = withReturn(
      treeOf('float f(float a) { return a; }'),
      (value) => ({ ...value, name: 'b' }) as Expression
    );
    expect(treeFault(tree)).toMatch(/the name b, which no block around the read declares/);
  });

  it('finds a body local with the name of an argument', () => {
    const tree = withDeclared(treeOf('float f(float x) { float y; return x; }'), 'x');
    expect(treeFault(tree)).toMatch(/a second x in one block/);
  });

  it('finds a body local with the name of a uniform', () => {
    const tree = withDeclared(treeOf('uniform float u;\nfloat f() { float y; return u; }'), 'u');
    expect(treeFault(tree)).toMatch(/a second u in one block/);
  });

  it('finds a constant lane outside its type', () => {
    const tree = withReturn(
      treeOf('int f() { return 1; }'),
      (value) => ({ ...value, values: [2 ** 31] }) as Expression
    );
    expect(treeFault(tree)).toMatch(/int constant 2147483648/);
  });

  describe('a call', () => {
    const source = 'float twice(float x) { return x * 2.0; } float f(float a) { twice(a); return a; }';

    /** `source` with the call that is the first statement of `f` changed by `change`. */
    function withCall(change: (call: CallNode) => Expression): ShaderNode {
      const shader = treeOf(source);
      const [twice, f] = shader.functions as [FunctionNode, FunctionNode];
      const [call, ...rest] = f.body.statements;
      const body = { ...f.body, statements: [change(call as CallNode), ...rest] };
      return { ...shader, functions: [twice, { ...f, body }] };
    }

    it('finds no fault in a parsed call', () => {
      expect(treeFault(treeOf(source))).toBeUndefined();
    });

    it('finds a call of no function before its caller', () => {
      expect(treeFault(withCall((call) => ({ ...call, function: 'later' })))).toMatch(
        /a call of later, which no function before f is/
      );
    });

    it('finds a call at no line and column', () => {
      expect(
        treeFault(withCall((call) => ({ ...call, position: { ...call.position, line: 0, column: 0 } })))
      ).toMatch(/a call of twice at no line and column/);
    });

    it('finds a call typed otherwise than its function returns', () => {
      expect(treeFault(withCall((call) => ({ ...call, type: 'int' })))).toMatch(/a call of twice typed int/);
    });

    it('finds an argument of another type than its parameter', () => {
      const constant = { kind: 'constant', type: 'int', values: [1] } as const;
      expect(
        treeFault(withCall((call) => ({ ...call, operands: [{ ...call.operands[0]!, ...constant }] })))
      ).toMatch(/a int for the argument x of twice/);
    });
  });

  describe('a call of a built-in function', () => {
    const builtIn = (change: (call: CallNode) => Expression) =>
      withReturn(treeOf('vec2 f(vec2 a) { return clamp(a, 0.0, 1.0); }'), (value) =>
        change(value as CallNode)
      );

    it('finds no fault in a parsed call', () => {
      expect(treeFault(builtIn((call) => call))).toBeUndefined();
    });

    it('finds a call typed otherwise than its row returns', () => {
      const row = instruction('clamp(vec3,float,float)')!;
      expect(treeFault(builtIn((call) => ({ ...call, row })))).toMatch(
        /a call of clamp\(vec3,float,float\) typed vec2/
      );
    });

    it('finds an argument of another type than its row takes', () => {
      const constant = { kind: 'constant', type: 'int', values: [1] } as const;
      const changed = (call: CallNode) => ({
        ...call,
        operands: [call.operands[0]!, { ...call.operands[1]!, ...constant }, call.operands[2]!],
      });
      expect(treeFault(builtIn(changed))).toMatch(/a int for argument 2 of clamp\(vec2,float,float\)/);
    });

    it('finds an out argument that is no place', () => {
      const constant = { kind: 'constant', type: 'float', values: [1] } as const;
      const tree = withReturn(treeOf('float f(float a) { float w = 0.0; return modf(a, w); }'), (value) => {
        const call = value as CallNode;
        return { ...call, operands: [call.operands[0]!, { ...call.operands[1]!, ...constant }] };
      });
      expect(treeFault(tree)).toMatch(/a constant for the out argument 2 of modf\(float,float\)/);
    });
  });
});
