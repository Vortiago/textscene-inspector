/**
 * What the parity comparison reports for a slice. A pending slice is a declared render gap, so an
 * unread key that Godot declares is a gap, and a key Godot does not declare is a typo.
 */
import { describe, expect, it } from 'vitest';
import { collectSlices, isEngineProperty, unreadValidatorKeys } from './propertyGrammarParityCheck.js';

describe('isEngineProperty', () => {
  it('finds a property the class declares', () => {
    expect(isEngineProperty('GPUParticlesCollisionSDF3D', 'thickness')).toBe(true);
  });

  it('finds a property an ancestor declares', () => {
    expect(isEngineProperty('GPUParticlesCollisionSDF3D', 'cull_mask')).toBe(true);
  });

  it('finds a property of a class the pinned build lacks', () => {
    expect(isEngineProperty('AreaLight3D', 'area_range')).toBe(true);
  });

  it('refuses a key Godot does not declare for the class (error case)', () => {
    expect(isEngineProperty('GPUParticlesCollisionSDF3D', 'cull_maks')).toBe(false);
  });

  it('takes a wildcard key as the family it names, which the rows do not list (edge case)', () => {
    expect(isEngineProperty('Skeleton3D', 'bones/*')).toBe(true);
  });
});

describe('unreadValidatorKeys', () => {
  const input = {
    nodeType: 'GPUParticlesCollisionSDF3D',
    validatorKeys: new Set(['size', 'thickness', 'cull_maks']),
    parserProps: new Set(['size']),
    allowed: new Set<string>(),
  };

  it('reports every unread key of a slice that draws', () => {
    expect(unreadValidatorKeys({ ...input, isPending: false })).toEqual(['cull_maks', 'thickness']);
  });

  it('reports only the key Godot does not declare for a pending slice', () => {
    expect(unreadValidatorKeys({ ...input, isPending: true })).toEqual(['cull_maks']);
  });

  it('leaves an allowlisted key out', () => {
    const allowed = new Set(['thickness', 'cull_maks']);
    expect(unreadValidatorKeys({ ...input, allowed, isPending: false })).toEqual([]);
  });
});

describe('collectSlices', () => {
  const isPending = (nodeType: string) => collectSlices().find((s) => s.nodeType === nodeType)?.isPending;

  it('takes pending from the component registry the previewer reads', () => {
    expect(isPending('GPUParticlesCollisionBox3D')).toBe(true);
  });

  it('is not pending for a node that draws', () => {
    expect(isPending('Camera3D')).toBe(false);
  });
});
