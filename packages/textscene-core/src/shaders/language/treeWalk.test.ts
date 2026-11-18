import { describe, expect, it } from 'vitest';
import { parsedShader } from './parseShader.js';
import { variablesRead } from './treeWalk.js';

const tree = (source: string) => parsedShader(`shader_type spatial;\n${source}`).tree;

describe('variablesRead', () => {
  it('names each built-in every function reads, once', () => {
    const shader = tree(
      'void vertex() {\n\tVERTEX.x += TIME;\n}\nvoid fragment() {\n\tALBEDO = vec3(TIME);\n}\n'
    );
    expect(variablesRead(shader, (variable) => variable.builtIn !== undefined)).toEqual(
      new Set(['VERTEX', 'TIME', 'ALBEDO'])
    );
  });

  it('keeps only the variables `keeps` keeps', () => {
    const shader = tree('uniform float level;\nvoid fragment() {\n\tALBEDO = vec3(level);\n}\n');
    expect(variablesRead(shader, (variable) => variable.isUniform === true)).toEqual(new Set(['level']));
  });

  it('names nothing for a shader with no function', () => {
    expect(variablesRead(tree(''), () => true)).toEqual(new Set());
  });
});
