/**
 * The Skin slice's routing claims (ADR-0031). Importing the index registers them, and these
 * assertions are what a router reads back out.
 */

import { describe, expect, it } from 'vitest';
import { resourceSliceRegistry } from '../sliceRegistration';
import './index';

describe('skin slice registration', () => {
  it('claims Skin for the generic resource bus slot', () => {
    const registration = resourceSliceRegistry.byTypeName('Skin');
    expect(registration?.slice).toBe('skin');
    expect(registration?.kind).toBe('godot-text');
    expect(registration?.busType).toBe('resource');
  });

  it('claims no file extension, as a .tres is the shared text container', () => {
    expect(resourceSliceRegistry.byTypeName('Skin')?.extensions).toBeUndefined();
  });
});
