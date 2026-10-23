import { describe, expect, it } from 'vitest';
import { godotPolylineToSegments } from './godotPolylineToSegments';

describe('godotPolylineToSegments', () => {
  it('returns null for fewer than 2 points', () => {
    expect(godotPolylineToSegments([], true)).toBeNull();
    expect(godotPolylineToSegments([0, 0], true)).toBeNull();
  });

  it('closed 2-point polygon → 2 segments (4 positions)', () => {
    const pts = [0, 0, 16, 0];
    const out = godotPolylineToSegments(pts, true);
    expect(out).toBeDefined();
    expect(out!.length).toBe(12); // 2 segments * 2 ends * 3 components
    // Check the second segment wraps back: (16,0) → (0,0)
    expect(out![3]).toBe(16);
    expect(out![4]).toBeFalsy(); // y = 0 (may be -0, use toBeFalsy)
    expect(out![8]).toBeFalsy();
    expect(out![9]).toBeFalsy();
  });

  it('open 2-point polygon → 1 segment (2 positions)', () => {
    const pts = [0, 0, 16, 0];
    const out = godotPolylineToSegments(pts, false);
    expect(out).toBeDefined();
    expect(out!.length).toBe(6); // 1 segment * 2 ends * 3 components
  });

  it('closed 4-pt square → 4 segments (8 positions)', () => {
    const pts = [0, 0, 16, 0, 16, 16, 0, 16];
    const out = godotPolylineToSegments(pts, true);
    expect(out!.length).toBe(24); // 4 segments * 2 * 3
  });

  it('open 4-pt chain → 3 segments (6 positions)', () => {
    const pts = [0, 0, 16, 0, 16, 16, 0, 16];
    const out = godotPolylineToSegments(pts, false);
    expect(out!.length).toBe(18); // 3 segments * 2 * 3
  });

  it('y-negates correctly (Godot Y-down → three Y-up)', () => {
    // Points (0,10) and (10,0), open → 1 segment.
    const out = godotPolylineToSegments([0, 10, 10, 0], false);
    // First point (0, 10) → y = -10 in three-space
    expect(out![1]).toBe(-10);
    // Second point (10, 0) → y = 0 (may be -0)
    expect(out![4]).toBeFalsy();
  });
});
