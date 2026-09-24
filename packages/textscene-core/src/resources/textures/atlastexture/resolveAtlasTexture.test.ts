/**
 * Decoding a loaded standalone AtlasTexture `.tres`. `SubResourceResolver.test.ts`
 * covers `resolveExtAtlasTexturePath`, and `useTexture2D.test.tsx` covers
 * `resolveAtlasTextureRef` and `resolveAtlasTexture`.
 */
import { describe, expect, it } from 'vitest';
import type { ParsedResource } from '../../../parser/parsedResource';
import { decodeExtAtlasTextureRef } from './resolveAtlasTexture';

describe('decodeExtAtlasTextureRef', () => {
  it('decodes a loaded AtlasTexture .tres into the reference shape', () => {
    const tres: ParsedResource = {
      resourceType: 'AtlasTexture',
      properties: { atlas: 'ExtResource("1_sheet")', region: 'Rect2(32, 32, 64, 64)' },
      extResources: [{ id: '1_sheet', type: 'Texture2D', path: 'res://sheet.png' }],
      subResources: [],
    };

    expect(decodeExtAtlasTextureRef('res://icon.tres', tres)).toEqual({
      id: 'res://icon.tres',
      texture: {
        atlas: 'ExtResource("1_sheet")',
        region: { x: 32, y: 32, width: 64, height: 64 },
        margin: { x: 0, y: 0, width: 0, height: 0 },
        filterClip: false,
      },
    });
  });

  it('declines a .tres whose own header names a different resource type', () => {
    const tres: ParsedResource = {
      resourceType: 'StyleBoxFlat',
      properties: {},
      extResources: [],
      subResources: [],
    };

    expect(decodeExtAtlasTextureRef('res://icon.tres', tres)).toBeNull();
  });
});
