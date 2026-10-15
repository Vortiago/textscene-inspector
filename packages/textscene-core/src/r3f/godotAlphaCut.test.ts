/**
 * `alpha_cut` → `BaseMaterial3D::Transparency` → three material state, the ONE
 * decision Sprite3D and Label3D share. Expected values are read off
 * `sprite_3d.cpp:285-297` / `label_3d.cpp:386-393` and the arms they select.
 */
import { describe, expect, it } from 'vitest';
import { alphaCutSurface, joinsShadowPass, NO_TRANSPARENT_FLAG } from './godotAlphaCut';
import { AlphaAntiAliasing } from '../godot/rendering/materials/alphaAntialiasing';

const DISABLED = 0;
const DISCARD = 1;
const OPAQUE_PREPASS = 2;
const HASH = 3;

const OFF = { mode: AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF, edge: 0.4 };
const TO_COVERAGE = { mode: AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE, edge: 0.4 };

describe('alphaCutSurface', () => {
  it('DISCARD scissors at the node threshold and leaves the blended pass', () => {
    // TRANSPARENCY_ALPHA_SCISSOR (`sprite_3d.cpp:287`); the fragment tail forces
    // `alpha = 1.0` (`scene_forward_clustered.glsl:1413-1415`) → opaque list.
    expect(
      alphaCutSurface({ antialiasing: OFF, mode: DISCARD, scissorThreshold: 0.25, transparentFlag: true })
    ).toEqual({
      alphaTest: 0.25,
      alphaHash: false,
      depthPrepass: false,
      depthWrite: true,
      blended: false,
      readsAlbedoAlpha: true,
      opaqueAfterCut: true,
      antialiasing: null,
    });
  });

  it('HASH cuts stochastically, reads no threshold, and leaves the blended pass', () => {
    // TRANSPARENCY_ALPHA_HASH (`sprite_3d.cpp:291`), same `alpha = 1.0` tail.
    expect(
      alphaCutSurface({ antialiasing: OFF, mode: HASH, scissorThreshold: 0.25, transparentFlag: true })
    ).toEqual({
      alphaTest: 0,
      alphaHash: true,
      depthPrepass: false,
      depthWrite: true,
      blended: false,
      readsAlbedoAlpha: true,
      opaqueAfterCut: true,
      antialiasing: null,
    });
  });

  it('OPAQUE_PREPASS blends uncut, leaves depth to its prepass, and ignores the node threshold', () => {
    // TRANSPARENCY_ALPHA_DEPTH_PRE_PASS (`sprite_3d.cpp:289`) cuts its depth draws at each pass's
    // `opaque_prepass_threshold`, so the authored 0.25 must not reach it.
    expect(
      alphaCutSurface({
        antialiasing: OFF,
        mode: OPAQUE_PREPASS,
        scissorThreshold: 0.25,
        transparentFlag: true,
      })
    ).toEqual({
      alphaTest: 0,
      alphaHash: false,
      depthPrepass: true,
      depthWrite: false,
      blended: true,
      readsAlbedoAlpha: true,
      opaqueAfterCut: false,
      antialiasing: null,
    });
  });

  it('DISABLED blends and writes no depth', () => {
    // TRANSPARENCY_ALPHA (`sprite_3d.cpp:293`); `depth_draw_opaque` on a blended
    // surface writes no depth (`material.cpp:800`).
    expect(
      alphaCutSurface({ antialiasing: OFF, mode: DISABLED, scissorThreshold: 0.25, transparentFlag: true })
    ).toEqual({
      alphaTest: 0,
      alphaHash: false,
      depthPrepass: false,
      depthWrite: false,
      blended: true,
      readsAlbedoAlpha: true,
      opaqueAfterCut: false,
      antialiasing: null,
    });
  });

  it('an out-of-range mode falls to the DISABLED arm', () => {
    // `sprite_3d.cpp:292` is an `else`, not a fourth comparison.
    expect(
      alphaCutSurface({ antialiasing: OFF, mode: 99, scissorThreshold: 0.25, transparentFlag: true })
    ).toEqual(
      alphaCutSurface({ antialiasing: OFF, mode: DISABLED, scissorThreshold: 0.25, transparentFlag: true })
    );
  });

  it('FLAG_TRANSPARENT off disables every arm, hash and scissor included', () => {
    // `sprite_3d.cpp:285-286`: TRANSPARENCY_DISABLED is the initialiser, and the
    // whole switch sits inside the flag test.
    for (const mode of [DISABLED, DISCARD, OPAQUE_PREPASS, HASH]) {
      expect(
        alphaCutSurface({ antialiasing: OFF, mode, scissorThreshold: 0.25, transparentFlag: false })
      ).toEqual({
        alphaTest: 0,
        alphaHash: false,
        depthPrepass: false,
        depthWrite: true,
        blended: false,
        readsAlbedoAlpha: false,
        opaqueAfterCut: false,
        antialiasing: null,
      });
    }
  });

  it('a node with no FLAG_TRANSPARENT always enters the switch', () => {
    // Label3D's DrawFlags have no such member (`label_3d.h:42-47`), so
    // `label_3d.cpp:386` initialises to TRANSPARENCY_ALPHA and never gates.
    for (const mode of [DISABLED, DISCARD, OPAQUE_PREPASS, HASH]) {
      expect(
        alphaCutSurface({
          antialiasing: OFF,
          mode,
          scissorThreshold: 0.25,
          transparentFlag: NO_TRANSPARENT_FLAG,
        })
      ).toEqual(alphaCutSurface({ antialiasing: OFF, mode, scissorThreshold: 0.25, transparentFlag: true }));
    }
  });
});

describe('alphaCutSurface under alpha antialiasing', () => {
  const antialiasedCut = (mode: number, transparentFlag: boolean | typeof NO_TRANSPARENT_FLAG = true) =>
    alphaCutSurface({ mode, scissorThreshold: 0.25, transparentFlag, antialiasing: TO_COVERAGE });

  it('DISCARD blends its ramp through a depth prepass, the scissor moved into the ramp', () => {
    // `uses_alpha_antialiasing` re-admits the cut to the alpha pass and `uses_depth_in_alpha_pass`
    // (`scene_shader_forward_clustered.h:279-293`), and the shader keeps the ramped alpha.
    expect(antialiasedCut(DISCARD)).toEqual({
      alphaTest: 0,
      alphaHash: false,
      depthPrepass: true,
      depthWrite: false,
      blended: true,
      readsAlbedoAlpha: true,
      opaqueAfterCut: false,
      antialiasing: { mode: TO_COVERAGE.mode, scissorThreshold: 0.25, edge: 0.65 },
    });
  });

  it('HASH hashes, then blends its ramp through a depth prepass', () => {
    expect(antialiasedCut(HASH)).toMatchObject({
      alphaHash: true,
      depthPrepass: true,
      blended: true,
      opaqueAfterCut: false,
      antialiasing: { mode: TO_COVERAGE.mode, scissorThreshold: 0, edge: 0.4 },
    });
  });

  it('leaves the arms with no cutout as they are, as the render mode needs one (edge case)', () => {
    // `material.cpp:905-912`.
    for (const mode of [DISABLED, OPAQUE_PREPASS]) {
      expect(antialiasedCut(mode)).toEqual(
        alphaCutSurface({ mode, scissorThreshold: 0.25, transparentFlag: true, antialiasing: OFF })
      );
    }
  });

  it('antialiases nothing with FLAG_TRANSPARENT off (error case)', () => {
    expect(antialiasedCut(DISCARD, false).antialiasing).toBeNull();
  });

  it('joins the shadow pass through its depth prepass', () => {
    expect(joinsShadowPass(antialiasedCut(DISCARD), true)).toBe(true);
  });
});

describe('joinsShadowPass', () => {
  const cut = (mode: number) =>
    alphaCutSurface({ antialiasing: OFF, mode, scissorThreshold: 0.5, transparentFlag: true });

  it('takes a cut surface, which the opaque list draws', () => {
    expect([DISCARD, HASH].map((mode) => joinsShadowPass(cut(mode), true))).toEqual([true, true]);
  });

  it('takes an OPAQUE_PREPASS surface, which the alpha pass draws through a depth prepass', () => {
    expect(joinsShadowPass(cut(OPAQUE_PREPASS), true)).toBe(true);
  });

  it('leaves out a blended surface, which draws no depth', () => {
    expect(joinsShadowPass(cut(DISABLED), true)).toBe(false);
  });

  it('leaves out any surface with no depth test, which moves it to the alpha pass (edge case)', () => {
    expect([DISCARD, OPAQUE_PREPASS].map((mode) => joinsShadowPass(cut(mode), false))).toEqual([
      false,
      false,
    ]);
  });
});
