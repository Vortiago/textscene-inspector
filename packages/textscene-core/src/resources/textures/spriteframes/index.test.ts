/**
 * The slice's routing claim: importing the entry point registers `SpriteFrames`
 * on the `resource` slot, since its `animations` value is text.
 */
import { describe, it, expect } from 'vitest';
import './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

describe('spriteframes slice registration', () => {
  it('claims the SpriteFrames type name', () => {
    const registration = resourceSliceRegistry.byTypeName('SpriteFrames');
    expect(registration).toMatchObject({
      slice: 'spriteframes',
      kind: 'godot-text',
      busType: 'resource',
      failureLabel: 'Resource',
    });
  });

  it('routes SpriteFrames to the resource bus slot', () => {
    expect(resourceSliceRegistry.busTypeFor('SpriteFrames')).toBe('resource');
  });

  it('claims no file extension — a SpriteFrames arrives as a .tres like any resource', () => {
    expect(resourceSliceRegistry.byTypeName('SpriteFrames')!.extensions).toBeUndefined();
  });
});
