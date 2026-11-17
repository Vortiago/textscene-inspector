import { describe, expect, it } from 'vitest';
import { driverLog, TranslatorFault } from './translatorFault.js';

/** A context whose program and shaders give the logs of `logs`, by object. */
function contextWith(logs: Map<object, string | null>): WebGL2RenderingContext {
  return {
    getProgramInfoLog: (program: object) => logs.get(program) ?? null,
    getShaderInfoLog: (shader: object) => logs.get(shader) ?? null,
  } as unknown as WebGL2RenderingContext;
}

describe('TranslatorFault', () => {
  it('names the shader and gives the driver log', () => {
    const fault = new TranslatorFault(
      { text: '', file: 'res://bands.gdshader' },
      'program: Could not pack varying'
    );
    expect(fault.message).toContain('res://bands.gdshader');
    expect(fault.message).toContain('Could not pack varying');
  });
});

describe('driverLog', () => {
  it('gives the program log, then each stage log that has text', () => {
    const [program, vertex, fragment] = [{}, {}, {}];
    const gl = contextWith(
      new Map<object, string | null>([
        [program, 'Could not pack varying\n'],
        [vertex, ''],
        [fragment, 'ERROR: 0:1: x'],
      ])
    );
    expect(driverLog(gl, program as WebGLProgram, vertex as WebGLShader, fragment as WebGLShader)).toBe(
      'program: Could not pack varying\nfragment: ERROR: 0:1: x'
    );
  });
});
