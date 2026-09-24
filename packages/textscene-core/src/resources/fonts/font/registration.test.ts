/**
 * The Font slice's routing claims (ADR-0031). Importing the index registers
 * them; these assertions are what a router reads back out.
 */

import { describe, expect, it } from 'vitest';
import { registerResourceSlice, resourceSliceRegistry } from '../../sliceRegistration';
import { isBinaryResourceType } from '../../resourceProviderUtils';
import { FONT_SUB_RESOURCE_TYPES } from './decode';
import './index';

const FONT_TYPES = [...FONT_SUB_RESOURCE_TYPES];

describe('font slice registration', () => {
  it('claims exactly the type names the decode gate accepts', () => {
    // The claim is a promise the processor can serve the type. A name claimed
    // here but missing from the decode's `SubResource` gate routes to the font
    // processor, which then throws `Not a font resource type`: a missing-resources
    // row for a type the table said it would serve.
    expect(resourceSliceRegistry.byTypeName('FontFile')?.typeNames).toEqual(FONT_TYPES);
  });

  it('claims all three Godot font type names for the font bus slot', () => {
    for (const typeName of FONT_TYPES) {
      const registration = resourceSliceRegistry.byTypeName(typeName);
      expect(registration?.slice).toBe('font');
      expect(registration?.kind).toBe('godot-text');
      expect(resourceSliceRegistry.busTypeFor(typeName)).toBe('font');
      expect(registration?.failureLabel).toBe('Node using font');
    }
  });

  it('claims no extension — a Font arrives as .tres or as raw container bytes', () => {
    // `.tres` is the shared Godot-text container no slice may claim, and the
    // raw containers belong to the `dynamicfont` slice.
    expect(resourceSliceRegistry.byTypeName('FontFile')?.extensions).toBeUndefined();
    expect(resourceSliceRegistry.byExtension('.ttf')?.slice).toBe('dynamicfont');
  });

  it('keeps every font TYPE name non-binary', () => {
    // The invariant this two-slice split exists for: a `FontFile` ExtResource
    // just as often names a text `.tres` wrapper carrying `fallbacks` rather
    // than font bytes of its own, and fetching that as bytes yields a string
    // no parser can read. Only the extension is a binary signal.
    for (const typeName of FONT_TYPES) {
      expect(resourceSliceRegistry.byTypeName(typeName)?.binaryBytes).toBeFalsy();
      expect(isBinaryResourceType(typeName)).toBe(false);
      expect(isBinaryResourceType(typeName, 'res://theme/fonts/montserrat.tres')).toBe(false);
    }
  });

  it('still fetches a font TYPE pointing at a raw container as bytes', () => {
    // Type and path are independent signals: the same `FontFile` type name is
    // binary when the path it names is one.
    expect(isBinaryResourceType('FontFile', 'res://fonts/Xolonium-Regular.ttf')).toBe(true);
  });

  it('rejects a second slice claiming FontFile', () => {
    expect(() =>
      registerResourceSlice({
        slice: 'not-font',
        kind: 'godot-text',
        typeNames: ['FontFile'],
        busType: null,
        failureLabel: 'Impostor',
      })
    ).toThrow(/already claimed by slice "font"/);
  });
});
