/**
 * The binding seam: which StandardMaterial3D slots decode sRGB, which sample raw bytes,
 * and what a caller gets back for each. A roughness, a normal and a height are data, so
 * decoding them reads too dark: too glossy, with normals bent toward the surface.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bindSlotTexture, materialTextureStates, releaseBoundTexture } from './textureBinding';
import { parseStandardMaterial3DScalars } from './scalars';
import { TEXTURE_SLOTS, type TextureSlot } from './types';
import { UV2_CHANNEL } from '../../meshes/uv2';

/**
 * As the loader hands them out: one shared entry per path, tagged sRGB, at
 * three's clamp wrapping. Repeat is the 3D consumer's stated default, not the
 * loader's: a default material asks for it at bind time.
 */
function loaded(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const DEFAULTS = materialTextureStates(parseStandardMaterial3DScalars({}));

/**
 * Godot's `source_color` samplers, and only those:
 *
 *   scene/resources/material.cpp:969   texture_albedo        : source_color
 *   scene/resources/material.cpp:1066  texture_emission      : source_color, hint_default_black
 */
const DECODED: TextureSlot[] = ['albedo_texture', 'emission_texture'];
/**
 * Every other slot reads stored bytes, for example `texture_metallic`
 * (`scene/resources/material.cpp:1024`, `hint_default_white`). `textureBinding.md` lists each sampler.
 */
const RAW = TEXTURE_SLOTS.filter((slot) => !DECODED.includes(slot));

describe('bindSlotTexture — colour space per Godot texture slot', () => {
  it.each(DECODED)('%s decodes sRGB (source_color)', (slot) => {
    const shared = loaded();
    const bound = bindSlotTexture(shared, slot, DEFAULTS);
    expect(bound.colorSpace).toBe(THREE.SRGBColorSpace);
    // A default material tiles (Godot's `texture_repeat`), so a clamped arrival
    // diverges on wrapping and the binding clones. The source stays shared.
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
    // space needs nothing. A default material still asks for Repeat, so a
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

  it('shares a clamped entry when the material authors repeat off', () => {
    // `texture_repeat = false` clears `FLAG_USE_TEXTURE_REPEAT`
    // (`material.cpp:4005`), so the sampler loses `repeat_enable` and the clamped
    // arrival is exactly what the slot wants: shared, not cloned.
    const procedural = new THREE.Texture();
    const noRepeat = materialTextureStates(parseStandardMaterial3DScalars({ texture_repeat: 'false' }));
    expect(bindSlotTexture(procedural, 'normal_texture', noRepeat)).toBe(procedural);
  });

  it('carries the material state and the colour space in ONE clone', () => {
    const shared = loaded();
    const scalars = parseStandardMaterial3DScalars({ uv1_scale: 'Vector3(3, 2, 1)' });
    const bound = bindSlotTexture(shared, 'roughness_texture', materialTextureStates(scalars));

    expect(bound.repeat.x).toBe(3);
    expect(bound.colorSpace).toBe(THREE.NoColorSpace);
    expect(bound.source).toBe(shared.source);
    expect(shared.repeat.x).toBe(1);
  });
});

describe('bindSlotTexture — UV set per slot', () => {
  const UV2_EMISSION = materialTextureStates(
    parseStandardMaterial3DScalars({
      emission_on_uv2: 'true',
      detail_uv_layer: '1',
      uv1_scale: 'Vector3(3, 3, 1)',
      uv2_scale: 'Vector3(2, 2, 1)',
    })
  );

  it('binds the emission map to UV2 under emission_on_uv2, with the UV2 transform', () => {
    const bound = bindSlotTexture(loaded(), 'emission_texture', UV2_EMISSION);

    expect(bound.channel).toBe(UV2_CHANNEL);
    expect(bound.repeat.x).toBe(2);
  });

  it("samples UV2 in Godot's top-down V, as every UV2 attribute keeps it", () => {
    const bound = bindSlotTexture(loaded(), 'emission_texture', UV2_EMISSION);

    expect([bound.repeat.y, bound.offset.y]).toEqual([-2, 1]);
  });

  it('binds the AO map to UV2 under ao_on_uv2', () => {
    const state = materialTextureStates(parseStandardMaterial3DScalars({ ao_on_uv2: 'true' }));

    expect(bindSlotTexture(loaded(), 'ao_texture', state).channel).toBe(UV2_CHANNEL);
  });

  it('keeps every other slot on UV1 and its transform', () => {
    const bound = bindSlotTexture(loaded(), 'albedo_texture', UV2_EMISSION);

    expect(bound.channel).toBe(0);
    expect(bound.repeat.x).toBe(3);
  });

  it('samples the first UV set under UV2 triplanar, as UV1 triplanar does (edge case)', () => {
    const state = materialTextureStates(
      parseStandardMaterial3DScalars({ emission_on_uv2: 'true', uv2_triplanar: 'true' })
    );

    const bound = bindSlotTexture(loaded(), 'emission_texture', state);

    expect([bound.channel, bound.repeat.y, bound.offset.y]).toEqual([0, 1, 0]);
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

    // A default albedo binding clones to tile. Releasing that clone must leave
    // the loader's shared entry alive for every other consumer.
    releaseBoundTexture(bindSlotTexture(shared, 'albedo_texture', DEFAULTS));

    expect(disposed).toBe(false);
  });

  it('tolerates an empty slot', () => {
    expect(() => releaseBoundTexture(undefined)).not.toThrow();
    expect(() => releaseBoundTexture(null)).not.toThrow();
  });
});
