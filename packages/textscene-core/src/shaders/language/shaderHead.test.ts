import { describe, expect, it } from 'vitest';
import { parse } from './parse.js';
import { tokenize } from './tokenizer.js';

const treeOf = (source: string) => parse(tokenize(source, 'user.gdshader'));

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
