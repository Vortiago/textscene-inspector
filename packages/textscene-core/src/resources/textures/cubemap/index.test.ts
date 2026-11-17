import { describe, expect, it } from 'vitest';
import { resourceSliceRegistry } from '../../sliceRegistration';
import './index';

describe('cubemap slice registration', () => {
  it('claims Cubemap for the resource bus slot, since its faces are text', () => {
    const registration = resourceSliceRegistry.byTypeName('Cubemap');
    expect(registration?.slice).toBe('cubemap');
    expect(registration?.kind).toBe('godot-text');
    expect(registration?.busType).toBe('resource');
  });

  it('claims no file extension, since a .tres is any text resource (edge case)', () => {
    expect(resourceSliceRegistry.all().find((r) => r.slice === 'cubemap')?.extensions).toBeUndefined();
  });
});
