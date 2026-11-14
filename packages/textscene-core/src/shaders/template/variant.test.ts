import { describe, expect, it } from 'vitest';
import { DEFINES_FILE, definesText, variantLines } from './variant.js';

const DEFINES = {
  general: '\n#define G 1\n',
  variant: '\n#define MODE\n',
  custom: [],
  hasUniforms: true,
  codeSections: ['SKY'],
};
const line = (text: string, at: number) => ({ text, file: 't.glsl', line: at });

describe('variantLines', () => {
  it('writes the defines where #VERSION_DEFINES stands, in Godot order', () => {
    expect(definesText(DEFINES)).toBe(
      '\n\n#define G 1\n\n#define MODE\n\n#define MATERIAL_UNIFORMS_USED\n#define SKY_CODE_USED\n' +
        '#define RENDER_DRIVER_VULKAN\n#define samplerExternalOES sampler2D\n#define textureExternalOES texture2D\n'
    );
  });

  it('gives each line of the defines the defines file', () => {
    const lines = variantLines([line('#VERSION_DEFINES', 1)], DEFINES);
    expect(lines.every((each) => each.file === DEFINES_FILE || each.text === '')).toBe(true);
  });

  it('makes a slot of each code section, named in upper case', () => {
    const [slot] = variantLines([line('#CODE : sky', 4)], DEFINES);
    expect(slot).toEqual({ slot: { kind: 'CODE', name: 'SKY' }, file: 't.glsl', line: 4 });
  });

  it('ends the stage with an empty line, as Godot joins its lines', () => {
    expect(variantLines([line('x', 1)], DEFINES).at(-1)).toEqual({ text: '', file: 't.glsl', line: 2 });
  });
});
