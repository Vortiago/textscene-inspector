import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resetProceduralTextures } from '../proceduralBuilds';
import { savedImage } from '../image/savedImage.testkit';
import { imageCubemap } from './resolveImageCubemap';

/** A 1 x 1 Lum8 Image that saves `level`. */
const face = (level: number) => savedImage('Lum8', 1, 1, String(level));

afterEach(() => {
  resetProceduralTextures();
});

describe('imageCubemap', () => {
  it('gives the saved images to the faces in order', () => {
    const images = [10, 20, 30, 40, 50, 60].map(face);
    const faces = imageCubemap({ form: 'image', images })!.texture.image as THREE.DataTexture[];
    expect(faces.map((texture) => (texture.image.data as Uint8Array)[0])).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it('builds nothing from five images, which Godot refuses (error case)', () => {
    expect(imageCubemap({ form: 'image', images: [1, 2, 3, 4, 5].map(face) })).toBeNull();
  });
});
