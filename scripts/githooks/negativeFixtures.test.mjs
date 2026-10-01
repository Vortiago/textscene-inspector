import { describe, expect, it } from 'vitest';
import { isNegativeFixture } from './negativeFixtures.mjs';

describe('isNegativeFixture', () => {
  it('names a listed fixture by its basename, at any depth', () => {
    expect(isNegativeFixture('scenes/fixtures/edge-invalid-transform.tscn')).toBe(true);
    expect(
      isNegativeFixture(
        '/repo/scenes/fixtures/gltf-unsupported-required-extension/edge-gltf-unsupported-required-extension.tscn'
      )
    ).toBe(true);
  });

  it('cuts a Windows path at its backslashes', () => {
    expect(isNegativeFixture('C:\\repo\\scenes\\fixtures\\edge-invalid-transform.tscn')).toBe(true);
  });

  it('passes a scene the list does not name', () => {
    expect(isNegativeFixture('scenes/fixtures/unit-sprite2d.tscn')).toBe(false);
  });

  it('matches the whole basename, not a directory of that name', () => {
    expect(isNegativeFixture('scenes/edge-invalid-transform.tscn/unit-a.tscn')).toBe(false);
  });
});
