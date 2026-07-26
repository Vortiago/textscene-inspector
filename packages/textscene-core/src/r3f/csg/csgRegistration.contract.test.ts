/**
 * Every CSG type must expose its solid as data, and must expose a stable key with it.
 *
 * Both halves have a specific failure mode. A CSG type registering a component but no
 * builder renders correctly on its own and silently contributes NOTHING to a boolean, so
 * a subtraction quietly stops cutting. A builder without a `geometryKey` makes the
 * evaluation cache miss on every reparse, because the parser allocates fresh property
 * objects per parse and the source pane reparses on every keystroke: correct output,
 * every boolean in the scene re-run per character typed.
 *
 * Neither shows up as a test failure anywhere else, which is why this is a contract test
 * over the live registry rather than a per-slice assertion.
 */

import { describe, expect, it } from 'vitest';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import '../nodes/index';

/** Every CSG type the parser can produce. */
const CSG_TYPES = [
  'CSGBox3D',
  'CSGCylinder3D',
  'CSGSphere3D',
  'CSGTorus3D',
  'CSGMesh3D',
  'CSGPolygon3D',
  'CSGCombiner3D',
] as const;

const EMPTY_CTX = { internalResources: [], externalResources: [] };

describe('CSG shape registration', () => {
  it('registers a component for every CSG type', () => {
    for (const type of CSG_TYPES) {
      expect(nodeComponentRegistry.get(type), `${type} has no component`).toBeDefined();
    }
  });

  it('registers a csgShape for every CSG type', () => {
    // Without this the type is invisible to the plan builder and contributes nothing.
    for (const type of CSG_TYPES) {
      expect(nodeComponentRegistry.isCsgShape(type), `${type} is not a CSG shape`).toBe(true);
    }
  });

  it('does not mark non-CSG types as CSG shapes', () => {
    for (const type of ['MeshInstance3D', 'Node3D', 'Path3D', 'Sprite3D']) {
      expect(nodeComponentRegistry.isCsgShape(type), `${type} should not be a CSG shape`).toBe(false);
    }
  });

  it('pairs every geometry builder with a geometryKey', () => {
    for (const type of CSG_TYPES) {
      const registration = nodeComponentRegistry.getCsgShape(type)!;
      if (registration.geometry === null) continue;
      expect(typeof registration.geometryKey, `${type} has a builder but no geometryKey`).toBe(
        'function'
      );
    }
  });

  it('gives CSGCombiner3D a null builder, which is a decision rather than an omission', () => {
    const registration = nodeComponentRegistry.getCsgShape('CSGCombiner3D')!;
    expect(registration.geometry).toBeNull();
  });

  it('produces a key that is stable across structurally-equal property objects', () => {
    // The whole reason geometryKey exists. A key varying with object identity would
    // invalidate the evaluation cache on every keystroke.
    const properties = () => ({
      name: 'B',
      size: { x: 1, y: 2, z: 3 },
      flipFaces: false,
    });
    const { geometryKey } = nodeComponentRegistry.getCsgShape('CSGBox3D')!;
    expect(geometryKey!(properties(), EMPTY_CTX)).toBe(geometryKey!(properties(), EMPTY_CTX));
  });

  it('produces a key that CHANGES when the shape changes', () => {
    const { geometryKey } = nodeComponentRegistry.getCsgShape('CSGBox3D')!;
    const at = (x: number) =>
      geometryKey!({ name: 'B', size: { x, y: 1, z: 1 }, flipFaces: false }, EMPTY_CTX);
    expect(at(1)).not.toBe(at(2));
  });

  it('keys CSGMesh3D on the sub-resource CONTENT, not on its reference string', () => {
    // The mesh reference stays "SubResource(...)" while the geometry it names changes,
    // so a properties-only key would serve a stale boolean.
    const { geometryKey } = nodeComponentRegistry.getCsgShape('CSGMesh3D')!;
    const properties = { name: 'M', mesh: 'SubResource("BoxMesh_1")', flipFaces: false };
    const withSize = (size: string) =>
      geometryKey!(properties, {
        internalResources: [{ id: 'BoxMesh_1', type: 'BoxMesh', data: { size } }],
        externalResources: [],
      });
    expect(withSize('Vector3(1, 1, 1)')).not.toBe(withSize('Vector3(2, 2, 2)'));
  });
});
