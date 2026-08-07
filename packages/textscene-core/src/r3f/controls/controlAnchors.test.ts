/**
 * `resolveAnchors` and `resolveGrowDirection` against the `switch` case lists
 * of the two functions `Control::_set_anchors_layout_preset` calls —
 * `set_anchors_preset` (`scene/gui/control.cpp:1114-1229`) and
 * `set_grow_direction_preset` (`:1373-1428`). The expectations below restate
 * those lists, not the record literals the implementation happens to store
 * them in, so a transcription typo fails here rather than agreeing with itself.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../../nodes/2d/ui/control/types';
import { resolveAnchors, resolveGrowDirection, resolveOffsets } from './controlAnchors';

const BEGIN = 0;
const END = 1;
const BOTH = 2;

/** `LAYOUT_MODE_ANCHORS` / `LAYOUT_MODE_UNCONTROLLED` (`control.h:147-152`) — the two `_set_anchors_layout_preset` does NOT bail on (`control.cpp:991-993`). */
const GATED_IN = [1, 3];

function props(p: Partial<ControlProperties>): ControlProperties {
  return { name: 'N', ...p };
}

describe('resolveAnchors — preset table (control.cpp:1114-1229)', () => {
  // The four per-edge `set_anchor` case lists, verbatim. `ANCHOR_BEGIN` = 0,
  // `ANCHOR_END` = 1, and the middle list of each switch anchors that edge at 0.5.
  const edges: Array<[number, Array<[number, number[]]>]> = [
    [
      0, // Left
      [
        [0, [0, 2, 4, 10, 12, 9, 14, 15]],
        [0.5, [5, 7, 8, 13]],
        [1, [1, 3, 6, 11]],
      ],
    ],
    [
      1, // Top
      [
        [0, [0, 1, 5, 9, 11, 10, 13, 15]],
        [0.5, [4, 6, 8, 14]],
        [1, [2, 3, 7, 12]],
      ],
    ],
    [
      2, // Right
      [
        [0, [0, 2, 4, 9]],
        [0.5, [5, 7, 8, 13]],
        [1, [1, 3, 6, 10, 11, 12, 14, 15]],
      ],
    ],
    [
      3, // Bottom
      [
        [0, [0, 1, 5, 10]],
        [0.5, [4, 6, 8, 14]],
        [1, [2, 3, 7, 9, 11, 12, 13, 15]],
      ],
    ],
  ];

  for (const [edge, lists] of edges) {
    for (const [expected, presets] of lists) {
      for (const preset of presets) {
        for (const layoutMode of GATED_IN) {
          it(`preset ${preset} under layout_mode ${layoutMode} anchors edge ${edge} at ${expected}`, () => {
            expect(resolveAnchors(props({ anchorsPreset: preset, layoutMode }))[edge]).toBe(expected);
          });
        }
      }
    }
  }
});

describe('resolveAnchors — the layout_mode gate (control.cpp:990-993)', () => {
  // Measured through Godot 4.6.3's own layout engine: the same `anchors_preset`
  // on three nodes that differ only in their `layout_mode` line, instantiated
  // into a 1152x648 SubViewport, reports anchors (0, 0, 0, 0) for every node
  // whose stored mode is neither ANCHORS(1) nor UNCONTROLLED(3).
  it('leaves anchors at the struct default under LAYOUT_MODE_POSITION (0)', () => {
    expect(resolveAnchors(props({ anchorsPreset: 15, layoutMode: 0 }))).toEqual([0, 0, 0, 0]);
  });

  it('leaves anchors at the struct default under LAYOUT_MODE_CONTAINER (2)', () => {
    expect(resolveAnchors(props({ anchorsPreset: 15, layoutMode: 2 }))).toEqual([0, 0, 0, 0]);
  });

  it('leaves anchors at the struct default when layout_mode is absent entirely', () => {
    // `stored_layout_mode` defaults to POSITION (`control.h:201`), and the
    // property is applied while the node is still an orphan, so a scene that
    // authors no `layout_mode` line never opens the gate.
    expect(resolveAnchors(props({ anchorsPreset: 15 }))).toEqual([0, 0, 0, 0]);
  });

  it('still applies a preset under LAYOUT_MODE_UNCONTROLLED (3)', () => {
    expect(resolveAnchors(props({ anchorsPreset: 15, layoutMode: 3 }))).toEqual([0, 0, 1, 1]);
  });
});

describe('resolveAnchors — explicit anchor_* win', () => {
  it('an authored quartet overrides what the preset would imply', () => {
    const p = props({ anchorsPreset: 15, layoutMode: 1, anchorLeft: 0.25, anchorTop: 0.25, anchorRight: 0.75, anchorBottom: 0.75 });
    expect(resolveAnchors(p)).toEqual([0.25, 0.25, 0.75, 0.75]);
  });

  it('a partially authored quartet zeroes the unauthored edges rather than falling back to the preset', () => {
    // `set_anchor` writes one edge; the others keep whatever the struct held,
    // which for a gate-closed node is the (0, 0, 0, 0) default.
    expect(resolveAnchors(props({ anchorsPreset: 15, layoutMode: 1, anchorRight: 1 }))).toEqual([0, 0, 1, 0]);
  });

  it('an authored anchor survives a closed gate — set_anchor carries no layout_mode check', () => {
    const p = props({ anchorsPreset: 15, anchorRight: 1, anchorBottom: 1 });
    expect(resolveAnchors(p)).toEqual([0, 0, 1, 1]);
  });

  it('an authored anchor of 0 is not mistaken for "unset"', () => {
    // 0 is falsy — `??` must be what distinguishes it from absent, not `||`.
    expect(resolveAnchors(props({ anchorsPreset: 15, layoutMode: 1, anchorLeft: 0 }))).toEqual([0, 0, 0, 0]);
  });
});

describe('resolveAnchors — presets outside the table', () => {
  it('defaults to (0, 0, 0, 0) for the custom-anchors sentinel -1 (control.cpp:983-989 returns early)', () => {
    expect(resolveAnchors(props({ anchorsPreset: -1, layoutMode: 1 }))).toEqual([0, 0, 0, 0]);
  });

  it('defaults to (0, 0, 0, 0) for an out-of-range preset (`ERR_FAIL_INDEX((int)p_preset, 16)`)', () => {
    expect(resolveAnchors(props({ anchorsPreset: 99, layoutMode: 1 }))).toEqual([0, 0, 0, 0]);
  });

  it('defaults to (0, 0, 0, 0) when no anchors_preset is authored at all', () => {
    expect(resolveAnchors(props({ layoutMode: 1 }))).toEqual([0, 0, 0, 0]);
  });

  it('defaults to (0, 0, 0, 0) for bare properties', () => {
    expect(resolveAnchors(props({}))).toEqual([0, 0, 0, 0]);
  });
});

describe('resolveOffsets — the offsets side effect (control.cpp:1007-1029 → set_offsets_preset)', () => {
  // A stand-in for the node's minimum size AT PRESET TIME, deliberately
  // asymmetric so a swapped axis cannot pass.
  const MIN = { x: 30, y: 12 };

  // `set_offsets_preset` (control.cpp:1231-1345) with an EMPTY parent rect and
  // `new_size` = MIN, per side. The seven wide presets take MINSIZE, so their
  // `new_size` IS the minimum; the nine point presets take KEEP_SIZE, whose
  // `new_size` is `get_size()` — 0 on a node that has never been in a tree —
  // so every one of them writes four zeroes.
  const presetOffsets: Record<number, [number, number, number, number]> = {
    0: [0, 0, 0, 0], // TOP_LEFT
    1: [0, 0, 0, 0], // TOP_RIGHT
    2: [0, 0, 0, 0], // BOTTOM_LEFT
    3: [0, 0, 0, 0], // BOTTOM_RIGHT
    4: [0, 0, 0, 0], // CENTER_LEFT
    5: [0, 0, 0, 0], // CENTER_TOP
    6: [0, 0, 0, 0], // CENTER_RIGHT
    7: [0, 0, 0, 0], // CENTER_BOTTOM
    8: [0, 0, 0, 0], // CENTER
    9: [0, 0, 30, 0], // LEFT_WIDE — right edge at ANCHOR_BEGIN gets `+ new_size.x`
    10: [0, 0, 0, 12], // TOP_WIDE — bottom edge at ANCHOR_BEGIN gets `+ new_size.y`
    11: [-30, 0, 0, 0], // RIGHT_WIDE — left edge at ANCHOR_END gets `- new_size.x`
    12: [0, -12, 0, 0], // BOTTOM_WIDE — top edge at ANCHOR_END gets `- new_size.y`
    13: [-15, 0, 15, 0], // VCENTER_WIDE — both horizontal edges at 0.5, split
    14: [0, -6, 0, 6], // HCENTER_WIDE — both vertical edges at 0.5, split
    15: [0, 0, 0, 0], // FULL_RECT — every edge at an anchor whose term vanishes
  };

  for (const [preset, expected] of Object.entries(presetOffsets)) {
    for (const layoutMode of GATED_IN) {
      it(`preset ${preset} under layout_mode ${layoutMode} writes ${JSON.stringify(expected)}`, () => {
        expect(resolveOffsets(props({ anchorsPreset: Number(preset), layoutMode }), () => MIN)).toEqual(expected);
      });
    }
  }

  it('uses (0, 0) for a wide preset whose type contributes no minimum of its own', () => {
    expect(resolveOffsets(props({ anchorsPreset: 11, layoutMode: 1 }), () => ({ x: 0, y: 0 }))).toEqual([0, 0, 0, 0]);
  });
});

describe('resolveOffsets — authored offset_* win over the side effect', () => {
  const MIN = { x: 30, y: 12 };

  it('an authored quartet overrides every side the preset would have written', () => {
    const p = props({ anchorsPreset: 11, layoutMode: 1, offsetLeft: -100, offsetTop: 5, offsetRight: -10, offsetBottom: 40 });
    expect(resolveOffsets(p, () => MIN)).toEqual([-100, 5, -10, 40]);
  });

  it('a partially authored quartet overrides only the sides it states', () => {
    // `offset_*` are serialized AFTER `anchors_preset` (control.cpp's ADD_PROPERTY
    // order), so each authored side lands on top of what the preset wrote and
    // the unauthored ones keep it.
    expect(resolveOffsets(props({ anchorsPreset: 11, layoutMode: 1, offsetTop: 7 }), () => MIN)).toEqual([-30, 7, 0, 0]);
  });

  it('an authored offset of 0 is not mistaken for "unset"', () => {
    expect(resolveOffsets(props({ anchorsPreset: 11, layoutMode: 1, offsetLeft: 0 }), () => MIN)).toEqual([0, 0, 0, 0]);
  });

  it('reads the PRESET’s anchors, not an authored anchor_* that overrides them later', () => {
    // `set_offsets_preset` reads `data.anchor[]` as `set_anchors_preset` just
    // left it — the file's own `anchor_*` line is applied afterwards, so it
    // changes the anchors the rect resolves against but NOT the offsets the
    // preset wrote. RIGHT_WIDE's own left anchor is 1, so the left offset is
    // the full `-new_size.x` even though the node ends up anchored at 0.5.
    const p = props({ anchorsPreset: 11, layoutMode: 1, anchorLeft: 0.5, anchorRight: 0.5 });
    expect(resolveOffsets(p, () => MIN)).toEqual([-30, 0, 0, 0]);
  });
});

describe('resolveOffsets — the same gate as the anchors half', () => {
  const MIN = { x: 30, y: 12 };

  it('writes nothing under LAYOUT_MODE_POSITION (0)', () => {
    expect(resolveOffsets(props({ anchorsPreset: 11, layoutMode: 0 }), () => MIN)).toEqual([0, 0, 0, 0]);
  });

  it('writes nothing under LAYOUT_MODE_CONTAINER (2)', () => {
    expect(resolveOffsets(props({ anchorsPreset: 11, layoutMode: 2 }), () => MIN)).toEqual([0, 0, 0, 0]);
  });

  it('writes nothing when layout_mode is absent entirely, leaving authored offsets alone', () => {
    const p = props({ anchorsPreset: 11, offsetLeft: 40, offsetTop: 40, offsetRight: 240, offsetBottom: 160 });
    expect(resolveOffsets(p, () => MIN)).toEqual([40, 40, 240, 160]);
  });

  it('writes nothing for the custom-anchors sentinel -1', () => {
    expect(resolveOffsets(props({ anchorsPreset: -1, layoutMode: 1, offsetLeft: 12 }), () => MIN)).toEqual([12, 0, 0, 0]);
  });

  it('writes nothing for an out-of-range preset', () => {
    expect(resolveOffsets(props({ anchorsPreset: 99, layoutMode: 1 }), () => MIN)).toEqual([0, 0, 0, 0]);
  });

  it('writes nothing when no anchors_preset is authored at all', () => {
    expect(resolveOffsets(props({ layoutMode: 1, offsetBottom: 3 }), () => MIN)).toEqual([0, 0, 0, 3]);
  });
});

describe('resolveOffsets — measured against Godot 4.6.3 get_rect()/offsets', () => {
  // Four nodes instantiated from a .tscn into a settled 1152x648 SubViewport,
  // read back through `Control.offset_*`. The minimum size each row passes is
  // the one Godot's own `get_minimum_size()` reported for that type with its
  // DEFAULT properties — the state the node is in when `anchors_preset` is
  // applied, since `SceneState::instantiate` sets properties in the order the
  // scene lists them and a type's own (`text`, `texture`, …) come after
  // `Control`'s.
  const measured: Array<[string, number, { x: number; y: number }, [number, number, number, number]]> = [
    ['a Label under TOP_WIDE', 10, { x: 1, y: 23 }, [0, 0, 0, 23]],
    ['a Label under RIGHT_WIDE', 11, { x: 1, y: 23 }, [-1, 0, 0, 0]],
    ['a Button under BOTTOM_WIDE', 12, { x: 8, y: 8 }, [0, -8, 0, 0]],
    ['a Panel under VCENTER_WIDE', 13, { x: 0, y: 0 }, [0, 0, 0, 0]],
  ];

  for (const [label, preset, min, expected] of measured) {
    it(`${label} takes ${JSON.stringify(expected)}`, () => {
      expect(resolveOffsets(props({ anchorsPreset: preset, layoutMode: 1 }), () => min)).toEqual(expected);
    });
  }
});

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
