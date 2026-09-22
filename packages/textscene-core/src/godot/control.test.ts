import { describe, it, expect } from 'vitest';
import {
  LAYOUT_DIRECTION_APPLICATION_LOCALE,
  LAYOUT_DIRECTION_INHERITED,
  LAYOUT_DIRECTION_LTR,
  LAYOUT_DIRECTION_MAX,
  LAYOUT_DIRECTION_RTL,
  LAYOUT_DIRECTION_SYSTEM_LOCALE,
  LTR_LAYOUT_ENV,
  resolveLayoutRtl,
  type LayoutDirectionEnv,
} from './control.js';

/** `Control::LayoutDirection` (`scene/gui/control.h:155-160`). */
describe('LayoutDirection constants', () => {
  it('numbers the arms in declaration order, MAX one past the last', () => {
    expect([
      LAYOUT_DIRECTION_INHERITED,
      LAYOUT_DIRECTION_APPLICATION_LOCALE,
      LAYOUT_DIRECTION_LTR,
      LAYOUT_DIRECTION_RTL,
      LAYOUT_DIRECTION_SYSTEM_LOCALE,
      LAYOUT_DIRECTION_MAX,
    ]).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('resolveLayoutRtl — the deterministic arms', () => {
  // `data.is_rtl = (data.layout_dir == LAYOUT_DIRECTION_RTL);`
  // (`scene/gui/control.cpp:3619`) — the final else, reached by LTR and RTL
  // alike, with no project setting and no locale read at all.
  it('answers an explicit LTR/RTL from the value alone, whatever the environment says', () => {
    const rtlEverywhere: LayoutDirectionEnv = {
      forceRtl: true,
      rootRtl: true,
      applicationLocaleRtl: true,
      systemLocaleRtl: true,
    };
    expect(resolveLayoutRtl(LAYOUT_DIRECTION_LTR, true, rtlEverywhere)).toBe(false);
    expect(resolveLayoutRtl(LAYOUT_DIRECTION_RTL, false, LTR_LAYOUT_ENV)).toBe(true);
  });

  // `data.is_rtl = parent_control->is_layout_rtl();` (`control.cpp:3588`).
  it('INHERITED takes the nearest ancestor Control or Window answer', () => {
    expect(resolveLayoutRtl(LAYOUT_DIRECTION_INHERITED, true, LTR_LAYOUT_ENV)).toBe(true);
    expect(resolveLayoutRtl(LAYOUT_DIRECTION_INHERITED, false, LTR_LAYOUT_ENV)).toBe(false);
  });

  // The climb runs off the top of the tree (`control.cpp:3600-3608`), where
  // `root_layout_direction` decides — `rootRtl` is that resolved answer.
  it('INHERITED with no ancestor falls back to the root answer', () => {
    expect(resolveLayoutRtl(LAYOUT_DIRECTION_INHERITED, null, LTR_LAYOUT_ENV)).toBe(false);
    expect(
      resolveLayoutRtl(LAYOUT_DIRECTION_INHERITED, null, { ...LTR_LAYOUT_ENV, rootRtl: true })
    ).toBe(true);
  });

  // `if (data.layout_dir == LAYOUT_DIRECTION_INHERITED)` guards the whole
  // climb; `force` is read INSIDE it only under `is_part_of_edited_scene()`
  // (`control.cpp:3556-3559`), which no loaded scene satisfies.
  it('INHERITED ignores the force setting, which only an edited-scene node reads', () => {
    expect(
      resolveLayoutRtl(LAYOUT_DIRECTION_INHERITED, false, { ...LTR_LAYOUT_ENV, forceRtl: true })
    ).toBe(false);
  });

  // `control.cpp:3610-3614` and `:3616-3620`.
  it('the two locale arms answer from their own locale, and force overrides both', () => {
    const appRtl: LayoutDirectionEnv = { ...LTR_LAYOUT_ENV, applicationLocaleRtl: true };
    expect(resolveLayoutRtl(LAYOUT_DIRECTION_APPLICATION_LOCALE, false, appRtl)).toBe(true);
    expect(resolveLayoutRtl(LAYOUT_DIRECTION_SYSTEM_LOCALE, false, appRtl)).toBe(false);

    const sysRtl: LayoutDirectionEnv = { ...LTR_LAYOUT_ENV, systemLocaleRtl: true };
    expect(resolveLayoutRtl(LAYOUT_DIRECTION_SYSTEM_LOCALE, false, sysRtl)).toBe(true);
    expect(resolveLayoutRtl(LAYOUT_DIRECTION_APPLICATION_LOCALE, false, sysRtl)).toBe(false);

    const forced: LayoutDirectionEnv = { ...LTR_LAYOUT_ENV, forceRtl: true };
    expect(resolveLayoutRtl(LAYOUT_DIRECTION_APPLICATION_LOCALE, false, forced)).toBe(true);
    expect(resolveLayoutRtl(LAYOUT_DIRECTION_SYSTEM_LOCALE, false, forced)).toBe(true);
  });

  // `ERR_FAIL_INDEX(p_direction, LAYOUT_DIRECTION_MAX)` (`control.cpp:3539`)
  // refuses the write, so the field keeps the INHERITED it was born with.
  it('an out-of-range or absent value stays INHERITED', () => {
    expect(resolveLayoutRtl(undefined, true, LTR_LAYOUT_ENV)).toBe(true);
    expect(resolveLayoutRtl(5, true, LTR_LAYOUT_ENV)).toBe(true);
    expect(resolveLayoutRtl(-1, true, LTR_LAYOUT_ENV)).toBe(true);
  });
});
