import { describe, expect, it } from 'vitest';
import { generatedUnDrawnMessage, unDrawnMessage } from './shaderRefusal.js';

describe('unDrawnMessage', () => {
  it("names Godot's refusal of the text", () => {
    expect(
      unDrawnMessage({ refusal: { message: 'Unknown identifier', owner: undefined } }, 'sky', 'sky')
    ).toBe('Godot does not compile the sky shader, and draws its default sky: Unknown identifier');
  });

  it('names the owner of a construct the transpiler does not port yet', () => {
    expect(unDrawnMessage({ refusal: { message: 'FOG', owner: '#1831' } }, 'spatial', '3D surface')).toBe(
      "The previewer does not translate this spatial shader yet (#1831), and draws Godot's default 3D surface: FOG"
    );
  });

  it('names a defect as a failure to translate', () => {
    expect(unDrawnMessage({ failure: new Error('boom') }, 'sky', 'sky')).toBe(
      "The previewer failed to translate this sky shader, and draws Godot's default sky: Error: boom"
    );
  });
});

describe('generatedUnDrawnMessage', () => {
  it('names the classic material a generated shader falls back on', () => {
    expect(
      generatedUnDrawnMessage({ refusal: { message: 'FOG', owner: '#1831' } }, 'StandardMaterial3D')
    ).toBe(
      'The previewer does not translate the shader Godot generates for this StandardMaterial3D yet (#1831), and draws the classic material: FOG'
    );
  });

  it('names a refusal with no owner as a fault of the generated text', () => {
    expect(generatedUnDrawnMessage({ refusal: { message: 'Unknown identifier' } }, 'ORMMaterial3D')).toBe(
      'The previewer wrote the shader Godot generates for this ORMMaterial3D wrongly, and draws the classic material: Unknown identifier'
    );
  });
});
