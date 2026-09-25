/**
 * Marker3D validators: the `gizmo_extents` float format check and the hinted
 * floor at 0 (marker_3d.cpp:49, `or_greater` leaves the top open).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

describe('Marker3D validators', () => {
  let linter: Linter;
  beforeEach(() => {
    linter = new Linter();
  });

  /** Diagnostics naming `gizmo_extents` for a scene carrying that value. */
  const extentsDiagnostics = (value: string) =>
    linter
      .lint(
        `[gd_scene format=3]\n\n[node name="Marker3D" type="Marker3D"]\ngizmo_extents = ${value}\n`
      )
      .filter((d) => d.message.toLowerCase().includes('gizmo_extents'));

  it('accepts a valid float gizmo_extents', () => {
    expect(extentsDiagnostics('0.5')).toHaveLength(0);
  });

  it('accepts 0, the hint floor', () => {
    expect(extentsDiagnostics('0')).toHaveLength(0);
  });

  it('accepts a value past the hint ceiling — the hint ends in or_greater', () => {
    expect(extentsDiagnostics('50')).toHaveLength(0);
  });

  it('warns one step below the floor — set_gizmo_extents assigns straight through', () => {
    const [diagnostic] = extentsDiagnostics('-0.01');
    expect(diagnostic?.severity).toBe('warning');
    expect(diagnostic?.message).toContain('non-negative');
  });

  it('flags a non-numeric gizmo_extents', () => {
    const [diagnostic] = extentsDiagnostics('"not a number"');
    expect(diagnostic?.severity).toBe('error');
    expect(diagnostic?.message).toContain('must be a number');
  });
});
