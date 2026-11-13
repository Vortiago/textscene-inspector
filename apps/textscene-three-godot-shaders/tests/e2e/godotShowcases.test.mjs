/** The Godot side of the showcases: its project and the parse of its output. */

import { describe, expect, it } from 'vitest';
import { parseShowcaseOutput, showcaseProjectFiles } from './godotShowcases.mjs';
import { SHOWCASES } from './showcases.mjs';

describe('showcaseProjectFiles', () => {
  it('writes each showcase function into a canvas_item shader that draws it from UV', () => {
    const shader = showcaseProjectFiles(SHOWCASES)['showcase_0.gdshader'];
    expect(shader).toContain('shader_type canvas_item;');
    expect(shader).toContain('COLOR = vec4(pattern(UV), 1.0);');
  });
});

describe('parseShowcaseOutput', () => {
  it("reads each showcase's bytes and Godot's version", () => {
    const output = parseShowcaseOutput('noise\nGODOT 4.6.3-stable (official)\nSHOWCASE a 0aff00ff\n');
    expect([output.godot, Array.from(output.images.get('a'))]).toEqual([
      '4.6.3-stable (official)',
      [10, 255, 0, 255],
    ]);
  });

  it('refuses output with no version line', () => {
    expect(() => parseShowcaseOutput('SHOWCASE a 00\n')).toThrow(/GODOT/);
  });
});
