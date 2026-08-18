/**
 * `alpha_cut` → `BaseMaterial3D::Transparency` → three material state, the ONE
 * decision Sprite3D and Label3D share. Expected values are read off
 * `sprite_3d.cpp:285-297` / `label_3d.cpp:386-393` and the arms they select.
 */
import { describe, expect, it } from 'vitest';
import { alphaCutSurface, NO_TRANSPARENT_FLAG } from './godotAlphaCut';

const DISABLED = 0;
const DISCARD = 1;
const OPAQUE_PREPASS = 2;
const HASH = 3;

describe('alphaCutSurface', () => {
  it('DISCARD scissors at the node threshold and leaves the blended pass', () => {
    // TRANSPARENCY_ALPHA_SCISSOR (`sprite_3d.cpp:287`); the fragment tail forces
    // `alpha = 1.0` (`scene_forward_clustered.glsl:1414-1416`) → opaque list.
    expect(alphaCutSurface({ mode: DISCARD, scissorThreshold: 0.25, transparentFlag: true })).toEqual({
      alphaTest: 0.25,
      alphaHash: false,
      depthWrite: true,
      blended: false,
    });
  });

  it('HASH cuts stochastically, reads no threshold, and leaves the blended pass', () => {
    // TRANSPARENCY_ALPHA_HASH (`sprite_3d.cpp:291`), same `alpha = 1.0` tail.
    expect(alphaCutSurface({ mode: HASH, scissorThreshold: 0.25, transparentFlag: true })).toEqual({
      alphaTest: 0,
      alphaHash: true,
      depthWrite: true,
      blended: false,
    });
  });

  it('OPAQUE_PREPASS keeps blending, writes depth, and ignores the node threshold', () => {
    // TRANSPARENCY_ALPHA_DEPTH_PRE_PASS (`sprite_3d.cpp:289`) cuts against the
    // SCENE's threshold, so the authored 0.25 must not reach it.
    expect(alphaCutSurface({ mode: OPAQUE_PREPASS, scissorThreshold: 0.25, transparentFlag: true })).toEqual({
      alphaTest: 0.5,
      alphaHash: false,
      depthWrite: true,
      blended: true,
    });
  });

  it('DISABLED blends and writes no depth', () => {
    // TRANSPARENCY_ALPHA (`sprite_3d.cpp:293`); `depth_draw_opaque` on a blended
    // surface writes no depth (`material.cpp:800`).
    expect(alphaCutSurface({ mode: DISABLED, scissorThreshold: 0.25, transparentFlag: true })).toEqual({
      alphaTest: 0,
      alphaHash: false,
      depthWrite: false,
      blended: true,
    });
  });

  it('an out-of-range mode falls to the DISABLED arm', () => {
    // `sprite_3d.cpp:292` is an `else`, not a fourth comparison.
    expect(alphaCutSurface({ mode: 99, scissorThreshold: 0.25, transparentFlag: true })).toEqual(
      alphaCutSurface({ mode: DISABLED, scissorThreshold: 0.25, transparentFlag: true })
    );
  });

  it('FLAG_TRANSPARENT off disables every arm, hash and scissor included', () => {
    // `sprite_3d.cpp:285-286`: TRANSPARENCY_DISABLED is the initialiser, and the
    // whole switch sits inside the flag test.
    for (const mode of [DISABLED, DISCARD, OPAQUE_PREPASS, HASH]) {
      expect(alphaCutSurface({ mode, scissorThreshold: 0.25, transparentFlag: false })).toEqual({
        alphaTest: 0,
        alphaHash: false,
        depthWrite: true,
        blended: false,
      });
    }
  });

  it('a node with no FLAG_TRANSPARENT always enters the switch', () => {
    // Label3D's DrawFlags have no such member (`label_3d.h:42-47`), so
    // `label_3d.cpp:386` initialises to TRANSPARENCY_ALPHA and never gates.
    for (const mode of [DISABLED, DISCARD, OPAQUE_PREPASS, HASH]) {
      expect(alphaCutSurface({ mode, scissorThreshold: 0.25, transparentFlag: NO_TRANSPARENT_FLAG })).toEqual(
        alphaCutSurface({ mode, scissorThreshold: 0.25, transparentFlag: true })
      );
    }
  });
});
