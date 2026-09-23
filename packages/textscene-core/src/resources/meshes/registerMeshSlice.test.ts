/**
 * The primitive-mesh slices' routing claims (ADR-0031), one table over the eight.
 * Importing a slice index registers it. ArrayMesh claims its own `arraymesh` bus
 * slot and is asserted in `arraymesh/registration.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { resourceSliceRegistry } from '../sliceRegistration';
// Side-effect imports: a slice index registers its claims on load.
import './boxmesh';
import './spheremesh';
import './planemesh';
import './quadmesh';
import './cylindermesh';
import './capsulemesh';
import './torusmesh';
import './prismmesh';

/** Every primitive-mesh type this package claims, with the slice that claims it. */
const CLAIMS: readonly (readonly [string, string])[] = [
  ['BoxMesh', 'boxmesh'],
  ['SphereMesh', 'spheremesh'],
  ['PlaneMesh', 'planemesh'],
  ['QuadMesh', 'quadmesh'],
  ['CylinderMesh', 'cylindermesh'],
  ['CapsuleMesh', 'capsulemesh'],
  ['TorusMesh', 'torusmesh'],
  ['PrismMesh', 'prismmesh'],
];

describe('primitive-mesh slice registrations', () => {
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

  it('keeps ArrayMesh on its own bus slot rather than the primitives one', () => {
    expect(resourceSliceRegistry.busTypeFor('ArrayMesh')).not.toBe('resource');
  });
});
