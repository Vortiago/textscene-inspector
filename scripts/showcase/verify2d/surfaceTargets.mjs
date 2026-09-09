/**
 * The sub-viewport targets: the only ones whose pixels travel through
 * `readPixels` into a `<canvas>`, so each carries Godot's own probe values for
 * the same fixture.
 */

export const SURFACE_TARGETS = [
  /**
   * A sub-viewport holding 2D-WORLD content: the only target whose pixels have
   * to travel through `readPixels` → `<canvas>`, since a Control subtree
   * renders as DOM and would look right with no blit at all. Nothing else in
   * the repo can see this — the golden gate screenshots the WebGL canvas, and
   * this canvas lives in the DOM overlay (ADR-0024).
   *
   * Every value below is a Godot 4.6.3 render of the same fixture:
   *
   *   pnpm ref:godot scenes/fixtures/unit-sub-viewport-container-2d-content.tscn \
   *     --probe 200,100 --probe 130,160 --probe 280,210
   *   → rgb(127, 127, 127) · rgb(255, 102, 0) · rgb(76, 76, 76)
   *
   * (probes there are stage coordinates: the surface's own top-left is the
   * container's, at 100, 80.)
   */
  [
    'sub-viewport-2d-content',
    'unit-sub-viewport-container-2d-content.tscn',
    {
      minControls: 3,
      types: ['SubViewportContainer', 'ColorRect'],
      surface: {
        node: 'SubViewport',
        size: [200, 150],
        probes: [
          // The encode: stored 55, displayed 128. A raw blit reads 55 here and
          // still looks like a plausible grey — this is the assertion that
          // separates "the pixels arrived" from "the pixels arrived correct".
          [100, 20, [128, 128, 128], 'Band, authored Color(0.5, 0.5, 0.5)'],
          [30, 80, [255, 102, 0], 'Mark'],
          [180, 130, [77, 77, 77], 'uncovered — the viewport clear colour'],
          // Orientation. The readback is bottom-up and `ImageData` is top-down,
          // so a missing (or doubled) row flip lands the Band at rows 110..149
          // and the Mark at columns 150..189. Both must read clear.
          [100, 130, [77, 77, 77], 'below the Band — where a vertical flip puts it'],
          [170, 80, [77, 77, 77], 'right of the Mark — where a horizontal flip puts it'],
        ],
      },
    },
  ],
  /**
   * `stretch` on: the container's rect, not the authored `size`, is what the
   * viewport renders at (`recalc_force_viewport_sizes` →
   * `set_size_force(get_size() / stretch_shrink)`).
   *
   *   pnpm ref:godot scenes/fixtures/unit-sub-viewport-container-stretch-2d-content.tscn \
   *     --probe 200,100 --probe 350,255 --probe 150,250
   *   → rgb(127, 127, 127) · rgb(255, 102, 0) · rgb(76, 76, 76)
   *
   * `size` asserts the target really is 300x200 rather than the authored
   * 200x150, and the `Outside` probe asserts the consequence: that square is
   * wholly outside a 200x150 rect, so it is drawn only if the content was laid
   * out against the forced one. It is either there or it is not — no amount of
   * scaling turns one into the other.
   */
  [
    'sub-viewport-stretch-2d-content',
    'unit-sub-viewport-container-stretch-2d-content.tscn',
    {
      minControls: 3,
      types: ['SubViewportContainer', 'ColorRect'],
      surface: {
        node: 'SubViewport',
        size: [300, 200],
        probes: [
          [150, 20, [128, 128, 128], 'Band — spans the forced rect’s full width'],
          [250, 175, [255, 102, 0], 'Outside — beyond the authored 200x150 target'],
          [50, 170, [77, 77, 77], 'uncovered — the viewport clear colour'],
        ],
      },
    },
  ],
  /**
   * The same surface fed by the 3D pass instead of the 2D one — the sibling
   * that localises WHICH PASS filled the target. The two fixtures author the
   * same `Color(0.5, 0.5, 0.5)`, so a curve applied to one pass and not the
   * other shows up as a bare value difference between two otherwise identical
   * scenes. It is the pair that caught the 2D canvas tonemapping.
   *
   *   pnpm ref:godot scenes/fixtures/unit-sub-viewport-container-3d-content.tscn \
   *     --probe 200,120 --probe 280,210
   *   → rgb(127, 127, 127) · rgb(76, 76, 76)
   */
  [
    'sub-viewport-3d-content',
    'unit-sub-viewport-container-3d-content.tscn',
    {
      minControls: 3,
      types: ['SubViewportContainer', 'ColorRect'],
      surface: {
        node: 'SubViewport',
        size: [200, 150],
        probes: [
          // The unshaded box: the SAME number the 2D sibling's band reads.
          [100, 40, [128, 128, 128], 'the unshaded box, authored Color(0.5, 0.5, 0.5)'],
          [180, 130, [77, 77, 77], 'uncovered — the viewport clear colour'],
          [100, 130, [77, 77, 77], 'below the box — where a vertical flip puts it'],
          [20, 40, [77, 77, 77], 'left of the box — the camera frames it centred'],
        ],
      },
    },
  ],
  /**
   * The same stretching surface, framed by a Camera2D instead of by the whole
   * target rect — the only fixture where the sub-viewport's 2D pass builds its
   * projection from `orthoFrameForCamera2D` rather than `orthoFrameForSize`.
   *
   * `Decoy` is what makes it falsifiable rather than merely plausible: it is
   * wholly outside the camera's view and wholly inside the whole-rect fallback,
   * while `Band`/`Mark` are the other way round. So the surface holds EITHER
   * set, never both — and "both, in horizontal bands" is precisely what a paint
   * that covered only part of its canvas would look like. The clear-colour
   * probe at (80, 50) is that guard: it is where the fallback framing puts
   * Decoy, and it must read the viewport's clear colour.
   *
   * `--scene-camera` is required: `ref:godot` disables a 2D scene's own cameras
   * by default, and without it Godot renders the whole-rect fallback — the very
   * picture this fixture exists to distinguish from.
   *
   *   pnpm ref:godot scenes/fixtures/unit-sub-viewport-container-camera-2d.tscn \
   *     --scene-camera --probe 250,100 --probe 140,175 --probe 180,130 \
   *     --probe 250,260 --probe 360,175
   *   → rgb(127, 127, 127) · rgb(255, 102, 0) · rgb(76, 76, 76)
   *     · rgb(76, 76, 76) · rgb(76, 76, 76)
   */
  [
    'sub-viewport-camera-2d',
    'unit-sub-viewport-container-camera-2d.tscn',
    {
      minControls: 3,
      types: ['SubViewportContainer', 'ColorRect'],
      surface: {
        node: 'SubViewport',
        size: [300, 200],
        probes: [
          [150, 20, [128, 128, 128], 'Band — the camera view’s top strip'],
          [40, 95, [255, 102, 0], 'Mark'],
          [80, 50, [77, 77, 77], 'where the whole-rect fallback puts Decoy'],
          [150, 180, [77, 77, 77], 'below the Band — where a vertical flip puts it'],
          [260, 95, [77, 77, 77], 'right of the Mark — where a horizontal flip puts it'],
        ],
      },
    },
  ],
];
