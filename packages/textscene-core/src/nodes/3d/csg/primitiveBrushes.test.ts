/**
 * Every CSG primitive builds a closed brush, since Godot's manifold would empty an open one and
 * these shapes draw. Each case writes the properties that change the topology: a cone's apex,
 * the fewest sides, a spin short of a full turn and a flipped winding.
 */

import { describe, expect, it } from 'vitest';
import { isClosedBrush, weldCorners } from './brushManifold';
import type { CsgGeometryBuilder } from '../../../r3f/csg/csgRegistration';
import { heading } from '../../../parser/testing/parserKit';
import type { ParsedHeading } from '../../../parser/utils';
import { csgGeometryContext } from '../../../r3f/csg/testing/csgGeometryContext';
import { parseCSGBox3D } from './csgbox3d/parser';
import { csgBox3DGeometry } from './csgbox3d/csgGeometry';
import { parseCSGCylinder3D } from './csgcylinder3d/parser';
import { csgCylinder3DGeometry } from './csgcylinder3d/csgGeometry';
import { parseCSGPolygon3D } from './csgpolygon3d/parser';
import { csgPolygon3DGeometry } from './csgpolygon3d/csgGeometry';
import { parseCSGSphere3D } from './csgsphere3d/parser';
import { csgSphere3DGeometry } from './csgsphere3d/csgGeometry';
import { parseCSGTorus3D } from './csgtorus3d/parser';
import { csgTorus3DGeometry } from './csgtorus3d/csgGeometry';

type Parse = (heading: ParsedHeading, properties: Record<string, string>) => unknown;

/** Whether the welded brush of `type`, written with `properties`, is closed. */
function isClosed(
  type: string,
  parse: Parse,
  build: CsgGeometryBuilder,
  properties: Record<string, string> = {}
): boolean {
  const parsed = parse(heading(type), properties) as Record<string, unknown>;
  const { geometry } = build(parsed, csgGeometryContext())!;
  return isClosedBrush(weldCorners(geometry.getAttribute('position').array as Float32Array));
}

describe('a CSG primitive brush', () => {
  it.each([
    ['CSGBox3D', 'CSGBox3D', parseCSGBox3D, csgBox3DGeometry, {}],
    ['CSGBox3D with flip_faces', 'CSGBox3D', parseCSGBox3D, csgBox3DGeometry, { flip_faces: 'true' }],
    ['CSGSphere3D', 'CSGSphere3D', parseCSGSphere3D, csgSphere3DGeometry, {}],
    [
      'CSGSphere3D with flat faces',
      'CSGSphere3D',
      parseCSGSphere3D,
      csgSphere3DGeometry,
      { smooth_faces: 'false' },
    ],
    ['CSGCylinder3D', 'CSGCylinder3D', parseCSGCylinder3D, csgCylinder3DGeometry, {}],
    ['CSGCylinder3D as a cone', 'CSGCylinder3D', parseCSGCylinder3D, csgCylinder3DGeometry, { cone: 'true' }],
    [
      'CSGCylinder3D with three sides',
      'CSGCylinder3D',
      parseCSGCylinder3D,
      csgCylinder3DGeometry,
      { sides: '3' },
    ],
    ['CSGTorus3D', 'CSGTorus3D', parseCSGTorus3D, csgTorus3DGeometry, {}],
    ['CSGPolygon3D', 'CSGPolygon3D', parseCSGPolygon3D, csgPolygon3DGeometry, {}],
    [
      'CSGPolygon3D spun a half turn',
      'CSGPolygon3D',
      parseCSGPolygon3D,
      csgPolygon3DGeometry,
      { mode: '1', spin_degrees: '180' },
    ],
  ])('closes for a %s', (_label, type, parse, build, properties) => {
    expect(isClosed(type, parse, build, properties)).toBe(true);
  });
});
