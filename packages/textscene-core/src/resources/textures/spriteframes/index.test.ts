/**
 * The slice's routing claim: importing the entry point must register
 * `SpriteFrames` on the generic `resource` slot (its `animations` value is text,
 * so it rides a ParsedResource — not a texture).
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
