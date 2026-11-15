/**
 * The SkeletonModificationStack2D slice's routing claims (ADR-0031). Importing the index registers
 * them, and these assertions are what a router reads back out.
 */

import { describe, expect, it } from 'vitest';
import { resourceSliceRegistry } from '../../sliceRegistration';
import './index';

const CLAIMED = [
  'SkeletonModificationStack2D',
  'SkeletonModification2DLookAt',
  'SkeletonModification2DTwoBoneIK',
  'SkeletonModification2DCCDIK',
  'SkeletonModification2DFABRIK',
  'SkeletonModification2DStackHolder',
  'SkeletonModification2DJiggle',
  'SkeletonModification2DPhysicalBones',
];

describe('skeletonmodificationstack2d slice registration', () => {
  it.each(CLAIMED)('claims %s for the generic resource bus slot', (typeName) => {
    const registration = resourceSliceRegistry.byTypeName(typeName);

    expect(registration?.slice).toBe('skeletonmodificationstack2d');
    expect(registration?.kind).toBe('godot-text');
    expect(registration?.busType).toBe('resource');
  });

  it('claims no file extension, as a .tres is the shared text container', () => {
    expect(resourceSliceRegistry.byTypeName('SkeletonModificationStack2D')?.extensions).toBeUndefined();
  });
});
