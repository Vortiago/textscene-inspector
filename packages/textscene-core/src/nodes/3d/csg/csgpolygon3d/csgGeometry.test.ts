/**
 * `csgPolygon3DGeometryKey` must be a stable string over EXACTLY what
 * `csgPolygon3DGeometry` reads, because it is the boolean evaluation cache's key.
 *
 * Every "keys differ" assertion is paired with a "geometry differs" one: a key test alone
 * passes under any serialisation change, including a wrong one, whereas the pair pins the
 * contract that a shape change can never reuse a cached boolean. The pairs run in PATH
 * mode deliberately — that is the only mode in which `pathPlan` reads the curve at all.
 */

import { describe, expect, it } from 'vitest';
import type { Curve3DControlPoint } from '../../../../resources/shapes/curve3d';
import { identityTransform3D } from '../../../../utils/transform';
import type { Transform3D } from '../../../base/node3d/types';
import { csgPolygon3DGeometry, csgPolygon3DGeometryKey } from './csgGeometry';
import { PathIntervalType, PathRotation, PolygonMode } from './polygonGeometry';
import type { CSGPolygon3DProperties } from './types';

const EMPTY_CTX = { internalResources: [], externalResources: [] };

const ZERO = { x: 0, y: 0, z: 0 } as const;

/** Two points along -Z with no handles, so the span takes the straight shortcut. */
function straightCurve(): Curve3DControlPoint[] {
  return [
    { in: { ...ZERO }, out: { ...ZERO }, position: { x: 0, y: 0, z: 0 } },
    { in: { ...ZERO }, out: { ...ZERO }, position: { x: 0, y: 0, z: -4 } },
  ];
}

const translation = (x: number): Transform3D => ({
  ...identityTransform3D(),
  origin: { x, y: 0, z: 0 },
});

function pathProperties(
  overrides: Partial<CSGPolygon3DProperties> = {}
): CSGPolygon3DProperties {
  return {
    name: 'Poly',
    polygon: new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]),
    mode: PolygonMode.PATH,
    depth: 1,
    spinDegrees: 360,
    spinSides: 8,
    smoothFaces: false,
    flipFaces: false,
    pathIntervalType: PathIntervalType.DISTANCE,
    pathInterval: 1,
    pathSimplifyAngle: 0,
    pathRotation: PathRotation.PATH_FOLLOW,
    pathRotationAccurate: false,
    pathLocal: false,
    pathContinuousU: true,
    pathUDistance: 1,
    pathJoined: false,
    resolvedPath: { curvePoints: straightCurve(), baseTransform: null },
    ...overrides,
  };
}

const key = (p: CSGPolygon3DProperties): string =>
  csgPolygon3DGeometryKey(p as unknown as Record<string, unknown>);

/** Vertex positions as a comparable string; null geometry is its own value. */
function shapeOf(p: CSGPolygon3DProperties): string {
  const geometry = csgPolygon3DGeometry(p as unknown as Record<string, unknown>, EMPTY_CTX);
  if (!geometry) return 'null';
  const position = geometry.getAttribute('position');
  return Array.from(position.array as Float32Array)
    .map((n) => n.toFixed(4))
    .join(',');
}

/** Properties whose resolved path carries exactly these points and transform. */
const withCurve = (
  curvePoints: Curve3DControlPoint[],
  baseTransform: Transform3D | null = null
): CSGPolygon3DProperties => pathProperties({ resolvedPath: { curvePoints, baseTransform } });

/** The file's contract under one name: a shape change can never reuse a cached boolean. */
function expectShapeAndKeyDiffer(a: CSGPolygon3DProperties, b: CSGPolygon3DProperties): void {
  expect(shapeOf(a)).not.toBe(shapeOf(b));
  expect(key(a)).not.toBe(key(b));
}

describe('csgPolygon3DGeometryKey', () => {
  it('is stable across structurally-equal property objects', () => {
    // The reason the key exists: the parser allocates a fresh properties object and a
    // fresh resolvedPath per reparse, and the source pane reparses on every keystroke.
    expect(key(pathProperties())).toBe(key(pathProperties()));
  });

  it('changes when a control point moves', () => {
    const moved = straightCurve();
    moved[1]!.position.z = -6;
    expectShapeAndKeyDiffer(pathProperties(), withCurve(moved));
  });

  it("changes when only a control point's out handle moves", () => {
    // tessellateCurve3D reads a.out for the cubic-Bézier span (curve3d.ts:172-175), so a
    // dragged tangent handle is a shape change with every position left untouched.
    const curved = straightCurve();
    curved[0]!.out = { x: 3, y: 0, z: 0 };
    expectShapeAndKeyDiffer(pathProperties(), withCurve(curved));
  });

  it("changes when only a control point's in handle moves", () => {
    const curved = straightCurve();
    curved[1]!.in = { x: 0, y: 2, z: 0 };
    expectShapeAndKeyDiffer(pathProperties(), withCurve(curved));
  });

  it('changes when only the resolved baseTransform moves', () => {
    // Moving the Path3D rewrites baseTransform and nothing else; the builder places every
    // extrusion frame through it.
    expectShapeAndKeyDiffer(
      withCurve(straightCurve(), translation(1)),
      withCurve(straightCurve(), translation(5))
    );
  });

  it('changes when baseTransform appears, which is path_local turning off', () => {
    expectShapeAndKeyDiffer(pathProperties(), withCurve(straightCurve(), translation(3)));
  });

  it('changes when a non-path scalar changes', () => {
    expectShapeAndKeyDiffer(
      pathProperties({ mode: PolygonMode.DEPTH, depth: 1 }),
      pathProperties({ mode: PolygonMode.DEPTH, depth: 2 })
    );
  });

  it('keys an unresolved path without throwing, and stably', () => {
    const unresolved = () => pathProperties({ resolvedPath: undefined });
    expect(key(unresolved())).toBe(key(unresolved()));
  });

  it('keys an empty curve stably, and distinctly from a populated one', () => {
    const empty = () => withCurve([]);
    expect(key(empty())).toBe(key(empty()));
    expectShapeAndKeyDiffer(empty(), pathProperties());
  });
});
