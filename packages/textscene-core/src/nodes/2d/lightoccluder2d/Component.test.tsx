/**
 * <LightOccluder2D> component tests — topology, gizmo gate, and absent resource.
 *
 * Mirrors the contract in the Behavioral Contract (lightoccluder2d-contract.test.tsx)
 * but is standalone: no imports from the contract test file.
 */
import { describe, expect, it } from 'vitest';
import { Linter } from '../../../linter/Linter';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { fixturesDir } from '../../../parser/testing/parserKit';
import { polygonToSegments } from './polygonShapes';

// Import the slice's self-registration side effects.
import '../../2d/lightoccluder2d/index';
import '../../2d/lightoccluder2d/index.r3f';
import '../../../linter/index';

describe('polygonToSegments', () => {
  it('returns null for fewer than 2 points', () => {
    expect(polygonToSegments([], true)).toBeNull();
    expect(polygonToSegments([0, 0], true)).toBeNull();
  });

  it('closed 2-point polygon → 2 segments (4 positions)', () => {
    const pts = [0, 0, 16, 0];
    const out = polygonToSegments(pts, true);
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
    const out = polygonToSegments(pts, false);
    expect(out).toBeDefined();
    expect(out!.length).toBe(6); // 1 segment * 2 ends * 3 components
  });

  it('closed 4-pt square → 4 segments (8 positions)', () => {
    const pts = [
      0, 0, 16, 0,
      16, 16, 0, 16,
    ];
    const out = polygonToSegments(pts, true);
    expect(out!.length).toBe(24); // 4 segments * 2 * 3
  });

  it('open 4-pt chain → 3 segments (6 positions)', () => {
    const pts = [
      0, 0, 16, 0,
      16, 16, 0, 16,
    ];
    const out = polygonToSegments(pts, false);
    expect(out!.length).toBe(18); // 3 segments * 2 * 3
  });

  it('y-negates correctly (Godot Y-down → three Y-up)', () => {
    // Points (0,10) and (10,0), open → 1 segment.
    const out = polygonToSegments([0, 10, 10, 0], false);
    // First point (0, 10) → y = -10 in three-space
    expect(out![1]).toBe(-10);
    // Second point (10, 0) → y = 0 (may be -0)
    expect(out![4]).toBeFalsy();
  });
});

describe('LightOccluder2D registration', () => {
  it('registers LightOccluder2D in the node (parser) registry', () => {
    expect(nodeRegistry.getRegistration('LightOccluder2D')).toBeTruthy();
  });

  it('registers a LightOccluder2D r3f component', () => {
    expect(nodeComponentRegistry.get('LightOccluder2D')).toBeDefined();
  });
});

describe('LightOccluder2D fixture is lint-clean', () => {
  it('fixture unit-lightoccluder2d.tscn lints with no errors', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const raw = readFileSync(resolve(fixturesDir(), 'unit-lightoccluder2d.tscn'), 'utf8');
    const errors = new Linter().lint(raw).filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});
