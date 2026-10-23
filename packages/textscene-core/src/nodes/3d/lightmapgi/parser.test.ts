import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { ShadowmaskMode } from '../../../godot/scene/lightmapGi';
import { parseLightmapGI } from './parser';

const lightmap = (properties: Record<string, string>) =>
  parseLightmapGI(heading('LightmapGI', { name: 'Lightmap' }), properties);

describe('parseLightmapGI', () => {
  it('reads the Node3D properties', () => {
    expect(lightmap({ visible: 'false' })).toMatchObject({ name: 'Lightmap', visible: false });
  });

  it('keeps the light_data reference for the component to resolve', () => {
    expect(lightmap({ light_data: 'ExtResource("1_bake")' }).lightData).toBe('ExtResource("1_bake")');
  });

  it('reads no light data when the node has none, its default (edge case)', () => {
    expect(lightmap({}).lightData).toBeUndefined();
  });

  it('reads the shadowmask mode', () => {
    expect(lightmap({ shadowmask_mode: '1' }).shadowmaskMode).toBe(ShadowmaskMode.REPLACE);
    expect(lightmap({ shadowmask_mode: '2' }).shadowmaskMode).toBe(ShadowmaskMode.OVERLAY);
  });

  it('reads no shadowmask when the node leaves the mode out, its default (lightmap_gi.h:206)', () => {
    expect(lightmap({}).shadowmaskMode).toBe(ShadowmaskMode.NONE);
  });

  it('reads no shadowmask for a mode the inspector does not offer (edge case)', () => {
    expect(lightmap({ shadowmask_mode: '3' }).shadowmaskMode).toBe(ShadowmaskMode.NONE);
  });
});
