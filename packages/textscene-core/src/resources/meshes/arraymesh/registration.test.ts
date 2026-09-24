/**
 * The ArrayMesh slice's routing claim (ADR-0031). Importing the index registers
 * it, and these assertions read back what a router reads.
 */

import { describe, expect, it } from 'vitest';
import { resourceSliceRegistry } from '../../sliceRegistration';
import './index';

describe('arraymesh slice registration', () => {
  it('claims ArrayMesh for its own bus slot', () => {
    expect(resourceSliceRegistry.byTypeName('ArrayMesh')).toMatchObject({
      slice: 'arraymesh',
      kind: 'godot-text',
      busType: 'arraymesh',
      failureLabel: 'Node using ArrayMesh',
    });
  });

  it('routes ArrayMesh to the arraymesh processor slot, not the generic resource slot', () => {
    expect(resourceSliceRegistry.busTypeFor('ArrayMesh')).toBe('arraymesh');
  });

  it('claims no file extension — `.tres` is the shared Godot-text container', () => {
    expect(resourceSliceRegistry.byTypeName('ArrayMesh')?.extensions).toBeUndefined();
  });
});
