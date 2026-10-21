/** A texture saved as its own `.tres`, read through the resolvers of an inline one. */
import { describe, expect, it } from 'vitest';
import { parseTresFile } from '../../parser/parsedResource';
import { findSubResource, parseResourceReference } from '../SubResourceResolver';
import { parsedResourceTexture } from './parsedResourceTexture';

const NOISE_TRES = `[gd_resource type="NoiseTexture3D" format=3]

[sub_resource type="FastNoiseLite" id="FastNoiseLite_huop3"]

[resource]
width = 4
noise = SubResource("FastNoiseLite_huop3")
`;

describe('parsedResourceTexture', () => {
  it("names the file's [resource] as a sub-resource of the file's own table", () => {
    const texture = parsedResourceTexture(parseTresFile(NOISE_TRES));
    const main = findSubResource(texture.internalResources, parseResourceReference(texture.ref)!.id);
    expect(main).toMatchObject({ type: 'NoiseTexture3D', data: { width: '4' } });
  });

  it("resolves the [resource]'s refs against the file's sub-resources", () => {
    const texture = parsedResourceTexture(parseTresFile(NOISE_TRES));
    expect(findSubResource(texture.internalResources, 'FastNoiseLite_huop3')?.type).toBe('FastNoiseLite');
  });

  it('gives one table per parsed file, which the build caches key on (edge case)', () => {
    const parsed = parseTresFile(NOISE_TRES);
    expect(parsedResourceTexture(parsed)).toBe(parsedResourceTexture(parsed));
    expect(parsedResourceTexture(parseTresFile(NOISE_TRES))).not.toBe(parsedResourceTexture(parsed));
  });
});
