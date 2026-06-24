/**
 * Marker3D validator coverage — the `gizmo_extents` float format check.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

describe('Marker3D validators', () => {
  let linter: Linter;
  beforeEach(() => {
    linter = new Linter();
  });

  it('accepts a valid float gizmo_extents', () => {
    const content = `[gd_scene format=3]

[node name="Marker3D" type="Marker3D"]
gizmo_extents = 0.5
`;
    const diagnostics = linter.lint(content);
    expect(diagnostics.filter((d) => d.message.includes('gizmo_extents'))).toHaveLength(0);
  });

  it('flags a non-numeric gizmo_extents', () => {
    const content = `[gd_scene format=3]

[node name="Marker3D" type="Marker3D"]
gizmo_extents = "not a number"
`;
    const diagnostics = linter.lint(content);
    expect(diagnostics.some((d) => d.message.toLowerCase().includes('gizmo_extents'))).toBe(true);
  });
});
