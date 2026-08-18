/**
 * `buildStandardMaterial` — the imperative adapter's contract.
 *
 * Inputs are RAW Godot property strings, the same text the inline path reads, so
 * these tests exercise decode and build together: the pair is what the resource
 * pipeline actually runs, and asserting on a hand-built scalar bag would let the
 * two drift apart again.
 *
 * Where an expectation differs from the pre-slice `createStandardMaterial`, the
 * comment says which Godot rule it now follows.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildStandardMaterial } from './build';
import { parseStandardMaterial3DScalars } from './scalars';
import type { ResolvedTextureSlots } from './types';

function build(
  properties: Record<string, string>,
  textures?: ResolvedTextureSlots
): THREE.MeshStandardMaterial {
  return buildStandardMaterial(
    parseStandardMaterial3DScalars(properties),
    textures
  ) as THREE.MeshStandardMaterial;
}

/**
 * A texture as the LOADER hands it out: tagged `SRGBColorSpace` before any slot
 * is known (`resources/formats/image/textureProcessing.ts`). Binding is what
 * decides the colour space each Godot slot actually samples in, so starting
 * from three's own default would let a raw slot pass without being bound.
 */
function loadedTexture(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * What a RAW slot's binding produces. Godot samples normal / roughness /
 * metallic / AO / heightmap through samplers with no `source_color` hint
 * (`scene/resources/material.cpp:1092,1030,1024,1128,1172`), so the loader's
 * sRGB tag must come off — and it comes off a CLONE, since the loader's entry
 * is shared with every other consumer of that path. The clone keeps the
 * decoded `source`, which is what identifies it as this same image.
 */
function expectBoundRaw(map: THREE.Texture | null | undefined, from: THREE.Texture): void {
  expect(map).toBeTruthy();
  expect(map!.source).toBe(from.source);
  expect(map!.colorSpace).toBe(THREE.NoColorSpace);
}

describe('buildStandardMaterial — scalar base', () => {
  it('creates a MeshStandardMaterial', () => {
    expect(build({ albedo_color: 'Color(1, 0, 0, 1)' })).toBeInstanceOf(THREE.MeshStandardMaterial);
  });

  it('sets color from albedo_color', () => {
    const material = build({ albedo_color: 'Color(1, 0, 0, 1)' });
    expect(material.color.r).toBe(1);
    expect(material.color.g).toBe(0);
    expect(material.color.b).toBe(0);
  });

  it('does NOT force transparency from albedo alpha alone', () => {
    // The divergence this slice retires. `_update_shader` emits
    // `ALPHA *= albedo.a * albedo_tex.a` ONLY when transparency is not
    // DISABLED, so an alpha < 1 on an opaque material never reaches Godot's
    // blend at all — the `.tres` path used to set `transparent = true` here and
    // rendered a material differently from the identical one written inline.
    const material = build({ albedo_color: 'Color(1, 1, 1, 0.5)' });
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    // The alpha is still decoded and carried: it becomes observable the moment
    // a transparency mode turns the blend on.
    expect(material.opacity).toBe(0.5);
  });

  it('blends when transparency = 1 (ALPHA), and gives up depth writes', () => {
    const material = build({ transparency: '1', albedo_color: 'Color(1, 1, 1, 0.5)' });
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0.5);
    expect(material.depthWrite).toBe(false);
  });

  it('keeps depth writes for DEPTH_PRE_PASS (mode 4), which exists to have them', () => {
    const material = build({ transparency: '4' });
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(true);
  });

  it('turns ALPHA_SCISSOR (mode 2) into an opaque alphaTest cutout', () => {
    const material = build({ transparency: '2', alpha_scissor_threshold: '0.3' });
    expect(material.alphaTest).toBeCloseTo(0.3, 5);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
  });

  it('defaults the scissor threshold to Godot’s 0.5', () => {
    expect(build({ transparency: '2' }).alphaTest).toBeCloseTo(0.5, 5);
  });

  it('does not set transparency when alpha = 1', () => {
    const material = build({ albedo_color: 'Color(1, 0, 0, 1)' });
    expect(material.transparent).toBe(false);
    expect(material.opacity).toBe(1);
  });

  it('sets metalness and roughness', () => {
    const material = build({ metallic: '0.8', roughness: '0.3' });
    expect(material.metalness).toBe(0.8);
    expect(material.roughness).toBe(0.3);
  });

  it('converts a mid-tone albedo sRGB → linear', () => {
    // Godot's sRGB 0.5 → linear ≈ 0.214. Asserting the CONVERSION happened
    // (not that the channel still reads 0.5) is what pins the bright-pink fix.
    const material = build({
      albedo_color: 'Color(0.5, 0.5, 0.5, 1)',
      metallic: '0.7',
      roughness: '0.2',
    });
    expect(material.color.r).toBeCloseTo(0.21404, 4);
    expect(material.color.g).toBeCloseTo(0.21404, 4);
    expect(material.color.b).toBeCloseTo(0.21404, 4);
    expect(material.metalness).toBe(0.7);
    expect(material.roughness).toBe(0.2);
  });

  it('converts the brown table albedo from the Hallway scene', () => {
    const material = build({ albedo_color: 'Color(0.545098, 0.270588, 0.0745098, 1)' });
    expect(material.color.r).toBeCloseTo(0.25818, 3);
    expect(material.color.g).toBeCloseTo(0.05951, 3);
    expect(material.color.b).toBeCloseTo(0.00651, 3);
    // Load-bearing: the linear values are STRICTLY below the sRGB inputs for
    // mid-tones. Before the conversion they were EQUAL, which is the bug.
    expect(material.color.r).toBeLessThan(0.545098);
    expect(material.color.g).toBeLessThan(0.270588);
  });

  it('leaves the sRGB fixed points alone (gold albedo)', () => {
    const material = build({ albedo_color: 'Color(1, 0.843137, 0, 1)' });
    expect(material.color.r).toBe(1);
    expect(material.color.g).toBeCloseTo(0.67954, 4);
    expect(material.color.b).toBe(0);
  });

  it('carries an HDR albedo past 1 instead of clamping it', () => {
    // `albedo_color` has no PROPERTY_HINT_RANGE and `Color::srgb_to_linear`
    // extrapolates, so the corpus tracer bullet's Color(2.33575, 3.29442,
    // 3.29442, 1) is meant to blow past the glow bright-pass. Clamping to 1 —
    // which the inline path used to do — greys it out.
    const material = build({ albedo_color: 'Color(2.33575, 3.29442, 3.29442, 1)' });
    expect(material.color.r).toBeGreaterThan(1);
    expect(material.color.g).toBeGreaterThan(material.color.r);
  });

  it('builds from an empty property bag (all Godot defaults)', () => {
    const material = build({});
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.color.getHex()).toBe(0xffffff);
    expect(material.metalness).toBe(0);
    expect(material.roughness).toBe(1);
    expect(material.side).toBe(THREE.FrontSide);
    expect(material.blending).toBe(THREE.NormalBlending);
  });

  it('clamps metallic and roughness to their 0..1 hints', () => {
    const over = build({ metallic: '3', roughness: '9' });
    expect(over.metalness).toBe(1);
    expect(over.roughness).toBe(1);
    const under = build({ metallic: '-1', roughness: '-2' });
    expect(under.metalness).toBe(0);
    expect(under.roughness).toBe(0);
  });

  it('handles zero and max metallic / roughness', () => {
    expect(build({ metallic: '0', roughness: '0' }).metalness).toBe(0);
    expect(build({ metallic: '1', roughness: '1' }).roughness).toBe(1);
  });

  it('reads vertex_color_use_as_albedo', () => {
    expect(build({}).vertexColors).toBe(false);
    expect(build({ vertex_color_use_as_albedo: 'true' }).vertexColors).toBe(true);
  });
});

describe('buildStandardMaterial — alpha pass and depth state', () => {
  it('carries a blend-mode-only alpha pass onto the material', () => {
    // `blend_mode_uses_blend_alpha`: an additive material renders in Godot's
    // alpha pass with no `transparency` authored, and under the default
    // OPAQUE_ONLY depth mode it writes no depth there.
    const material = build({ blend_mode: '1' });
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.blending).toBe(THREE.AdditiveBlending);
  });

  it('keeps a refractive surface opaque and depth-writing', () => {
    // Godot's refraction branch forces `ALPHA = 1.0` and `DEPTH_DRAW_ALWAYS`, so
    // the authored albedo alpha does not fade it.
    const material = buildStandardMaterial(
      parseStandardMaterial3DScalars({
        transparency: '1',
        albedo_color: 'Color(0.42, 0.51, 0.62, 0.627451)',
        refraction_enabled: 'true',
      })
    ) as THREE.MeshPhysicalMaterial;
    expect(material.opacity).toBe(1);
    expect(material.depthWrite).toBe(true);
    expect(material.transparent).toBe(true);
    expect(material.transmission).toBe(1);
  });

  it('applies depth_draw_mode and no_depth_test', () => {
    expect(build({ depth_draw_mode: '2' }).depthWrite).toBe(false);
    expect(build({ transparency: '1', depth_draw_mode: '1' }).depthWrite).toBe(true);
    const noTest = build({ no_depth_test: 'true' });
    expect(noTest.depthTest).toBe(false);
    expect(noTest.depthWrite).toBe(false);
  });

  it('leaves depth testing on for an ordinary material', () => {
    expect(build({}).depthTest).toBe(true);
  });
});

describe('buildStandardMaterial — cull_mode', () => {
  it('maps Godot CULL_BACK (default) to FrontSide', () => {
    expect(build({}).side).toBe(THREE.FrontSide);
    expect(build({ cull_mode: '0' }).side).toBe(THREE.FrontSide);
  });

  it('maps CULL_FRONT to BackSide and CULL_DISABLED to DoubleSide', () => {
    expect(build({ cull_mode: '1' }).side).toBe(THREE.BackSide);
    expect(build({ cull_mode: '2' }).side).toBe(THREE.DoubleSide);
  });
});

describe('buildStandardMaterial — shading_mode', () => {
  it('renders shading_mode 0 (UNSHADED) as a MeshBasicMaterial', () => {
    const material = buildStandardMaterial(parseStandardMaterial3DScalars({ shading_mode: '0' }));
    expect(material).toBeInstanceOf(THREE.MeshBasicMaterial);
  });

  it('keeps the albedo map on the unshaded material', () => {
    const texture = loadedTexture();
    const material = buildStandardMaterial(parseStandardMaterial3DScalars({ shading_mode: '0' }), {
      albedo_texture: texture,
    }) as THREE.MeshBasicMaterial;
    expect(material.map).toBe(texture);
  });

  it('drops emission on the unshaded material (Godot never reads it there)', () => {
    const material = buildStandardMaterial(
      parseStandardMaterial3DScalars({
        shading_mode: '0',
        emission_enabled: 'true',
        emission: 'Color(1, 0, 0, 1)',
      })
    ) as THREE.MeshBasicMaterial & { emissive?: THREE.Color };
    expect(material.emissive).toBeUndefined();
  });
});

describe('buildStandardMaterial — physical-only features', () => {
  it('upgrades to MeshPhysicalMaterial for clearcoat', () => {
    const material = buildStandardMaterial(
      parseStandardMaterial3DScalars({ clearcoat_enabled: 'true' })
    ) as THREE.MeshPhysicalMaterial;
    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(material.clearcoat).toBe(1);
    expect(material.clearcoatRoughness).toBe(0.5);
  });

  it('maps rim to sheen and rim_tint to a sheen colour', () => {
    const material = buildStandardMaterial(
      parseStandardMaterial3DScalars({
        rim_enabled: 'true',
        rim: '0.5',
        rim_tint: '1',
        albedo_color: 'Color(1, 0, 0, 1)',
      })
    ) as THREE.MeshPhysicalMaterial;
    expect(material.sheen).toBe(0.5);
    // rim_tint 1 pulls the highlight all the way to the albedo.
    expect(material.sheenColor.r).toBeCloseTo(1, 5);
    expect(material.sheenColor.g).toBeCloseTo(0, 5);
  });

  it('maps refraction to transmission + thickness', () => {
    const material = buildStandardMaterial(
      parseStandardMaterial3DScalars({ refraction_enabled: 'true', refraction_scale: '0.2' })
    ) as THREE.MeshPhysicalMaterial;
    expect(material.transmission).toBe(1);
    expect(material.thickness).toBeCloseTo(0.2, 5);
  });

  it('maps a negative anisotropy to full strength turned 90°', () => {
    const material = buildStandardMaterial(
      parseStandardMaterial3DScalars({ anisotropy_enabled: 'true', anisotropy: '-0.75' })
    ) as THREE.MeshPhysicalMaterial;
    expect(material.anisotropy).toBeCloseTo(0.75, 5);
    expect(material.anisotropyRotation).toBeCloseTo(Math.PI / 2, 5);
  });

  it('stays a MeshStandardMaterial when every physical flag is off', () => {
    expect(
      buildStandardMaterial(
        parseStandardMaterial3DScalars({ clearcoat: '1', rim: '1', anisotropy: '1' })
      )
    ).toBeInstanceOf(THREE.MeshStandardMaterial);
  });
});

describe('buildStandardMaterial — blend modes', () => {
  it('leaves the default MIX on NormalBlending', () => {
    expect(build({}).blending).toBe(THREE.NormalBlending);
  });

  it('uses the three presets that equal Godot’s factors exactly', () => {
    expect(build({ blend_mode: '1' }).blending).toBe(THREE.AdditiveBlending);
    expect(build({ blend_mode: '3' }).blending).toBe(THREE.MultiplyBlending);
  });

  it('gives SUB the ported reverse-subtract factors, not a preset', () => {
    const material = build({ blend_mode: '2' });
    expect(material.blending).toBe(THREE.CustomBlending);
    expect(material.blendEquation).toBe(THREE.ReverseSubtractEquation);
    expect(material.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(material.blendDst).toBe(THREE.OneFactor);
    expect(material.blendEquationAlpha).toBe(THREE.ReverseSubtractEquation);
    expect(material.blendSrcAlpha).toBe(THREE.SrcAlphaFactor);
    expect(material.blendDstAlpha).toBe(THREE.OneFactor);
  });

  it('gives PREMULT_ALPHA the real factors without premultiplying in-shader', () => {
    const material = build({ blend_mode: '4' });
    expect(material.blending).toBe(THREE.CustomBlending);
    expect(material.blendSrc).toBe(THREE.OneFactor);
    expect(material.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
    // three's `premultipliedAlpha` would run `gl_FragColor.rgb *= a` on a source
    // Godot already premultiplied — a double-apply, so it stays off.
    expect(material.premultipliedAlpha).toBe(false);
  });

  it('leaves three’s own factor defaults in place for a preset mode', () => {
    // The factor fields are OMITTED rather than passed as `undefined`, which
    // three would warn about and R3F would assign straight onto the material.
    const material = build({ blend_mode: '1' });
    expect(material.blendEquation).toBe(THREE.AddEquation);
    expect(material.blendSrc).toBe(THREE.SrcAlphaFactor);
  });
});

describe('buildStandardMaterial — texture slots', () => {
  it('applies the albedo map', () => {
    const texture = loadedTexture();
    expect(build({}, { albedo_texture: texture }).map).toBe(texture);
  });

  it('applies the normal map', () => {
    const texture = loadedTexture();
    const on = build(
      { normal_enabled: 'true', normal_texture: 'ExtResource("1")' },
      { normal_texture: texture }
    );
    expectBoundRaw(on.normalMap, texture);
  });

  it('applies every slot it is handed — the feature gates are the decode’s', () => {
    // Godot emits the normal sampler only inside `if (features[
    // FEATURE_NORMAL_MAPPING])`, and the decode's slot enumeration is where that
    // gate lives (`decode.test.ts`), so an unflagged slot is never RESOLVED and
    // never reaches here. Re-gating here would also split this adapter from the
    // reactive one, which applies whatever prop the node component passes.
    const texture = loadedTexture();
    const scalars = parseStandardMaterial3DScalars({ normal_texture: 'ExtResource("1")' });
    expect(scalars.textureSlots).toEqual({});
    expectBoundRaw(
      (
        buildStandardMaterial(scalars, {
          normal_texture: texture,
        }) as THREE.MeshStandardMaterial
      ).normalMap,
      texture
    );
  });

  it('applies the metallic and roughness maps', () => {
    const texture = loadedTexture();
    const material = build({}, { metallic_texture: texture, roughness_texture: texture });
    expectBoundRaw(material.metalnessMap, texture);
    expectBoundRaw(material.roughnessMap, texture);
  });

  it('applies the AO map', () => {
    const texture = loadedTexture();
    expectBoundRaw(build({ ao_enabled: 'true' }, { ao_texture: texture }).aoMap, texture);
  });

  it('applies the emission map', () => {
    const texture = loadedTexture();
    expect(build({ emission_enabled: 'true' }, { emission_texture: texture }).emissiveMap).toBe(
      texture
    );
  });

  it('gives an emission texture over Godot’s default black colour a white emissive', () => {
    // `hint_default_black` means ADD over a black colour reduces to `tex *
    // energy`, which three spells as a WHITE emissive — multiplying the black
    // through would render nothing where Godot renders the whole texture.
    const material = build(
      { emission_enabled: 'true', emission_energy_multiplier: '2' },
      { emission_texture: loadedTexture() }
    );
    expect(material.emissive.getHex()).toBe(0xffffff);
    expect(material.emissiveIntensity).toBe(2);
  });

  it('applies the heightmap texture as a displacement map at Godot’s default depth', () => {
    const texture = loadedTexture();
    const on = build({ heightmap_enabled: 'true' }, { heightmap_texture: texture });
    expectBoundRaw(on.displacementMap, texture);
    expect(on.displacementScale).toBe(5);
  });

  it('leaves displacement inert for a material with the feature off', () => {
    // Even if a map somehow arrived, a zero scale moves no vertices.
    expect(build({}).displacementScale).toBe(0);
  });

  it('applies albedo and normal together', () => {
    const albedo = loadedTexture();
    const normal = loadedTexture();
    const material = build(
      { normal_enabled: 'true', normal_texture: 'ExtResource("2")' },
      { albedo_texture: albedo, normal_texture: normal }
    );
    expect(material.map).toBe(albedo);
    expectBoundRaw(material.normalMap, normal);
  });

  it('tolerates an enabled feature with no texture', () => {
    expect(() => build({ emission_enabled: 'true', normal_enabled: 'true' })).not.toThrow();
    expect(build({ emission_enabled: 'true' }).emissiveMap).toBeNull();
  });

  it('treats a null slot as empty', () => {
    expect(build({}, { albedo_texture: null }).map).toBeNull();
  });

  it('applies the anisotropy flowmap it is handed', () => {
    // Godot's `texture_flowmap` (`scene/resources/material.cpp:1122`) is
    // three's `anisotropyMap`, declared by MeshPhysicalMaterial alone. Declining
    // to FETCH one — it needs an alpha→blue repack first — is the loader's
    // decision, not this adapter's: a caller holding a repacked flowmap gets it
    // applied, exactly like every other slot.
    const texture = loadedTexture();
    const material = buildStandardMaterial(
      parseStandardMaterial3DScalars({ anisotropy_enabled: 'true', anisotropy: '0.6' }),
      { anisotropy_flowmap: texture }
    ) as THREE.MeshPhysicalMaterial;
    expectBoundRaw(material.anisotropyMap, texture);
  });
});

describe('buildStandardMaterial — UV transform (uv1_scale / uv1_offset)', () => {
  it('maps uv1_scale straight onto a cloned texture’s repeat', () => {
    const texture = loadedTexture();
    const material = build({ uv1_scale: 'Vector3(0.5, 0.5, 0.5)' }, { albedo_texture: texture });

    expect(material.map).not.toBe(texture);
    expect(material.map!.repeat.x).toBe(0.5);
    expect(material.map!.repeat.y).toBe(0.5);
    expect(material.map!.wrapS).toBe(THREE.RepeatWrapping);
    expect(material.map!.wrapT).toBe(THREE.RepeatWrapping);
    // The shared source comes back untouched.
    expect(texture.repeat.x).toBe(1);
    expect(texture.repeat.y).toBe(1);
  });

  it('honours a non-integer scale', () => {
    const texture = loadedTexture();
    const material = build({ uv1_scale: 'Vector3(2.4, 2.4, 2.4)' }, { albedo_texture: texture });
    expect(material.map!.repeat.x).toBeCloseTo(2.4, 5);
    expect(material.map!.repeat.y).toBeCloseTo(2.4, 5);
    expect(texture.repeat.x).toBe(1);
  });

  it('honours uv1_offset, which the .tres path used to hard-code to zero', () => {
    const texture = loadedTexture();
    const material = build({ uv1_offset: 'Vector3(0.25, 0.5, 0)' }, { albedo_texture: texture });
    expect(material.map).not.toBe(texture);
    expect(material.map!.offset.x).toBeCloseTo(0.25, 5);
    expect(material.map!.offset.y).toBeCloseTo(0.5, 5);
  });

  it('applies the transform to every slot the material carries', () => {
    const texture = loadedTexture();
    const material = build(
      {
        uv1_scale: 'Vector3(0.25, 0.5, 1)',
        normal_enabled: 'true',
        normal_texture: 'ExtResource("2")',
      },
      { albedo_texture: texture, normal_texture: texture, metallic_texture: texture }
    );
    for (const map of [material.map, material.normalMap, material.metalnessMap]) {
      expect(map!.repeat.x).toBe(0.25);
      expect(map!.repeat.y).toBe(0.5);
      expect(map!.wrapS).toBe(THREE.RepeatWrapping);
    }
  });

  it('applies the transform to roughness, AO and emission slots too', () => {
    const texture = loadedTexture();
    const material = build(
      {
        uv1_scale: 'Vector3(0.5, 0.5, 0.5)',
        ao_enabled: 'true',
        emission_enabled: 'true',
      },
      { roughness_texture: texture, ao_texture: texture, emission_texture: texture }
    );
    for (const map of [material.roughnessMap, material.aoMap, material.emissiveMap]) {
      expect(map).not.toBe(texture);
      expect(map!.repeat.x).toBe(0.5);
      expect(map!.repeat.y).toBe(0.5);
    }
  });

  it('reads the x and y axes independently and ignores z', () => {
    const texture = loadedTexture();
    const material = build({ uv1_scale: 'Vector3(0.5, 2.0, 999)' }, { albedo_texture: texture });
    expect(material.map!.repeat.x).toBe(0.5);
    expect(material.map!.repeat.y).toBe(2.0);
  });

  it('hands back the shared texture for an identity transform', () => {
    // An identity scale asks for nothing, so there is nothing to clone — and a
    // clone would also flip wrapping, which is `texture_repeat`'s business.
    const texture = loadedTexture();
    const material = build({ uv1_scale: 'Vector3(1, 1, 1)' }, { albedo_texture: texture });
    expect(material.map).toBe(texture);
    expect(material.map!.repeat.x).toBe(1);
  });

  it('hands back the shared texture when no transform is authored', () => {
    const texture = loadedTexture();
    expect(build({}, { albedo_texture: texture }).map).toBe(texture);
    expect(texture.repeat.x).toBe(1);
  });

  it('does not crash for a transform with no textures', () => {
    expect(() => build({ uv1_scale: 'Vector3(0.5, 0.5, 0.5)' })).not.toThrow();
  });

  it('survives extreme scales', () => {
    const big = build(
      { uv1_scale: 'Vector3(1000, 1000, 1)' },
      { albedo_texture: loadedTexture() }
    );
    expect(big.map!.repeat.x).toBe(1000);
    const small = build(
      { uv1_scale: 'Vector3(0.01, 0.01, 1)' },
      { albedo_texture: loadedTexture() }
    );
    expect(small.map!.repeat.x).toBe(0.01);
    expect(small.map!.wrapS).toBe(THREE.RepeatWrapping);
  });

  it('clamps its own copy when the material turns texture_repeat off', () => {
    // Textures load with RepeatWrapping because Godot's material default is
    // repeat, so a material authoring `texture_repeat = false` must diverge or
    // its atlas wraps to the opposite edge where Godot clamps.
    const texture = loadedTexture();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    const material = build({ texture_repeat: 'false' }, { albedo_texture: texture });

    expect(material.map).not.toBe(texture);
    expect(material.map!.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(material.map!.wrapT).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
  });

  it('keeps the transform alongside every other scalar', () => {
    const texture = loadedTexture();
    const material = build(
      {
        albedo_color: 'Color(1, 0, 0, 1)',
        metallic: '0.8',
        roughness: '0.2',
        uv1_scale: 'Vector3(0.5, 0.5, 0.5)',
      },
      { albedo_texture: texture }
    );
    expect(material.map!.repeat.x).toBe(0.5);
    expect(material.color.r).toBe(1);
    expect(material.metalness).toBe(0.8);
    expect(material.roughness).toBe(0.2);
  });
});
