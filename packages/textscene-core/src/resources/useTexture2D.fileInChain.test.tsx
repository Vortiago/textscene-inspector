/**
 * A texture resource file at any position of a Texture2D chain: Godot loads an `ExtResource` as it
 * loads a sub-resource, so each slot draws the same pixels as the form with every resource inline.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { parseTresFile } from '../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';
import { resetProceduralTextures } from './textures/proceduralBuilds';
import { useTexture2D } from './useTexture2D';
import { referenceIn } from './reading/scopedReference.testkit';

const RED_TO_BLUE = 'PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)';

/** A 4 by 2 GradientTexture2D from red to blue, saved as its own file. */
const GRADIENT_TRES = `[gd_resource type="GradientTexture2D" format=3]

[sub_resource type="Gradient" id="Gradient_ramp"]
colors = ${RED_TO_BLUE}

[resource]
gradient = SubResource("Gradient_ramp")
width = 4
height = 2
`;

const IMAGE_DATA = `{
"data": PackedByteArray(255, 0, 0, 255, 0, 255, 0, 255),
"format": "RGBA8",
"height": 1,
"mipmaps": false,
"width": 2
}`;

/** A 2 by 1 Image, red then green, saved as its own file. */
const IMAGE_TRES = `[gd_resource type="Image" format=3]

[resource]
data = ${IMAGE_DATA}
`;

/** A CanvasTexture whose diffuse map is the GradientTexture2D file. */
const CANVAS_TRES = `[gd_resource type="CanvasTexture" format=3]

[ext_resource type="Texture2D" path="res://gradient.tres" id="1_gradient"]

[resource]
diffuse_texture = ExtResource("1_gradient")
`;

const EXTERNAL: TscnExternalResource[] = [
  { id: '1_gradient', type: 'Texture2D', path: 'res://gradient.tres' },
  { id: '2_image', type: 'Image', path: 'res://image.tres' },
  { id: '3_canvas', type: 'Texture2D', path: 'res://canvas.tres' },
];

const REGION = 'Rect2(2, 0, 2, 2)';

/** The scene's tables: each texture of the chain in two forms, its inner resource inline or in a file. */
const SCENE: TscnInternalResource[] = [
  { id: 'Gradient_ramp', type: 'Gradient', data: { colors: RED_TO_BLUE } },
  {
    id: 'GradientTexture2D_inline',
    type: 'GradientTexture2D',
    data: { gradient: 'SubResource("Gradient_ramp")', width: '4', height: '2' },
  },
  {
    id: 'AtlasTexture_overInline',
    type: 'AtlasTexture',
    data: { atlas: 'SubResource("GradientTexture2D_inline")', region: REGION },
  },
  {
    id: 'AtlasTexture_overFile',
    type: 'AtlasTexture',
    data: { atlas: 'ExtResource("1_gradient")', region: REGION },
  },
  { id: 'Image_inline', type: 'Image', data: { data: IMAGE_DATA } },
  { id: 'ImageTexture_overInline', type: 'ImageTexture', data: { image: 'SubResource("Image_inline")' } },
  { id: 'ImageTexture_overFile', type: 'ImageTexture', data: { image: 'ExtResource("2_image")' } },
];

function withFiles() {
  const fake = createFakeResourceLoader();
  fake.resources.seed('res://gradient.tres', parseTresFile(GRADIENT_TRES));
  fake.resources.seed('res://image.tres', parseTresFile(IMAGE_TRES));
  fake.resources.seed('res://canvas.tres', parseTresFile(CANVAS_TRES));
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>;
  };
}

/** The texture's size and texels, or null for no texture. */
function pixelsOf(texture: THREE.Texture | null) {
  if (!texture) return null;
  const image = texture.image as { data: ArrayLike<number>; width: number; height: number };
  return { width: image.width, height: image.height, data: Array.from(image.data) };
}

function drawn(ref: string) {
  const { result } = renderHook(() => useTexture2D(referenceIn(ref, EXTERNAL, SCENE)), {
    wrapper: withFiles(),
  });
  return { pixels: pixelsOf(result.current.texture), missing: result.current.missing };
}

afterEach(resetProceduralTextures);

describe('useTexture2D — a texture file inside the chain', () => {
  it('draws the region of an AtlasTexture whose atlas is a GradientTexture2D file', () => {
    const inline = drawn('SubResource("AtlasTexture_overInline")');

    expect(inline.pixels).toMatchObject({ width: 2, height: 2 });
    expect(drawn('SubResource("AtlasTexture_overFile")')).toEqual(inline);
  });

  it('draws the texture file a CanvasTexture file names as its diffuse map', () => {
    const gradient = drawn('ExtResource("1_gradient")');

    expect(gradient.pixels).toMatchObject({ width: 4, height: 2 });
    expect(drawn('ExtResource("3_canvas")')).toEqual(gradient);
  });

  it('draws the Image file an ImageTexture names', () => {
    const inline = drawn('SubResource("ImageTexture_overInline")');

    expect(inline.pixels).toMatchObject({ width: 2, height: 1 });
    expect(drawn('SubResource("ImageTexture_overFile")')).toEqual(inline);
  });
});
