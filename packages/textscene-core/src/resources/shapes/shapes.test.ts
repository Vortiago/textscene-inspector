/**
 * Cross-slice collision-shape tests: the resource-slice claim table (ADR-0031)
 * and the shared `PackedVector3Array` grammar the two polygon shapes decode
 * through. Each slice's own property mapping lives in its `decode.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { resourceSliceRegistry } from '../sliceRegistration';
import { parsePackedVector3Array } from './packedArray';
// Side-effect imports: a slice index registers its claims on load.
import './boxshape3d';
import './sphereshape3d';
import './capsuleshape3d';
import './cylindershape3d';
import './convexpolygonshape3d';
import './concavepolygonshape3d';
import './rectangleshape2d';
import './circleshape2d';
import './capsuleshape2d';

/** Every shape type this package claims, with the slice folder that claims it. */
const CLAIMS: readonly (readonly [string, string])[] = [
  ['BoxShape3D', 'boxshape3d'],
  ['SphereShape3D', 'sphereshape3d'],
  ['CapsuleShape3D', 'capsuleshape3d'],
  ['CylinderShape3D', 'cylindershape3d'],
  ['ConvexPolygonShape3D', 'convexpolygonshape3d'],
  ['ConcavePolygonShape3D', 'concavepolygonshape3d'],
  ['RectangleShape2D', 'rectangleshape2d'],
  ['CircleShape2D', 'circleshape2d'],
  ['CapsuleShape2D', 'capsuleshape2d'],
];

describe('collision-shape slice registrations', () => {
  it.each(CLAIMS)('%s is claimed by the %s slice', (typeName, slice) => {
    expect(resourceSliceRegistry.byTypeName(typeName)).toMatchObject({
      slice,
      kind: 'godot-text',
      busType: 'resource',
      failureLabel: 'Resource',
    });
  });

  it.each(CLAIMS)('%s routes to the generic resource processor slot', (typeName) => {
    expect(resourceSliceRegistry.busTypeFor(typeName)).toBe('resource');
  });

  it('claims no file extension — `.tres` is the shared Godot-text container', () => {
    for (const [typeName] of CLAIMS) {
      expect(resourceSliceRegistry.byTypeName(typeName)?.extensions).toBeUndefined();
    }
  });

  it('leaves a shape type nobody implements unclaimed by these slices', () => {
    const unimplemented = resourceSliceRegistry.byTypeName('WorldBoundaryShape3D');
    expect(CLAIMS.some(([, slice]) => slice === unimplemented?.slice)).toBe(false);
  });
});

describe('parsePackedVector3Array', () => {
  it('parses a flat list of vertices', () => {
    const arr = parsePackedVector3Array('PackedVector3Array(1, 2, 3, 4, 5, 6)');
    expect(Array.from(arr)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('returns empty for an empty array', () => {
    expect(parsePackedVector3Array('PackedVector3Array()').length).toBe(0);
  });

  it('throws on malformed input', () => {
    expect(() => parsePackedVector3Array('not-an-array')).toThrow();
  });
});
