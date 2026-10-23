import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AtlasHolders } from './atlasHolders';

describe('AtlasHolders', () => {
  it('reports the first texture that joins, once', () => {
    const holders = new AtlasHolders();
    const texture = new THREE.Texture();
    holders.hold(texture);

    expect(holders.takeChanged()).toEqual([texture]);
    expect(holders.takeChanged()).toBeUndefined();
  });

  it('reports no change for a second holder of a held texture', () => {
    const holders = new AtlasHolders();
    const texture = new THREE.Texture();
    holders.hold(texture);
    holders.takeChanged();

    holders.hold(texture);

    expect(holders.takeChanged()).toBeUndefined();
  });

  it('keeps a texture until its last holder lets go', () => {
    const holders = new AtlasHolders();
    const texture = new THREE.Texture();
    holders.hold(texture);
    holders.hold(texture);
    holders.takeChanged();

    expect(holders.release(texture)).toBe(false);
    expect(holders.release(texture)).toBe(true);
  });

  it('leaves the atlas as it is when a texture leaves, as Godot does (texture_storage.cpp:3258)', () => {
    const holders = new AtlasHolders();
    const first = new THREE.Texture();
    const second = new THREE.Texture();
    holders.hold(first);
    holders.hold(second);
    holders.takeChanged();

    holders.release(first);

    expect(holders.takeChanged()).toBeUndefined();
  });

  it('lists the held textures in the order they joined', () => {
    const holders = new AtlasHolders();
    const [a, b, c] = [new THREE.Texture(), new THREE.Texture(), new THREE.Texture()];
    holders.hold(b);
    holders.hold(a);
    holders.hold(c);

    expect(holders.takeChanged()).toEqual([b, a, c]);
  });

  it('reports a held texture whose pixels changed', () => {
    const holders = new AtlasHolders();
    const texture = new THREE.Texture();
    holders.hold(texture);
    holders.takeChanged();

    texture.needsUpdate = true;

    expect(holders.takeChanged()).toEqual([texture]);
  });

  it('ignores a texture it never held (edge case)', () => {
    expect(new AtlasHolders().release(new THREE.Texture())).toBe(false);
  });
});
