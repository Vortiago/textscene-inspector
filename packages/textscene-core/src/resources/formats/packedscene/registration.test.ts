/**
 * The PackedScene slice's routing claims (ADR-0031). Importing the index registers them,
 * and these assertions are what a router reads back out.
 */

import { describe, expect, it } from 'vitest';
import { registerResourceSlice, resourceSliceRegistry } from '../../sliceRegistration';
import './index';

describe('packedscene slice registration', () => {
  it('claims PackedScene for the scene bus slot', () => {
    const registration = resourceSliceRegistry.byTypeName('PackedScene');
    expect(registration?.slice).toBe('packedscene');
    expect(registration?.kind).toBe('foreign-format');
    expect(resourceSliceRegistry.busTypeFor('PackedScene')).toBe('scene');
    expect(registration?.failureLabel).toBe('Node instance of scene');
  });

  it('claims .tscn as TEXT — a claimed extension is not a binary one', () => {
    const registration = resourceSliceRegistry.byExtension('.tscn');
    expect(registration?.slice).toBe('packedscene');
    expect(registration?.binaryBytes).toBeFalsy();
  });

  it('leaves binary .scn unclaimed', () => {
    // No loader produces a ParsedResource from binary, and a claim would
    // route a file nothing can read.
    expect(resourceSliceRegistry.byExtension('.scn')).toBeNull();
  });

  it('rejects a second slice claiming PackedScene', () => {
    expect(() =>
      registerResourceSlice({
        slice: 'not-packedscene',
        kind: 'foreign-format',
        typeNames: ['PackedScene'],
        busType: null,
        failureLabel: 'Impostor',
      })
    ).toThrow(/already claimed by slice "packedscene"/);
  });
});
