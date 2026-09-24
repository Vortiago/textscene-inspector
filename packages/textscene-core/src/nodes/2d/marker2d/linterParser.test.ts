/**
 * Marker2D validators: the `gizmo_extents` float format and the hinted floor at 0
 * (marker_2d.cpp:105, where `or_greater` leaves the top open).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';

describe('Marker2D validators', () => {
  let linter: Linter;
  beforeEach(() => {
    linter = new Linter();
  });

  /** Diagnostics naming `gizmo_extents` for a scene carrying that value. */
  const extentsDiagnostics = (value: string) =>
    linter
      .lint(
        `[gd_scene format=3]\n\n[node name="Marker2D" type="Marker2D"]\ngizmo_extents = ${value}\n`
      )
      .filter((d) => d.message.toLowerCase().includes('gizmo_extents'));

  it('accepts a valid float gizmo_extents', () => {
    expect(extentsDiagnostics('24.0')).toHaveLength(0);
  });

  it('accepts 0, the hint floor', () => {
    expect(extentsDiagnostics('0')).toHaveLength(0);
  });

  it('accepts a value past the hint ceiling — the hint ends in or_greater', () => {
    expect(extentsDiagnostics('5000')).toHaveLength(0);
  });

  it('warns one step below the floor — set_gizmo_extents assigns straight through', () => {
    const [diagnostic] = extentsDiagnostics('-0.1');
    expect(diagnostic?.severity).toBe('warning');
    expect(diagnostic?.message).toContain('non-negative');
  });

  it('flags a non-numeric gizmo_extents', () => {
    const [diagnostic] = extentsDiagnostics('"not a number"');
    expect(diagnostic?.severity).toBe('error');
    expect(diagnostic?.message).toContain('must be a number');
  });
});
