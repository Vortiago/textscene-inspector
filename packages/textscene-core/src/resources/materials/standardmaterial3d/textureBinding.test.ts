/**
 * The binding seam: which StandardMaterial3D slots decode sRGB, which sample
 * raw bytes, and what a caller gets back for each.
 *
 * The expected values are Godot's, read off the shader `BaseMaterial3D`
 * generates — a sampler declared `source_color` is bound to the texture's
 * sRGB-typed GPU view and decoded by the sampling hardware, and one without it
 * reads stored bytes:
 *
 *   scene/resources/material.cpp:969   texture_albedo        : source_color
 *   scene/resources/material.cpp:1066  texture_emission      : source_color, hint_default_black
 *   scene/resources/material.cpp:1024  texture_metallic      : hint_default_white
 *   scene/resources/material.cpp:1030  texture_roughness     : hint_roughness_r
 *   scene/resources/material.cpp:1092  texture_normal        : hint_roughness_normal
 *   scene/resources/material.cpp:1122  texture_flowmap       : hint_anisotropy
 *   scene/resources/material.cpp:1128  texture_ambient_occlusion : hint_default_white
 *   scene/resources/material.cpp:1172  texture_heightmap     : hint_default_black
 *
 * A roughness value, a normal vector and a height are data, not light; decoding
 * them reads far too dark, which shows up as a surface far too glossy and as
 * normals bent toward the surface.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bindSlotTexture, materialTextureState, releaseBoundTexture } from './textureBinding';
import { parseStandardMaterial3DScalars } from './scalars';
import { TEXTURE_SLOTS, type TextureSlot } from './types';

/**
 * As the loader hands them out: one shared entry per path, tagged sRGB, at
 * three's clamp wrapping. Repeat is the 3D consumer's stated default, not the
 * loader's — a default material asks for it at bind time.
 */
function loaded(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const DEFAULTS = materialTextureState(parseStandardMaterial3DScalars({}));

/** Godot's `source_color` samplers, and only those. */
const DECODED: TextureSlot[] = ['albedo_texture', 'emission_texture'];
const RAW = TEXTURE_SLOTS.filter((slot) => !DECODED.includes(slot));

describe('bindSlotTexture — colour space per Godot texture slot', () => {
  it.each(DECODED)('%s decodes sRGB (source_color)', (slot) => {
    const shared = loaded();
    const bound = bindSlotTexture(shared, slot, DEFAULTS);
    expect(bound.colorSpace).toBe(THREE.SRGBColorSpace);
    // A default material tiles (Godot's `texture_repeat`), so a clamped arrival
    // diverges on wrapping and the binding clones — the source stays shared.
    expect(bound).not.toBe(shared);
    expect(bound.source).toBe(shared.source);
    expect(bound.wrapS).toBe(THREE.RepeatWrapping);
  });

  it.each(RAW)('%s samples raw bytes', (slot) => {
    const shared = loaded();
    const bound = bindSlotTexture(shared, slot, DEFAULTS);
    expect(bound.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('covers every slot the decode can enumerate', () => {
    // A slot nobody classifies is a slot that can silently pick up the wrong
    // sampler the day it is wired.
    expect([...DECODED, ...RAW].sort()).toEqual([...TEXTURE_SLOTS].sort());
  });

  it('retags a CLONE, leaving the shared cache entry alone', () => {
    // `useResource` hands the same texture to every consumer of a path, and one
    // of them may legitimately be sampling it as an albedo.
    const shared = loaded();
    const bound = bindSlotTexture(shared, 'roughness_texture', DEFAULTS);

    expect(bound).not.toBe(shared);
    expect(bound.source).toBe(shared.source);
    expect(shared.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('gives one image bound to two slots two answers', () => {
    const shared = loaded();

    const asAlbedo = bindSlotTexture(shared, 'albedo_texture', DEFAULTS);
    const asRoughness = bindSlotTexture(shared, 'roughness_texture', DEFAULTS);

    expect(asAlbedo.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(asRoughness.colorSpace).toBe(THREE.NoColorSpace);
    expect(asAlbedo.source).toBe(asRoughness.source);
  });

  it('pins the raw tag against a later write', () => {
    const bound = bindSlotTexture(loaded(), 'normal_texture', DEFAULTS);
    bound.colorSpace = THREE.SRGBColorSpace;
    expect(bound.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('tiles a raw-tagged arrival for the default material', () => {
    // A NoiseTexture2D built `as_normal_map` arrives NoColorSpace, so the colour
    // space needs nothing — but a default material still asks for Repeat, so a
    // clamped arrival clones to tile it while the raw tag is kept.
    const procedural = new THREE.Texture();
    const bound = bindSlotTexture(procedural, 'normal_texture', DEFAULTS);
    expect(bound.colorSpace).toBe(THREE.NoColorSpace);
    expect(bound.wrapS).toBe(THREE.RepeatWrapping);
  });

  it('shares a raw-tagged texture that already tiles', () => {
    const procedural = new THREE.Texture();
    procedural.wrapS = THREE.RepeatWrapping;
    procedural.wrapT = THREE.RepeatWrapping;
    expect(bindSlotTexture(procedural, 'normal_texture', DEFAULTS)).toBe(procedural);
  });

  it('carries the material state and the colour space in ONE clone', () => {
    const shared = loaded();
    const scalars = parseStandardMaterial3DScalars({ uv1_scale: 'Vector3(3, 2, 1)' });
    const bound = bindSlotTexture(shared, 'roughness_texture', materialTextureState(scalars));

    expect(bound.repeat.x).toBe(3);
    expect(bound.colorSpace).toBe(THREE.NoColorSpace);
    expect(bound.source).toBe(shared.source);
    expect(shared.repeat.x).toBe(1);
  });
});

describe('releaseBoundTexture', () => {
  it('disposes a clone the binding made', () => {
    const bound = bindSlotTexture(loaded(), 'ao_texture', DEFAULTS);
    let disposed = false;
    bound.addEventListener('dispose', () => {
      disposed = true;
    });

    releaseBoundTexture(bound);

    expect(disposed).toBe(true);
  });

  it('leaves the loader’s shared entry alone', () => {
    const shared = loaded();
    let disposed = false;
    shared.addEventListener('dispose', () => {
      disposed = true;
    });

    // A default albedo binding clones to tile; releasing that clone must leave
    // the loader's shared entry alive for every other consumer.
    releaseBoundTexture(bindSlotTexture(shared, 'albedo_texture', DEFAULTS));

    expect(disposed).toBe(false);
  });

  it('tolerates an empty slot', () => {
    expect(() => releaseBoundTexture(undefined)).not.toThrow();
    expect(() => releaseBoundTexture(null)).not.toThrow();
  });
});
