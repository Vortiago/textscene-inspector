/**
 * The widget targets: containers and range controls whose correctness is a
 * LAID-OUT BOX or a grabber position — numbers happy-dom cannot produce and the
 * WebGL golden gate never draws.
 */

export const WIDGET_TARGETS = [
  /**
   * SplitContainer solves for ONE number and derives both rects from it, so
   * the gate is the resulting BOX WIDTHS — the thing happy-dom cannot see and
   * the WebGL golden gate does not draw. Every expectation is a Godot 4.6.3
   * render of the same fixture, scanned for the colour edge:
   *
   *   pnpm ref:godot scenes/fixtures/unit-split-container.tscn
   *   Both 194|12|194  Offset 254|12|134  Ratio 294|12|94  FirstOnly 388|12|0
   *   Neither 120|12|268  SepZero 196|8|196  Collapsed 194|12|194  DragColl 200|0|200
   */
  [
    'split-container',
    'unit-split-container.tscn',
    {
      minControls: 9,
      types: ['HSplitContainer', 'ColorRect'],
      computed: [
        ['BothLeft', 'width', (v) => v === 194, '194'],
        ['BothRight', 'width', (v) => v === 194, '194'],
        ['OffsetLeft', 'width', (v) => v === 254, '254'],
        ['OffsetRight', 'width', (v) => v === 134, '134'],
        ['RatioLeft', 'width', (v) => v === 294, '294'],
        ['RatioRight', 'width', (v) => v === 94, '94'],
        ['FirstOnlyLeft', 'width', (v) => v === 388, '388'],
        ['NeitherLeft', 'width', (v) => v === 120, '120'],
        ['NeitherRight', 'width', (v) => v === 268, '268'],
        // The grabber's 8 px floor under an overridden separation.
        ['SepZeroLeft', 'width', (v) => v === 196, '196'],
        // `collapsed` reads split_offset as 0, so this matches Both.
        ['CollapsedLeft', 'width', (v) => v === 194, '194'],
        // HIDDEN_COLLAPSED is the only dragger state that removes the gap.
        ['DraggerCollapsedLeft', 'width', (v) => v === 200, '200'],
        ['DraggerCollapsedRight', 'width', (v) => v === 200, '200'],
      ],
    },
  ],
  /**
   * The same solve on the other axis. A transposed implementation passes the
   * horizontal fixture and fails here, because these children expand
   * VERTICALLY: reading the horizontal flags takes the "neither expands"
   * branch and pins the boundary at split_offset.
   *
   *   Both 144|12|144   Offset 194|12|94
   */
  [
    'split-container-vertical',
    'unit-split-container-vertical.tscn',
    {
      minControls: 5,
      types: ['VSplitContainer', 'ColorRect'],
      computed: [
        ['BothTop', 'height', (v) => v === 144, '144'],
        ['BothBottom', 'height', (v) => v === 144, '144'],
        ['OffsetTop', 'height', (v) => v === 194, '194'],
        ['OffsetBottom', 'height', (v) => v === 94, '94'],
      ],
    },
  ],
  // Which string a LineEdit paints, and in particular that a `secret` field
  // echoes bullets rather than its plaintext.
  [
    'lineedit',
    'unit-lineedit.tscn',
    {
      minControls: 7,
      types: ['LineEdit'],
      texts: ['Enter text here...', 'Ada Lovelace', 'Read only', '•••••••'],
      absentTexts: ['hunter2'],
    },
  ],
  // Godot places a grabber at `ratio * (size - grabber)`, a calc() the browser
  // must resolve against the slider's laid-out size. The half-grabber (8px)
  // terms below are the texture's own half-width, which Godot adds to reach
  // the grabber's CENTRE.
  //
  // 16/8 are the grabber and its half at `gui/theme/default_theme_scale = 1`,
  // which is what `scenes/fixtures/` resolves to — the corpus has no
  // project.godot, and only `demos/viewport/gui_in_3d` sets a scale (2.0).
  // Scale-free cross-check, true at any scale: AtMinimum.x + AtMaximum.x
  // equals the track width, since the two sit one half-grabber from each end.
  [
    'hslider',
    'unit-hslider.tscn',
    {
      minControls: 7,
      types: ['HSlider'],
      grabbers: [
        ['AtMinimum', 'x', (x) => x === 8, 'the grabber centred one half-grabber from the LEFT edge'],
        [
          'AtMaximum',
          'x',
          (x, g) => Math.abs(x - (g.trackWidth - 8)) <= 1,
          'the grabber centred one half-grabber from the RIGHT edge',
        ],
        [
          'AtQuarter',
          'x',
          (x, g) => Math.abs(x - ((g.trackWidth - 16) * 0.25 + 8)) <= 1,
          'a quarter of the way along the travel',
        ],
        // A -50..50 range holding 0 is ratio 0.5, not 0 — it must not collapse
        // to the left end the way an unshifted default would.
        [
          'ShiftedRange',
          'x',
          (x, g) => Math.abs(x - ((g.trackWidth - 16) * 0.5 + 8)) <= 1,
          'mid-track for a -50..50 range at value 0',
        ],
      ],
    },
  ],
  // The axis that no other fixture can check: Godot measures a VSlider's
  // grabber UP from the bottom edge, so min_value is at the bottom.
  [
    'vslider',
    'unit-vslider.tscn',
    {
      minControls: 5,
      types: ['VSlider'],
      grabbers: [
        [
          'AtBottom',
          'y',
          (y, g) => Math.abs(y - (g.trackHeight - 8)) <= 1,
          'the grabber at the BOTTOM for value = min_value',
        ],
        ['AtTop', 'y', (y) => y === 8, 'the grabber at the TOP for value = max_value'],
        [
          'AtMiddle',
          'y',
          (y, g) => Math.abs(y - g.trackHeight / 2) <= 1,
          'the grabber mid-track for a half-range value',
        ],
      ],
    },
  ],
];
