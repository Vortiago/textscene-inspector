import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
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
});
