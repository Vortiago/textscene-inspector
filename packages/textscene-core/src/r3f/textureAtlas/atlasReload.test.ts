import { describe, expect, it, vi } from 'vitest';
import { decalAtlasTexture } from '../../nodes/3d/decal/decalAtlas';
import { areaLightAtlasTexture, installAreaLightAtlas } from '../areaLight/areaLightAtlas';
import { installGodotDecals } from '../decal/decalShaderChunk';

describe('an atlas module reload', () => {
  it('reuses the two distinct textures already installed for the materials', async () => {
    installGodotDecals();
    installAreaLightAtlas();
    const decal = decalAtlasTexture();
    const area = areaLightAtlasTexture();
    expect(decal).not.toBe(area);

    vi.resetModules();
    const reloadedDecal = await import('../../nodes/3d/decal/decalAtlas');
    const reloadedArea = await import('../areaLight/areaLightAtlas');

    expect(reloadedDecal.decalAtlasTexture()).toBe(decal);
    expect(reloadedArea.areaLightAtlasTexture()).toBe(area);
  });
});
