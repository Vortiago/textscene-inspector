/**
 * Pins the parallax model to `pnpm ref:godot` at 1152x648: a default Camera2D at
 * (600, 400) puts the view's top-left at (24, 76), and layers with motion_scale
 * (0,0), (0.5,0.5) and (1,1) draw at screen (0,0), (188,162) and (576,324).
 */

import { describe, it, expect } from 'vitest';
import {
  parallaxLayerDelta,
  parallaxLayerPose,
  parallaxMirrorOffsets,
  parallaxScroll,
  parallaxViewFraming,
  type ParallaxScrollProperties,
  type ParallaxViewFraming,
} from './parallaxScroll';

const DEFAULTS: ParallaxScrollProperties = {
  scroll_base_offset: { x: 0, y: 0 },
  scroll_base_scale: { x: 1, y: 1 },
  scroll_limit_begin: { x: 0, y: 0 },
  scroll_limit_end: { x: 0, y: 0 },
  scroll_ignore_camera_zoom: false,
};

/** The measured probe scene: 1152x648 viewport, camera at (600, 400), zoom 1. */
const PROBE_VIEW: ParallaxViewFraming = {
  topLeft: { x: 24, y: 76 },
  size: { x: 1152, y: 648 },
  zoom: 1,
  centered: true,
};

const NO_MOTION = {
  motion_offset: { x: 0, y: 0 },
  motion_mirroring: { x: 0, y: 0 },
};

describe('parallaxViewFraming', () => {
  it('reads the Godot view rect off a three.js orthographic frustum', () => {
    // What `orthoFrameForCamera2D` builds for the probe scene: half-extents of
    // 576x324 centred on the camera's view centre, with Y negated.
    const framing = parallaxViewFraming(
      { left: -576, right: 576, top: 324, bottom: -324, x: 600, y: -400, zoom: 1 },
      1,
      true
    );
    expect(framing.topLeft).toEqual({ x: 24, y: 76 });
    expect(framing.size).toEqual({ x: 1152, y: 648 });
  });

  it('separates world pixels from device pixels through the camera zoom', () => {
    // At zoom 2 the same 1152x648 viewport spans half as many world pixels.
    const framing = parallaxViewFraming(
      { left: -288, right: 288, top: 162, bottom: -162, x: 600, y: -400 },
      2,
      true
    );
    expect(framing.topLeft).toEqual({ x: 312, y: 238 });
    expect(framing.size).toEqual({ x: 1152, y: 648 });
    expect(framing.zoom).toBe(2);
  });

  it('treats a zero camera zoom as 1 rather than dividing by it', () => {
    const framing = parallaxViewFraming(
      { left: -10, right: 10, top: 10, bottom: -10, x: 0, y: 0, zoom: 0 },
      0,
      false
    );
    expect(framing.zoom).toBe(1);
    expect(framing.size).toEqual({ x: 20, y: 20 });
  });
});

describe('parallaxScroll', () => {
  it('negates and zooms the view corner, per `_camera_moved`', () => {
    expect(parallaxScroll(DEFAULTS, PROBE_VIEW)).toEqual({
      offset: { x: -24, y: -76 },
      scale: 1,
    });
  });

  it('adds scroll_base_offset and multiplies by scroll_base_scale', () => {
    const scroll = parallaxScroll(
      { ...DEFAULTS, scroll_base_offset: { x: 10, y: 5 }, scroll_base_scale: { x: 0.1, y: 0 } },
      PROBE_VIEW
    );
    expect(scroll.offset.x).toBeCloseTo(10 + -24 * 0.1, 10);
    // A zero base_scale axis removes the camera term, which pins a layer to
    // the top of the view.
    expect(scroll.offset.y).toBe(5);
  });

  it('is unaffected by a limit pair that is not begin < end', () => {
    const scroll = parallaxScroll(
      { ...DEFAULTS, scroll_limit_begin: { x: 100, y: 0 }, scroll_limit_end: { x: 50, y: 0 } },
      PROBE_VIEW
    );
    expect(scroll.offset).toEqual({ x: -24, y: -76 });
  });

  it('clamps the NEGATED scroll into the limits', () => {
    // Negated scroll is (24, 76); a begin of 40 pushes it to 40, so the offset
    // comes back as -40.
    const scroll = parallaxScroll(
      { ...DEFAULTS, scroll_limit_begin: { x: 40, y: 40 }, scroll_limit_end: { x: 5000, y: 5000 } },
      PROBE_VIEW
    );
    expect(scroll.offset).toEqual({ x: -40, y: -76 });
  });

  it('clamps against the far limit using the viewport size', () => {
    const scroll = parallaxScroll(
      { ...DEFAULTS, scroll_limit_begin: { x: 0, y: 0 }, scroll_limit_end: { x: 1000, y: 5000 } },
      PROBE_VIEW
    );
    // 24 + 1152 > 1000, so the negated scroll snaps to 1000 - 1152.
    expect(scroll.offset.x).toBe(1152 - 1000);
  });

  it('divides out the zoom and forces scale 1 when scroll_ignore_camera_zoom is set', () => {
    const zoomed: ParallaxViewFraming = { ...PROBE_VIEW, zoom: 2, topLeft: { x: 312, y: 238 } };
    const plain = parallaxScroll(DEFAULTS, zoomed);
    const ignoring = parallaxScroll({ ...DEFAULTS, scroll_ignore_camera_zoom: true }, zoomed);
    expect(plain.scale).toBe(2);
    expect(ignoring.scale).toBe(1);
    // `screen_offset` is the unzoomed half-viewport (camera_2d.cpp's
    // `screen_size * 0.5`), not the zoom-scaled one used inside
    // get_camera_transform().
    expect(ignoring.offset.x).toBeCloseTo((plain.offset.x + 576 * 1) / 2, 10);
  });

  it('leaves the screen offset out for a FIXED_TOP_LEFT camera', () => {
    const zoomed: ParallaxViewFraming = { ...PROBE_VIEW, zoom: 2, centered: false };
    const scroll = parallaxScroll({ ...DEFAULTS, scroll_ignore_camera_zoom: true }, zoomed);
    expect(scroll.offset.x).toBeCloseTo((-2 * 24) / 2, 10);
  });
});

describe('parallaxLayerPose', () => {
  const scroll = parallaxScroll(DEFAULTS, PROBE_VIEW);

  it('pins a motion_scale of zero to the view corner (measured: screen 0,0)', () => {
    const pose = parallaxLayerPose(
      { ...NO_MOTION, motion_scale: { x: 0, y: 0 } },
      { position: { x: 0, y: 0 } },
      scroll
    );
    expect(pose.position).toEqual({ x: 0, y: 0 });
  });

  it('moves a half-scale layer half as far (measured: screen 188,162)', () => {
    const pose = parallaxLayerPose(
      { ...NO_MOTION, motion_scale: { x: 0.5, y: 0.5 } },
      { position: { x: 200, y: 200 } },
      scroll
    );
    expect(pose.position).toEqual({ x: 188, y: 162 });
  });

  it('keeps a full-scale layer fixed in the world (measured: screen 576,324)', () => {
    const pose = parallaxLayerPose(
      { ...NO_MOTION, motion_scale: { x: 1, y: 1 } },
      { position: { x: 600, y: 400 } },
      scroll
    );
    expect(pose.position).toEqual({ x: 576, y: 324 });
  });

  it('scales motion_offset and the authored position by the scroll scale', () => {
    const pose = parallaxLayerPose(
      {
        motion_scale: { x: 0, y: 0 },
        motion_offset: { x: 10, y: 20 },
        motion_mirroring: { x: 0, y: 0 },
      },
      { position: { x: 1, y: 2 } },
      { offset: { x: 0, y: 0 }, scale: 3 }
    );
    expect(pose).toEqual({ position: { x: 33, y: 66 }, scale: 3 });
  });

  it('wraps a mirrored axis into (-den, 0]', () => {
    const pose = parallaxLayerPose(
      { ...NO_MOTION, motion_scale: { x: 1, y: 1 }, motion_mirroring: { x: 100, y: 0 } },
      { position: { x: 250, y: 0 } },
      { offset: { x: 0, y: 0 }, scale: 1 }
    );
    expect(pose.position.x).toBe(-50);
  });

  it('scales the mirroring interval by the scroll scale', () => {
    const pose = parallaxLayerPose(
      { ...NO_MOTION, motion_scale: { x: 1, y: 1 }, motion_mirroring: { x: 100, y: 0 } },
      { position: { x: 250, y: 0 } },
      { offset: { x: 0, y: 0 }, scale: 2 }
    );
    // den = 200, new_ofs = 500 → 500 - 200*ceil(2.5) = 500 - 600.
    expect(pose.position.x).toBe(-100);
  });
});

describe('parallaxLayerDelta', () => {
  it('cancels the authored position so the wrapper holds only the scroll', () => {
    const origin = { position: { x: 600, y: 400 } };
    const pose = parallaxLayerPose(
      { ...NO_MOTION, motion_scale: { x: 1, y: 1 } },
      origin,
      parallaxScroll(DEFAULTS, PROBE_VIEW)
    );
    expect(parallaxLayerDelta(pose, origin)).toEqual({
      position: { x: -24, y: -76 },
      scale: 1,
    });
  });

  it('folds the scroll scale into the delta, not the authored transform', () => {
    const origin = { position: { x: 10, y: 10 } };
    const delta = parallaxLayerDelta({ position: { x: 30, y: 30 }, scale: 2 }, origin);
    expect(delta).toEqual({ position: { x: 10, y: 10 }, scale: 2 });
  });
});

describe('parallaxMirrorOffsets', () => {
  const unit = { x: 1, y: 1 };

  it('returns nothing when neither axis mirrors', () => {
    expect(parallaxMirrorOffsets({ x: 0, y: 0 }, unit)).toEqual([]);
  });

  it('draws exactly two instances on a single mirrored axis', () => {
    // Godot draws a 100 px x-mirror in a 1152 px viewport at x = 0 and x = 100,
    // and nothing at 220, 320 or 1120.
    expect(parallaxMirrorOffsets({ x: 100, y: 0 }, unit)).toEqual([
      { x: 100, y: 0 },
      { x: 0, y: 0 },
    ]);
  });

  it('covers all four corners when both axes mirror', () => {
    expect(parallaxMirrorOffsets({ x: 100, y: 50 }, unit)).toEqual([
      { x: 100, y: 0 },
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 0, y: 0 },
    ]);
  });

  it('multiplies the interval by the layer’s authored scale, per `_update_mirroring`', () => {
    expect(parallaxMirrorOffsets({ x: 100, y: 0 }, { x: 0.5, y: 1 })).toEqual([
      { x: 50, y: 0 },
      { x: 0, y: 0 },
    ]);
  });

  it('puts the un-mirrored copy last so it wins selection registration', () => {
    const offsets = parallaxMirrorOffsets({ x: 100, y: 50 }, unit);
    expect(offsets[offsets.length - 1]).toEqual({ x: 0, y: 0 });
  });
});
