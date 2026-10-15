/** The format a producer records on its texture, and the colour space a colour slot reads it in. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { copyGodotFormat, recordGodotFormat, sourceColorSpace } from './sourceColorSpace';

describe('sourceColorSpace', () => {
  it('reads a format with an sRGB view as sRGB', () => {
    expect(sourceColorSpace(recordGodotFormat(new THREE.Texture(), 'RGBA8'))).toBe(THREE.SRGBColorSpace);
  });

  it('reads a format with none raw', () => {
    expect(sourceColorSpace(recordGodotFormat(new THREE.Texture(), 'RHalf'))).toBe(THREE.NoColorSpace);
  });

  it('reads an image file, which records no format, as sRGB (edge case)', () => {
    expect(sourceColorSpace(new THREE.Texture())).toBe(THREE.SRGBColorSpace);
  });

  it("ignores the producer's tag, which R3F rewrites on a colour map", () => {
    const texture = recordGodotFormat(new THREE.Texture(), 'Lum8');
    texture.colorSpace = THREE.SRGBColorSpace;
    expect(sourceColorSpace(texture)).toBe(THREE.NoColorSpace);
  });
});

describe('recordGodotFormat', () => {
  it('carries the format into a clone', () => {
    const clone = recordGodotFormat(new THREE.Texture(), 'Lum8').clone();
    expect(sourceColorSpace(clone)).toBe(THREE.NoColorSpace);
  });
});

describe('copyGodotFormat', () => {
  it("records the source's format on the target", () => {
    const source = recordGodotFormat(new THREE.Texture(), 'Red8');
    expect(sourceColorSpace(copyGodotFormat(new THREE.Texture(), source))).toBe(THREE.NoColorSpace);
  });

  it('leaves the target unrecorded when the source has no format (edge case)', () => {
    const target = copyGodotFormat(new THREE.Texture(), new THREE.Texture());
    expect(sourceColorSpace(target)).toBe(THREE.SRGBColorSpace);
  });
});
