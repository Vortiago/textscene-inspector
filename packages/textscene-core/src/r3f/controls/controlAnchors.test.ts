/**
 * `resolveGrowDirection` against `Control::set_grow_direction_preset`'s own
 * `switch` case lists (`scene/gui/control.cpp:1373-1428`) — the expectations
 * below restate those lists, not the record literals the implementation
 * happens to store them in, so a transcription typo fails here rather than
 * agreeing with itself.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../../nodes/2d/ui/control/types';
import { resolveGrowDirection } from './controlAnchors';

const BEGIN = 0;
const END = 1;
const BOTH = 2;

/** `LAYOUT_MODE_ANCHORS` / `LAYOUT_MODE_UNCONTROLLED` (`control.h:147-152`) — the two `_set_anchors_layout_preset` does NOT bail on (`control.cpp:991-993`). */
const GATED_IN = [1, 3];

function props(p: Partial<ControlProperties>): ControlProperties {
  return { name: 'N', ...p };
}

describe('resolveGrowDirection — horizontal preset table (control.cpp:1375-1399)', () => {
  // The three `set_h_grow_direction` case lists, verbatim.
  const horizontal: Array<[number, number[]]> = [
    [END, [0, 2, 4, 9]], // TOP_LEFT, BOTTOM_LEFT, CENTER_LEFT, LEFT_WIDE
    [BEGIN, [1, 3, 6, 11]], // TOP_RIGHT, BOTTOM_RIGHT, CENTER_RIGHT, RIGHT_WIDE
    [BOTH, [5, 7, 8, 10, 12, 13, 14, 15]], // CENTER_TOP, CENTER_BOTTOM, CENTER, TOP_WIDE, BOTTOM_WIDE, VCENTER_WIDE, HCENTER_WIDE, FULL_RECT
  ];

  for (const [expected, presets] of horizontal) {
    for (const preset of presets) {
      for (const layoutMode of GATED_IN) {
        it(`preset ${preset} under layout_mode ${layoutMode} grows ${expected} horizontally`, () => {
          expect(resolveGrowDirection(props({ anchorsPreset: preset, layoutMode }))[0]).toBe(expected);
        });
      }
    }
  }
});

describe('resolveGrowDirection — vertical preset table (control.cpp:1401-1427)', () => {
  // The three `set_v_grow_direction` case lists, verbatim.
  const vertical: Array<[number, number[]]> = [
    [END, [0, 1, 5, 10]], // TOP_LEFT, TOP_RIGHT, CENTER_TOP, TOP_WIDE
    [BEGIN, [2, 3, 7, 12]], // BOTTOM_LEFT, BOTTOM_RIGHT, CENTER_BOTTOM, BOTTOM_WIDE
    [BOTH, [4, 6, 8, 9, 11, 13, 14, 15]], // CENTER_LEFT, CENTER_RIGHT, CENTER, LEFT_WIDE, RIGHT_WIDE, VCENTER_WIDE, HCENTER_WIDE, FULL_RECT
  ];

  for (const [expected, presets] of vertical) {
    for (const preset of presets) {
      for (const layoutMode of GATED_IN) {
        it(`preset ${preset} under layout_mode ${layoutMode} grows ${expected} vertically`, () => {
          expect(resolveGrowDirection(props({ anchorsPreset: preset, layoutMode }))[1]).toBe(expected);
        });
      }
    }
  }
});

describe('resolveGrowDirection — the layout_mode gate (control.cpp:991-993)', () => {
  it('leaves both axes at the struct default under LAYOUT_MODE_POSITION (0)', () => {
    expect(resolveGrowDirection(props({ anchorsPreset: 8, layoutMode: 0 }))).toEqual([END, END]);
  });

  it('leaves both axes at the struct default under LAYOUT_MODE_CONTAINER (2)', () => {
    // A container-managed child never runs the preset setter, so its serialized
    // `anchors_preset` is non-operational even when present.
    expect(resolveGrowDirection(props({ anchorsPreset: 15, layoutMode: 2 }))).toEqual([END, END]);
  });

  it('leaves both axes at the struct default when layout_mode is absent entirely', () => {
    expect(resolveGrowDirection(props({ anchorsPreset: 8 }))).toEqual([END, END]);
  });
});

describe('resolveGrowDirection — authored grow_horizontal/grow_vertical win', () => {
  it('an authored pair overrides what the preset would imply', () => {
    const p = props({ anchorsPreset: 8, layoutMode: 1, growHorizontal: BEGIN, growVertical: END });
    expect(resolveGrowDirection(p)).toEqual([BEGIN, END]);
  });

  it('one authored axis overrides only that axis, the other still derives', () => {
    // CENTER (8) implies BOTH on both axes; only horizontal is authored here.
    const p = props({ anchorsPreset: 8, layoutMode: 1, growHorizontal: BEGIN });
    expect(resolveGrowDirection(p)).toEqual([BEGIN, BOTH]);
  });

  it('an authored value survives a closed gate', () => {
    const p = props({ anchorsPreset: 8, layoutMode: 2, growHorizontal: BOTH, growVertical: BEGIN });
    expect(resolveGrowDirection(p)).toEqual([BOTH, BEGIN]);
  });

  it('an authored GROW_DIRECTION_BEGIN (0) is not mistaken for "unset"', () => {
    // 0 is falsy — `??` must be what distinguishes it from absent, not `||`.
    const p = props({ anchorsPreset: 15, layoutMode: 1, growHorizontal: BEGIN, growVertical: BEGIN });
    expect(resolveGrowDirection(p)).toEqual([BEGIN, BEGIN]);
  });
});

describe('resolveGrowDirection — presets outside the table', () => {
  it('defaults to END/END for the custom-anchors sentinel -1 (control.cpp:983-989 returns early)', () => {
    expect(resolveGrowDirection(props({ anchorsPreset: -1, layoutMode: 1 }))).toEqual([END, END]);
  });

  it('defaults to END/END for an out-of-range preset (neither switch has a `default:` case)', () => {
    expect(resolveGrowDirection(props({ anchorsPreset: 99, layoutMode: 1 }))).toEqual([END, END]);
  });

  it('defaults to END/END when no anchors_preset is authored at all', () => {
    expect(resolveGrowDirection(props({ layoutMode: 1 }))).toEqual([END, END]);
  });

  it('defaults to END/END for bare properties', () => {
    expect(resolveGrowDirection(props({}))).toEqual([END, END]);
  });
});
