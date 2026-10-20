/**
 * The binary resource slice's routing claims (ADR-0031). Importing the index registers them, and
 * these assertions are what a router reads back out.
 */

import { describe, expect, it } from 'vitest';
import { resourceSliceRegistry } from '../../sliceRegistration';
import { isBinaryResourceType } from '../../resourceProviderUtils';
import './index';

describe('binaryresource slice registration', () => {
  it('claims the lightmap bake extension for the generic resource bus slot', () => {
    const registration = resourceSliceRegistry.byExtension('.lmbake');
    expect(registration?.slice).toBe('binaryresource');
    expect(registration?.kind).toBe('foreign-format');
    expect(registration?.busType).toBe('resource');
  });

  it('fetches a bake as bytes', () => {
    expect(isBinaryResourceType('LightmapGIData', 'res://scene.lmbake')).toBe(true);
  });

  it('routes a bake path to the bus slot its extension claims', () => {
    expect(resourceSliceRegistry.busTypeOfPath('res://bakes/scene.lmbake')).toBe('resource');
  });

  it('routes a path whose extension no slice claims nowhere (edge case)', () => {
    expect(resourceSliceRegistry.busTypeOfPath('res://scene.res')).toBeNull();
    expect(resourceSliceRegistry.busTypeOfPath('res://no_extension')).toBeNull();
  });

  it('claims no type name, so a LightmapGIData in a text .tres still arrives as text', () => {
    expect(isBinaryResourceType('LightmapGIData', 'res://scene.tres')).toBe(false);
  });
});
