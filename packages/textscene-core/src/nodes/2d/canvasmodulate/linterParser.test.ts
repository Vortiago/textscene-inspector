/**
 * CanvasModulate validator coverage — the `color` color format check.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

describe('CanvasModulate validators', () => {
  let linter: Linter;
  beforeEach(() => {
    linter = new Linter();
  });

  it('accepts a valid color', () => {
    const content = `[gd_scene format=3]

[node name="CanvasModulate" type="CanvasModulate"]
color = Color(0.5, 0.5, 1, 1)
`;
    const diagnostics = linter.lint(content);
    expect(diagnostics.filter((d) => d.message.toLowerCase().includes('color'))).toHaveLength(0);
  });

  it('flags an invalid color', () => {
    const content = `[gd_scene format=3]

[node name="CanvasModulate" type="CanvasModulate"]
color = "not a color"
`;
    const diagnostics = linter.lint(content);
    expect(diagnostics.some((d) => d.message.toLowerCase().includes('color'))).toBe(true);
  });
});
