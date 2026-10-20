import { describe, it, expect } from 'vitest';
import {
  ACCESSIBILITY_LIVE_NAMES,
  CONTROL_RECURSIVE_BEHAVIOR_NAMES,
  FOCUS_MODE_HINT_NAMES,
  FOCUS_MODE_NAMES,
  LAYOUT_DIRECTION_NAMES,
  LayoutDirection,
  LTR_LAYOUT_ENV,
  MOUSE_FILTER_NAMES,
  resolveLayoutRtl,
  SIZE_FLAGS_LABELS,
  type LayoutDirectionEnv,
} from './control.js';
import { AUTO_TRANSLATE_MODE_NAMES, NODE_AUTO_TRANSLATE_MODE_NAMES } from './node.js';

/** `Control::LayoutDirection` (`scene/gui/control.h:155-160`, bound at `control.cpp:4405-4409`). */
describe('LAYOUT_DIRECTION_NAMES', () => {
  it('names the arms in declaration order, MAX one past the last', () => {
    expect(LAYOUT_DIRECTION_NAMES).toEqual({
      0: 'INHERITED',
      1: 'APPLICATION_LOCALE',
      2: 'LTR',
      3: 'RTL',
      4: 'SYSTEM_LOCALE',
    });
  });
});

describe('resolveLayoutRtl — the deterministic arms', () => {
  // `data.is_rtl = (data.layout_dir == LAYOUT_DIRECTION_RTL);`
  // (`scene/gui/control.cpp:3619`): the final else, reached by LTR and RTL
  // alike, with no project setting and no locale read at all.
  it('answers an explicit LTR/RTL from the value alone, whatever the environment says', () => {
    const rtlEverywhere: LayoutDirectionEnv = {
      forceRtl: true,
      rootRtl: true,
      applicationLocaleRtl: true,
      systemLocaleRtl: true,
    };
    expect(resolveLayoutRtl(LayoutDirection.LTR, true, rtlEverywhere)).toBe(false);
    expect(resolveLayoutRtl(LayoutDirection.RTL, false, LTR_LAYOUT_ENV)).toBe(true);
  });

  // `data.is_rtl = parent_control->is_layout_rtl();` (`control.cpp:3588`).
  it('INHERITED takes the nearest ancestor Control or Window answer', () => {
    expect(resolveLayoutRtl(LayoutDirection.INHERITED, true, LTR_LAYOUT_ENV)).toBe(true);
    expect(resolveLayoutRtl(LayoutDirection.INHERITED, false, LTR_LAYOUT_ENV)).toBe(false);
  });

  // The climb runs off the top of the tree (`control.cpp:3600-3608`), where
  // `root_layout_direction` decides, and `rootRtl` is that resolved answer.
  it('INHERITED with no ancestor falls back to the root answer', () => {
    expect(resolveLayoutRtl(LayoutDirection.INHERITED, null, LTR_LAYOUT_ENV)).toBe(false);
    expect(resolveLayoutRtl(LayoutDirection.INHERITED, null, { ...LTR_LAYOUT_ENV, rootRtl: true })).toBe(
      true
    );
  });

  // `if (data.layout_dir == LAYOUT_DIRECTION_INHERITED)` guards the whole
  // climb; `force` is read inside it only under `is_part_of_edited_scene()`
  // (`control.cpp:3556-3559`), which no loaded scene satisfies.
  it('INHERITED ignores the force setting, which only an edited-scene node reads', () => {
    expect(resolveLayoutRtl(LayoutDirection.INHERITED, false, { ...LTR_LAYOUT_ENV, forceRtl: true })).toBe(
      false
    );
  });

  // `control.cpp:3610-3614` and `:3616-3620`.
  it('the two locale arms answer from their own locale, and force overrides both', () => {
    const appRtl: LayoutDirectionEnv = { ...LTR_LAYOUT_ENV, applicationLocaleRtl: true };
    expect(resolveLayoutRtl(LayoutDirection.APPLICATION_LOCALE, false, appRtl)).toBe(true);
    expect(resolveLayoutRtl(LayoutDirection.SYSTEM_LOCALE, false, appRtl)).toBe(false);

    const sysRtl: LayoutDirectionEnv = { ...LTR_LAYOUT_ENV, systemLocaleRtl: true };
    expect(resolveLayoutRtl(LayoutDirection.SYSTEM_LOCALE, false, sysRtl)).toBe(true);
    expect(resolveLayoutRtl(LayoutDirection.APPLICATION_LOCALE, false, sysRtl)).toBe(false);

    const forced: LayoutDirectionEnv = { ...LTR_LAYOUT_ENV, forceRtl: true };
    expect(resolveLayoutRtl(LayoutDirection.APPLICATION_LOCALE, false, forced)).toBe(true);
    expect(resolveLayoutRtl(LayoutDirection.SYSTEM_LOCALE, false, forced)).toBe(true);
  });

  // `ERR_FAIL_INDEX(p_direction, LAYOUT_DIRECTION_MAX)` (`control.cpp:3539`)
  // refuses the write, so the field keeps the INHERITED it was born with.
  it('an out-of-range or absent value stays INHERITED', () => {
    expect(resolveLayoutRtl(undefined, true, LTR_LAYOUT_ENV)).toBe(true);
    expect(resolveLayoutRtl(5, true, LTR_LAYOUT_ENV)).toBe(true);
    expect(resolveLayoutRtl(-1, true, LTR_LAYOUT_ENV)).toBe(true);
  });
});

describe('SIZE_FLAGS_LABELS', () => {
  it('prints the four size flag bits with the SIZE_ prefix (control.cpp:4388-4392)', () => {
    expect(SIZE_FLAGS_LABELS).toEqual({
      1: 'SIZE_FILL',
      2: 'SIZE_EXPAND',
      4: 'SIZE_SHRINK_CENTER',
      8: 'SIZE_SHRINK_END',
    });
  });
});

describe('Control input and accessibility names', () => {
  it('names each mouse filter by its constant, `control.h:88-92`', () => {
    expect(MOUSE_FILTER_NAMES).toEqual({ 0: 'STOP', 1: 'PASS', 2: 'IGNORE' });
  });

  it('names each focus mode by its constant, `control.h:65-70`', () => {
    expect(FOCUS_MODE_NAMES).toEqual({ 0: 'NONE', 1: 'CLICK', 2: 'ALL', 3: 'ACCESSIBILITY' });
  });

  it('names each focus mode as `control.cpp:4297` hints it', () => {
    expect(FOCUS_MODE_HINT_NAMES).toEqual({ 0: 'None', 1: 'Click', 2: 'All', 3: 'Accessibility' });
  });

  it('names the recursive behaviours of both focus and mouse, `control.h:72-76` and `:94-98`', () => {
    expect(CONTROL_RECURSIVE_BEHAVIOR_NAMES).toEqual({ 0: 'INHERITED', 1: 'DISABLED', 2: 'ENABLED' });
  });

  it('names each accessibility live mode without its LIVE prefix', () => {
    expect(ACCESSIBILITY_LIVE_NAMES).toEqual({ 0: 'OFF', 1: 'POLITE', 2: 'ASSERTIVE' });
  });

  it('names each auto translate mode without its prefix', () => {
    expect(AUTO_TRANSLATE_MODE_NAMES).toEqual({ 0: 'INHERIT', 1: 'ALWAYS', 2: 'DISABLED' });
  });

  it('names each auto translate mode with its prefix, as the Node property prints it', () => {
    expect(NODE_AUTO_TRANSLATE_MODE_NAMES).toEqual({
      0: 'AUTO_TRANSLATE_MODE_INHERIT',
      1: 'AUTO_TRANSLATE_MODE_ALWAYS',
      2: 'AUTO_TRANSLATE_MODE_DISABLED',
    });
  });
});
