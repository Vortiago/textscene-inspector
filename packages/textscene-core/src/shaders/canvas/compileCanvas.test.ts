import { describe, expect, it } from 'vitest';
import { compileCanvas } from './compileCanvas.js';

describe('compileCanvas', () => {
  it("gives the material and each sampler uniform's sampler", () => {
    const compile = compileCanvas(
      'shader_type canvas_item;\nuniform sampler2D noise : filter_nearest;\nvoid fragment() { COLOR = texture(noise, UV); }\n',
      {}
    );

    expect('item' in compile && Object.keys(compile.samplers)).toEqual(['noise']);
  });

  it("refuses a text Godot does not compile, with Godot's message", () => {
    const compile = compileCanvas('shader_type canvas_item;\nvoid fragment() { COLOR = 1.0; }\n', {});

    expect('refusal' in compile && compile.refusal.message).toMatch(/Invalid assignment/);
  });
});
