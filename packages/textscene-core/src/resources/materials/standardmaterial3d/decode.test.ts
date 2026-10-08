/**
 * `decodeStandardMaterial3D`'s own contract: the transparency and alpha rule, the slot
 * feature gates, the value-decoder edges and the defaults of an omitted property. The
 * per-feature scalars live in the `scalars.*.test.ts` files.
 */

import { describe, expect, it } from 'vitest';
import { decodeStandardMaterial3D } from './decode';
import { BlendMode, CullMode, DepthDrawMode, Transparency } from './types';

describe('decodeStandardMaterial3D — defaults', () => {
  it('reads every Godot default from an empty bag', () => {
    const data = decodeStandardMaterial3D({});
    expect(data.albedo).toEqual([1, 1, 1]);
    expect(data.alpha).toBe(1);
    expect(data.metallic).toBe(0);
    expect(data.roughness).toBe(1);
    expect(data.emission).toEqual({ emissive: [0, 0, 0], emissiveIntensity: 0 });
    expect(data.emissionOperator).toBe(0);
    // TEXTURE_FILTER_LINEAR_WITH_MIPMAPS, which is three's default state too.
    expect(data.textureFilter).toBe(3);
    expect(data.textureRepeat).toBe(true);
    expect(data.uv1Scale).toEqual({ x: 1, y: 1 });
    expect(data.uv1Offset).toEqual({ x: 0, y: 0 });
    expect(data.transparency).toBe(Transparency.DISABLED);
    expect(data.blendMode).toBe(BlendMode.MIX);
    expect(data.cullMode).toBe(CullMode.BACK);
    expect(data.cullModeExplicit).toBe(false);
    expect(data.shadingMode).toBe('per_pixel');
    expect(data.normalScale).toEqual({ x: 1, y: 1 });
    expect(data.billboardMode).toBe(0);
    expect(data.textureSlots).toEqual({});
  });

  it('marks cull_mode explicit only when it is authored', () => {
    expect(decodeStandardMaterial3D({ cull_mode: '0' }).cullModeExplicit).toBe(true);
    expect(decodeStandardMaterial3D({}).cullModeExplicit).toBe(false);
  });
});

describe('decodeStandardMaterial3D — transparency', () => {
  it('keeps a low-alpha albedo opaque while transparency is DISABLED', () => {
    const data = decodeStandardMaterial3D({ albedo_color: 'Color(1, 1, 1, 0.25)' });
    expect(data.alpha).toBe(1);
    expect(data.transparent).toBe(false);
    expect(data.depthWrite).toBe(true);
    expect(data.alphaTest).toBe(0);
  });

  it('treats the two blending modes as transparent', () => {
    for (const mode of ['1', '4']) {
      expect(decodeStandardMaterial3D({ transparency: mode }).transparent).toBe(true);
    }
  });

  it('treats ALPHA_SCISSOR as an opaque cutout', () => {
    const data = decodeStandardMaterial3D({ transparency: '2' });
    expect(data.transparent).toBe(false);
    expect(data.depthWrite).toBe(true);
    expect(data.alphaTest).toBe(0.5);
  });

  it('drops depth writes for ALPHA only', () => {
    expect(decodeStandardMaterial3D({ transparency: '1' }).depthWrite).toBe(false);
    expect(decodeStandardMaterial3D({ transparency: '3' }).depthWrite).toBe(true);
    expect(decodeStandardMaterial3D({ transparency: '4' }).depthWrite).toBe(true);
  });

  it('clamps the scissor threshold to its 0..1 hint', () => {
    expect(decodeStandardMaterial3D({ transparency: '2', alpha_scissor_threshold: '5' }).alphaTest).toBe(1);
    expect(decodeStandardMaterial3D({ transparency: '2', alpha_scissor_threshold: '-1' }).alphaTest).toBe(0);
  });

  it('ignores alpha_scissor_threshold outside ALPHA_SCISSOR', () => {
    expect(decodeStandardMaterial3D({ transparency: '1', alpha_scissor_threshold: '0.9' }).alphaTest).toBe(0);
  });

  it('falls back to DISABLED for a mode outside the enum', () => {
    expect(decodeStandardMaterial3D({ transparency: '9' }).transparency).toBe(Transparency.DISABLED);
    expect(decodeStandardMaterial3D({ transparency: 'nope' }).transparent).toBe(false);
  });
});

/**
 * `uses_alpha_pass()` ported. `transparency` is only one of its inputs, so each case
 * leaves transparency DISABLED and still lands in the alpha pass.
 */
describe('decodeStandardMaterial3D — alpha-pass classification', () => {
  it('puts a non-MIX blend mode in the alpha pass whatever transparency says', () => {
    // `blend_mode_uses_blend_alpha` is true for ADD / SUB / MUL / PREMULT_ALPHA, so an
    // additive material renders in the alpha pass and, under the default OPAQUE_ONLY
    // depth mode, writes no depth.
    for (const mode of ['1', '2', '3', '4']) {
      const data = decodeStandardMaterial3D({ blend_mode: mode });
      expect(data.transparency, `blend_mode ${mode}`).toBe(Transparency.DISABLED);
      expect(data.transparent, `blend_mode ${mode}`).toBe(true);
      expect(data.depthWrite, `blend_mode ${mode}`).toBe(false);
    }
  });

  it('leaves MIX with transparency DISABLED in the opaque pass', () => {
    const data = decodeStandardMaterial3D({ blend_mode: '0' });
    expect(data.transparent).toBe(false);
    expect(data.depthWrite).toBe(true);
  });

  it('keeps a cutout in the opaque pass — a discard is not a blend', () => {
    // `uses_alpha_clip` cancels `uses_alpha` in `has_base_alpha`, so SCISSOR
    // stays opaque and depth-writing even though it writes ALPHA.
    const data = decodeStandardMaterial3D({ transparency: '2' });
    expect(data.transparent).toBe(false);
    expect(data.depthWrite).toBe(true);
  });

  it('re-admits a cutout to the alpha pass under alpha antialiasing', () => {
    // `uses_alpha_antialiasing` un-cancels the clip, and Godot switches the blend to
    // alpha-to-coverage.
    const data = decodeStandardMaterial3D({
      transparency: '2',
      alpha_scissor_threshold: '0.5',
      alpha_antialiasing_mode: '1',
    });
    expect(data.transparent).toBe(true);
    expect(data.alphaTest).toBeCloseTo(0.5, 5);
  });

  it('puts a proximity-fading surface in the alpha pass (it samples depth_texture)', () => {
    const data = decodeStandardMaterial3D({ proximity_fade_enabled: 'true' });
    expect(data.transparent).toBe(true);
  });

  it('only PIXEL_ALPHA distance fade writes ALPHA; the dither modes do not', () => {
    // Mode 2 must stay opaque.
    expect(decodeStandardMaterial3D({ distance_fade_mode: '1' }).transparent).toBe(true);
    expect(decodeStandardMaterial3D({ distance_fade_mode: '2' }).transparent).toBe(false);
    expect(decodeStandardMaterial3D({ distance_fade_mode: '3' }).transparent).toBe(false);
  });

  it('puts a shadow-to-opacity surface in the alpha pass', () => {
    expect(decodeStandardMaterial3D({ shadow_to_opacity: 'true' }).transparent).toBe(true);
  });

  it('keeps ALPHA_HASH in the opaque pass, hashing its alpha', () => {
    const data = decodeStandardMaterial3D({ transparency: '3' });
    expect(data).toMatchObject({ transparent: false, depthWrite: true, alphaHash: true, alphaTest: 0 });
  });

  it('hashes nothing on a refractive ALPHA_HASH surface, whose ALPHA is 1 (edge case)', () => {
    const data = decodeStandardMaterial3D({ transparency: '3', refraction_enabled: 'true' });
    expect(data.alphaHash).toBe(false);
  });

  it('hashes nothing outside ALPHA_HASH', () => {
    expect(decodeStandardMaterial3D({ transparency: '2' }).alphaHash).toBe(false);
  });

  it('reads the hash grain from alpha_hash_scale', () => {
    expect(decodeStandardMaterial3D({ transparency: '3', alpha_hash_scale: '0.5' }).alphaHashScale).toBe(0.5);
  });

  it("takes Godot's default grain of 1 where none is authored (edge case)", () => {
    expect(decodeStandardMaterial3D({ transparency: '3' }).alphaHashScale).toBe(1);
  });
});

/**
 * A surface joins Godot's shadow pass when `!uses_alpha_pass() || uses_depth_in_alpha_pass()`
 * (`render_forward_clustered.cpp:4078-4088`, `scene_shader_forward_clustered.h:279-292`).
 */
describe('decodeStandardMaterial3D — shadow-pass membership', () => {
  it('casts from an opaque surface', () => {
    expect(decodeStandardMaterial3D({}).castsShadow).toBe(true);
  });

  it('casts nothing from an alpha-blended surface', () => {
    expect(decodeStandardMaterial3D({ transparency: '1' }).castsShadow).toBe(false);
  });

  it('casts nothing from a non-MIX blend mode, whatever transparency says', () => {
    for (const mode of ['1', '2', '3', '4']) {
      expect(decodeStandardMaterial3D({ blend_mode: mode }).castsShadow, `blend_mode ${mode}`).toBe(false);
    }
  });

  it('casts from a cutout, which stays in the opaque pass', () => {
    expect(decodeStandardMaterial3D({ transparency: '2' }).castsShadow).toBe(true);
    expect(decodeStandardMaterial3D({ transparency: '3' }).castsShadow).toBe(true);
  });

  it('casts from ALPHA_DEPTH_PRE_PASS, which draws depth in the alpha pass', () => {
    expect(decodeStandardMaterial3D({ transparency: '4' }).castsShadow).toBe(true);
  });

  it('casts nothing from ALPHA_DEPTH_PRE_PASS once depth draw is off', () => {
    const data = decodeStandardMaterial3D({ transparency: '4', depth_draw_mode: '2' });
    expect(data.castsShadow).toBe(false);
  });

  it('casts from an alpha-antialiased cutout, which draws depth in the alpha pass', () => {
    const data = decodeStandardMaterial3D({ transparency: '2', alpha_antialiasing_mode: '1' });
    expect(data.castsShadow).toBe(true);
  });

  it('casts nothing from an alpha-antialiased cutout with the depth test off', () => {
    const data = decodeStandardMaterial3D({
      transparency: '2',
      alpha_antialiasing_mode: '1',
      no_depth_test: 'true',
    });
    expect(data.castsShadow).toBe(false);
  });

  it('casts nothing from a surface whose antialiasing mode has no cutout to act on', () => {
    // `material.cpp:1843`: ALPHA_ANTIALIASING_EDGE is written only under SCISSOR or HASH.
    const data = decodeStandardMaterial3D({ transparency: '1', alpha_antialiasing_mode: '1' });
    expect(data.castsShadow).toBe(false);
  });

  it('casts nothing from a refractive surface', () => {
    expect(decodeStandardMaterial3D({ refraction_enabled: 'true' }).castsShadow).toBe(false);
  });
});

describe('decodeStandardMaterial3D — depth state', () => {
  it('writes depth for an alpha-antialiased cutout, which Godot draws in its depth prepass', () => {
    // `uses_depth_in_alpha_pass()` (`scene_shader_forward_clustered.h:289-293`) is true for
    // it, as for ALPHA_DEPTH_PRE_PASS, so the colour pass sees the depth it wrote.
    const data = decodeStandardMaterial3D({ transparency: '2', alpha_antialiasing_mode: '1' });
    expect(data.transparent).toBe(true);
    expect(data.depthWrite).toBe(true);
  });

  it('defaults to OPAQUE_ONLY, which writes depth outside the alpha pass', () => {
    const data = decodeStandardMaterial3D({});
    expect(data.depthDrawMode).toBe(DepthDrawMode.OPAQUE_ONLY);
    expect(data.depthWrite).toBe(true);
    expect(data.depthTest).toBe(true);
  });

  it('honours depth_draw_mode = Always inside the alpha pass', () => {
    const data = decodeStandardMaterial3D({ transparency: '1', depth_draw_mode: '1' });
    expect(data.transparent).toBe(true);
    expect(data.depthWrite).toBe(true);
  });

  it('honours depth_draw_mode = Never even in the opaque pass', () => {
    const data = decodeStandardMaterial3D({ depth_draw_mode: '2' });
    expect(data.depthWrite).toBe(false);
    // A disabled depth draw is itself an alpha-pass trigger.
    expect(data.transparent).toBe(true);
  });

  it('reads no_depth_test, which disables the test and any write with it', () => {
    const data = decodeStandardMaterial3D({ no_depth_test: 'true' });
    expect(data.depthTest).toBe(false);
    expect(data.depthWrite).toBe(false);
    expect(data.transparent).toBe(true);
  });

  it('keeps the depth write for DEPTH_PRE_PASS, which is the point of the mode', () => {
    const data = decodeStandardMaterial3D({ transparency: '4' });
    expect(data.transparent).toBe(true);
    expect(data.depthWrite).toBe(true);
  });

  it('lets refraction override the authored depth mode', () => {
    const data = decodeStandardMaterial3D({
      refraction_enabled: 'true',
      depth_draw_mode: '0',
    });
    expect(data.depthDrawMode).toBe(DepthDrawMode.ALWAYS);
    expect(data.depthWrite).toBe(true);
  });
});

describe('decodeStandardMaterial3D — albedo alpha', () => {
  it('keeps the albedo alpha of a surface whose shader reads it', () => {
    expect(decodeStandardMaterial3D({ transparency: '1', albedo_color: 'Color(1, 1, 1, 0.25)' }).alpha).toBe(
      0.25
    );
  });

  it('drops the albedo alpha of a blended surface whose shader never reads it', () => {
    const data = decodeStandardMaterial3D({ blend_mode: '1', albedo_color: 'Color(1, 1, 1, 0.25)' });
    expect(data.alpha).toBe(1);
  });
});

/** What a geometry instance's `transparency` reads when it moves a surface to the alpha pass. */
describe('decodeStandardMaterial3D — alpha pass forced by the instance', () => {
  it('writes no depth there under the default depth-draw mode', () => {
    expect(decodeStandardMaterial3D({}).alphaPassDepthWrite).toBe(false);
  });

  it('skips the depth prepass a depth-prepass surface relies on', () => {
    expect(decodeStandardMaterial3D({ transparency: '4' }).alphaPassDepthWrite).toBe(false);
  });

  it('writes depth there under DEPTH_DRAW_ALWAYS', () => {
    expect(decodeStandardMaterial3D({ depth_draw_mode: '1' }).alphaPassDepthWrite).toBe(true);
  });

  it('writes no depth there without a depth test', () => {
    const data = decodeStandardMaterial3D({ depth_draw_mode: '1', no_depth_test: 'true' });
    expect(data.alphaPassDepthWrite).toBe(false);
  });

  it('marks a scissor cut as opaque for the fragments it keeps', () => {
    expect(decodeStandardMaterial3D({ transparency: '2' }).opaqueAfterCut).toBe(true);
  });

  it('keeps the alpha of a scissor cut under alpha antialiasing', () => {
    const data = decodeStandardMaterial3D({ transparency: '2', alpha_antialiasing_mode: '1' });
    expect(data.opaqueAfterCut).toBe(false);
  });

  it('writes alpha 1 after a hash cut', () => {
    expect(decodeStandardMaterial3D({ transparency: '3' }).opaqueAfterCut).toBe(true);
  });

  it('keeps the alpha of a hash cut under alpha antialiasing', () => {
    const data = decodeStandardMaterial3D({ transparency: '3', alpha_antialiasing_mode: '1' });
    expect(data.opaqueAfterCut).toBe(false);
  });

  it('keeps the alpha of a surface with no cut', () => {
    expect(decodeStandardMaterial3D({ transparency: '1' }).opaqueAfterCut).toBe(false);
  });

  it('reads the albedo alpha of a transparent surface', () => {
    expect(decodeStandardMaterial3D({ transparency: '1' }).readsAlbedoAlpha).toBe(true);
  });

  it('reads no albedo alpha on an opaque surface', () => {
    expect(decodeStandardMaterial3D({}).readsAlbedoAlpha).toBe(false);
  });

  it('reads no albedo alpha on a refractive surface', () => {
    const data = decodeStandardMaterial3D({ transparency: '1', refraction_enabled: 'true' });
    expect(data.readsAlbedoAlpha).toBe(false);
  });
});

describe('decodeStandardMaterial3D — refraction forces opacity', () => {
  it('ignores the albedo alpha entirely', () => {
    const data = decodeStandardMaterial3D({
      refraction_enabled: 'true',
      albedo_color: 'Color(1, 1, 1, 0.1)',
    });
    expect(data.alpha).toBe(1);
  });

  it('cuts nothing under a scissor, since ALPHA 1.0 passes every threshold', () => {
    const data = decodeStandardMaterial3D({ transparency: '2', refraction_enabled: 'true' });
    expect(data.alphaTest).toBe(0);
  });

  it('still joins the alpha pass, because it samples the screen texture', () => {
    // No transparency is authored.
    const data = decodeStandardMaterial3D({
      albedo_color: 'Color(0.85, 0.9, 1.0, 1)',
      roughness: '0.05',
      refraction_enabled: 'true',
      refraction_scale: '0.2',
    });
    expect(data.transparency).toBe(Transparency.DISABLED);
    expect(data.transparent).toBe(true);
    expect(data.depthWrite).toBe(true);
    expect(data.transmission).toBe(1);
    expect(data.refractionThickness).toBeCloseTo(0.2, 5);
  });
});

describe('decodeStandardMaterial3D — texture-slot enumeration', () => {
  it('keeps the ungated slots whenever they are authored', () => {
    const data = decodeStandardMaterial3D({
      albedo_texture: 'ExtResource("1")',
      metallic_texture: 'ExtResource("2")',
      roughness_texture: 'ExtResource("3")',
    });
    expect(data.textureSlots).toEqual({
      albedo_texture: 'ExtResource("1")',
      metallic_texture: 'ExtResource("2")',
      roughness_texture: 'ExtResource("3")',
    });
  });

  it('drops every gated slot whose feature flag is off', () => {
    // One gate table answers for both arrival paths.
    const data = decodeStandardMaterial3D({
      normal_texture: 'ExtResource("1")',
      emission_texture: 'ExtResource("2")',
      ao_texture: 'ExtResource("3")',
      heightmap_texture: 'ExtResource("4")',
      anisotropy_flowmap: 'ExtResource("5")',
    });
    expect(data.textureSlots).toEqual({});
  });

  it('keeps each gated slot once its own flag is on', () => {
    const data = decodeStandardMaterial3D({
      normal_enabled: 'true',
      normal_texture: 'ExtResource("1")',
      emission_enabled: 'true',
      emission_texture: 'ExtResource("2")',
      ao_enabled: 'true',
      ao_texture: 'ExtResource("3")',
      heightmap_enabled: 'true',
      heightmap_texture: 'ExtResource("4")',
      anisotropy_enabled: 'true',
      anisotropy_flowmap: 'ExtResource("5")',
    });
    expect(Object.keys(data.textureSlots).sort()).toEqual([
      'anisotropy_flowmap',
      'ao_texture',
      'emission_texture',
      'heightmap_texture',
      'normal_texture',
    ]);
  });

  it('carries the reference verbatim, whatever kind it is', () => {
    const data = decodeStandardMaterial3D({
      albedo_texture: 'SubResource("NoiseTexture2D_a")',
      roughness_texture: 'res://plain/path.png',
    });
    expect(data.textureSlots.albedo_texture).toBe('SubResource("NoiseTexture2D_a")');
    expect(data.textureSlots.roughness_texture).toBe('res://plain/path.png');
  });

  it('does not invent a slot the material never authored', () => {
    expect(decodeStandardMaterial3D({ normal_enabled: 'true' }).textureSlots).toEqual({});
  });
});

describe('decodeStandardMaterial3D — value-decoder edges', () => {
  it('falls back to white for a malformed albedo colour', () => {
    expect(decodeStandardMaterial3D({ albedo_color: 'Color(a, b, c, d)' }).albedo).toEqual([1, 1, 1]);
  });

  it('falls back to Godot’s BLACK emission for a malformed emission colour', () => {
    // Black, not white: `emission` defaults to `Color(0, 0, 0)`, so a value that
    // does not parse must not light the surface up.
    const data = decodeStandardMaterial3D({
      emission_enabled: 'true',
      emission: 'Color(nope)',
    });
    expect(data.emission.emissive).toEqual([0, 0, 0]);
  });

  it('reads scientific notation through the shared float grammar', () => {
    const data = decodeStandardMaterial3D({
      albedo_color: 'Color(1e-05, 0, 0, 1)',
      uv1_scale: 'Vector3(1.5e1, 2, 1)',
    });
    expect(data.albedo[0]).toBeGreaterThan(0);
    expect(data.uv1Scale.x).toBe(15);
  });

  it('falls back to the identity transform for a malformed Vector3', () => {
    const data = decodeStandardMaterial3D({ uv1_scale: 'Vector3(1, 2)', uv1_offset: 'nope' });
    expect(data.uv1Scale).toEqual({ x: 1, y: 1 });
    expect(data.uv1Offset).toEqual({ x: 0, y: 0 });
  });

  it('reads only x and y from a Vector3 transform', () => {
    expect(decodeStandardMaterial3D({ uv1_scale: 'Vector3(2, 3, 999)' }).uv1Scale).toEqual({
      x: 2,
      y: 3,
    });
  });

  it('keeps a negative normal_scale, which inverts the map rather than clamping', () => {
    // `normal_scale` hint is "-16,16,0.01" and the setter does not clamp.
    expect(decodeStandardMaterial3D({ normal_scale: '-2' }).normalScale).toEqual({
      x: -2,
      y: -2,
    });
  });

  it('falls back rather than throwing on an unparseable number', () => {
    const data = decodeStandardMaterial3D({ metallic: 'shiny', roughness: '' });
    expect(data.metallic).toBe(0);
    expect(data.roughness).toBe(1);
  });

  it('falls back to MIX / BACK for an out-of-range enum', () => {
    expect(decodeStandardMaterial3D({ blend_mode: '9' }).blendMode).toBe(BlendMode.MIX);
    expect(decodeStandardMaterial3D({ cull_mode: '-1' }).cullMode).toBe(CullMode.BACK);
  });

  it('reads shading_mode 0 as unshaded and anything else as per-pixel', () => {
    expect(decodeStandardMaterial3D({ shading_mode: '0' }).shadingMode).toBe('unshaded');
    expect(decodeStandardMaterial3D({ shading_mode: '1' }).shadingMode).toBe('per_pixel');
    expect(decodeStandardMaterial3D({ shading_mode: '2' }).shadingMode).toBe('per_pixel');
  });
});

describe('decodeStandardMaterial3D — corpus materials', () => {
  it('decodes the truck-town tree leaves as a double-sided depth-pre-pass surface', () => {
    // Both properties decide how foliage draws: pre-pass depth and both faces.
    const data = decodeStandardMaterial3D({
      transparency: '4',
      cull_mode: '2',
      albedo_texture: 'ExtResource("1_nh1kq")',
      roughness: '0.95770514',
      texture_filter: '5',
    });
    expect(data.transparency).toBe(Transparency.ALPHA_DEPTH_PRE_PASS);
    expect(data.transparent).toBe(true);
    expect(data.depthWrite).toBe(true);
    expect(data.cullMode).toBe(CullMode.DISABLED);
    expect(data.textureFilter).toBe(5);
    expect(data.roughness).toBeCloseTo(0.95770514, 6);
  });

  it('decodes the procedural-materials glass with its normal, refraction and triplanar', () => {
    // A glass material: transparency, normal scale, refraction and triplanar together.
    const data = decodeStandardMaterial3D({
      transparency: '1',
      albedo_color: 'Color(0.423529, 0.517647, 0.623529, 0.627451)',
      roughness: '0.3',
      normal_enabled: 'true',
      normal_scale: '2.0',
      normal_texture: 'ExtResource("1_ulrqn")',
      refraction_enabled: 'true',
      refraction_texture: 'ExtResource("2_ggkhk")',
      uv1_world_triplanar: 'true',
      texture_filter: '5',
    });
    expect(data.transparent).toBe(true);
    // Refraction rewrites both: `ddm = DEPTH_DRAW_ALWAYS` and a flat
    // `ALPHA = 1.0` replace the authored depth mode and the albedo alpha, so
    // this surface is depth-writing and does not fade despite `transparency = 1`
    // and an alpha of 0.63.
    expect(data.depthDrawMode).toBe(DepthDrawMode.ALWAYS);
    expect(data.depthWrite).toBe(true);
    expect(data.alpha).toBe(1);
    expect(data.normalScale).toEqual({ x: 2, y: 2 });
    expect(data.textureSlots.normal_texture).toBe('ExtResource("1_ulrqn")');
    expect(data.transmission).toBe(1);
    expect(data.refractionThickness).toBeCloseTo(0.05, 6);
    expect(data.triplanar).toBe(true);
  });
});
