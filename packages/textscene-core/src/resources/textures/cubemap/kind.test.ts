import { describe, expect, it } from 'vitest';
import { loadedValue } from '../../reading/reading.testkit';
import { CUBEMAP } from './kind';

const SKY = `[ext_resource type="CompressedCubemap" path="res://sky/skybox.webp" id="1_sky"]

[sub_resource type="Image" id="Image_a"]
data = {"data": PackedByteArray(10), "format": "Lum8", "height": 1, "mipmaps": false, "width": 1}

[sub_resource type="Cubemap" id="Cubemap_b"]
_images = Array[Image]([SubResource("Image_a"), SubResource("Image_a"), SubResource("Image_a"), SubResource("Image_a"), SubResource("Image_a"), SubResource("Image_a")])
`;

describe('CUBEMAP', () => {
  it('reads an image imported as a cubemap as its file', () => {
    expect(loadedValue(CUBEMAP, 'ExtResource("1_sky")', SKY)).toEqual({
      form: 'file',
      path: 'res://sky/skybox.webp',
    });
  });

  it('reads the six faces a Cubemap saves', () => {
    const source = loadedValue(CUBEMAP, 'SubResource("Cubemap_b")', SKY);
    expect(source.form === 'image' && source.images.length).toBe(6);
  });
});
