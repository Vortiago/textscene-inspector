/**
 * A Sprite3D surface casts when Godot files it in the shadow pass: from the opaque list, or from
 * the alpha pass through a depth prepass (`render_forward_clustered.cpp:4079-4089`). `cast_shadow`
 * and the visibility range then gate it as they gate any GeometryInstance3D.
 */
import { describe, expect, it } from 'vitest';
import { castsFrom, castsSunShadowFrom } from '../../../r3f/testing/threePasses';
import { spriteMesh } from './testing/spriteMesh';

const DISCARD = { alpha_cut: '1' };

describe('<Sprite3D> shadow casting', () => {
  it('casts from a DISCARD sprite, which the opaque list draws', async () => {
    expect(castsSunShadowFrom(await spriteMesh(DISCARD))).toBe(true);
  });

  it('casts from an OPAQUE_PREPASS sprite, which draws a depth prepass', async () => {
    expect(castsSunShadowFrom(await spriteMesh({ alpha_cut: '2' }))).toBe(true);
  });

  it('casts from a sprite with transparent off, which writes no ALPHA', async () => {
    expect(castsSunShadowFrom(await spriteMesh({ transparent: 'false' }))).toBe(true);
  });

  it('casts nothing from a blended sprite, the default', async () => {
    expect(castsSunShadowFrom(await spriteMesh({}))).toBe(false);
  });

  it('casts nothing from a cut sprite with no depth test', async () => {
    expect(castsSunShadowFrom(await spriteMesh({ ...DISCARD, no_depth_test: 'true' }))).toBe(false);
  });

  it('casts nothing from a cut sprite with cast_shadow off', async () => {
    expect(castsSunShadowFrom(await spriteMesh({ ...DISCARD, cast_shadow: '0' }))).toBe(false);
  });

  it('casts a hashed shadow from a HASH sprite, into every light', async () => {
    const mesh = await spriteMesh({ alpha_cut: '3' });
    expect([mesh.customDepthMaterial, mesh.customDistanceMaterial]).toEqual([
      expect.objectContaining({ alphaHash: true }),
      expect.objectContaining({ alphaHash: true }),
    ]);
  });

  it('casts with the depth material three shares for any other cut (edge case)', async () => {
    const mesh = await spriteMesh(DISCARD);
    expect([mesh.customDepthMaterial, mesh.customDistanceMaterial]).toEqual([undefined, undefined]);
  });

  it('still casts into an omni or spot shadow past its end, as their cull reads no range', async () => {
    expect(castsFrom(await spriteMesh({ ...DISCARD, visibility_range_end: '10.0' }))).toBe(true);
  });

  it('casts no sun shadow past its end', async () => {
    expect(castsSunShadowFrom(await spriteMesh({ ...DISCARD, visibility_range_end: '10.0' }))).toBe(false);
  });

  it('receives shadows, as every GeometryInstance3D does', async () => {
    expect((await spriteMesh({ shaded: 'true' })).receiveShadow).toBe(true);
  });
});
