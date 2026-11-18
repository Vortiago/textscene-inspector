import { describe, expect, it } from 'vitest';
import { shaderErrorReport } from './shaderErrorReport';

const SOURCE = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join('\n');

/** A context whose fragment stage fails on `errorLine` and whose vertex stage compiles. */
function failingContext(errorLine: number) {
  const fragment = {};
  return {
    gl: {
      VALIDATE_STATUS: 1,
      COMPILE_STATUS: 2,
      getError: () => 0,
      getProgramParameter: () => false,
      getProgramInfoLog: () => 'Fragment shader is not compiled.\n',
      getShaderParameter: (shader: object) => shader !== fragment,
      getShaderInfoLog: (shader: object) =>
        shader === fragment ? `ERROR: 0:${errorLine}: 'x' : undeclared` : '',
      getShaderSource: () => SOURCE,
    } as unknown as WebGL2RenderingContext,
    shaders: [{}, fragment] as [WebGLShader, WebGLShader],
  };
}

describe('shaderErrorReport', () => {
  it("names the material, as three's report does", () => {
    const { gl, shaders } = failingContext(10);
    expect(shaderErrorReport(gl, {}, shaders, { name: 'Bands', type: 'ShaderMaterial' })).toContain(
      'Material Name: Bands\nMaterial Type: ShaderMaterial'
    );
  });

  it("marks the error's line among the five lines before it and the six after", () => {
    const { gl, shaders } = failingContext(10);
    const excerpt = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
      .map((line) => `${line === 10 ? '>' : ' '} ${line}: line ${line}`)
      .join('\n');
    expect(shaderErrorReport(gl, {}, shaders, undefined).endsWith(`\n\n${excerpt}`)).toBe(true);
  });
});
