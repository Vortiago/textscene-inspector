import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { drawnClone } from './drawnClone';
import { godotTextureFilterState } from '../resources/textures/godotTextureFilter';

function source(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.image = { width: 100, height: 80 };
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

describe('drawnClone', () => {
  it('shares the source, so the clone uploads no new image', () => {
    const shared = source();
    const drawn = drawnClone(shared, {});
    expect(drawn).not.toBe(shared);
    expect(drawn.source).toBe(shared.source);
  });

  it('leaves the shared texture as it was', () => {
    const shared = source();
    drawnClone(shared, {
      wrap: THREE.RepeatWrapping,
      window: { repeat: { x: 2, y: 2 }, offset: { x: 0, y: 0 } },
    });
    expect([shared.colorSpace, shared.wrapS, shared.repeat.x]).toEqual([
      THREE.SRGBColorSpace,
      THREE.ClampToEdgeWrapping,
      1,
    ]);
  });

  it('pins NoColorSpace against a later write', () => {
    const drawn = drawnClone(source(), { colorSpace: THREE.NoColorSpace });
    drawn.colorSpace = THREE.SRGBColorSpace;
    expect(drawn.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('keeps the colour space it is given', () => {
    const shared = source();
    shared.colorSpace = THREE.NoColorSpace;
    expect(drawnClone(shared, { colorSpace: THREE.SRGBColorSpace }).colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('writes the wrap on both axes', () => {
    const drawn = drawnClone(source(), { wrap: THREE.RepeatWrapping });
    expect([drawn.wrapS, drawn.wrapT]).toEqual([THREE.RepeatWrapping, THREE.RepeatWrapping]);
  });

  it('writes the filter', () => {
    const drawn = drawnClone(source(), { filter: godotTextureFilterState(0) });
    expect([drawn.magFilter, drawn.minFilter]).toEqual([THREE.NearestFilter, THREE.NearestFilter]);
  });

  it('points the clone at the window', () => {
    const drawn = drawnClone(source(), { window: { repeat: { x: 0.5, y: 0.25 }, offset: { x: 0.5, y: 0 } } });
    expect([drawn.repeat.toArray(), drawn.offset.toArray()]).toEqual([
      [0.5, 0.25],
      [0.5, 0],
    ]);
  });

  it('marks the clone for upload', () => {
    expect(drawnClone(source(), {}).version).toBeGreaterThan(0);
  });
});
