/**
 * Godot-parity contract for the slider chrome. Every expectation below is the
 * CSS form of a line in `Slider::_notification(NOTIFICATION_DRAW)`
 * (scene/gui/slider.cpp), with Godot's `size` left as `100%` because layout —
 * not the overlay — decides it. The default theme sets `center_grabber = 0`
 * and `grabber_offset = 0` for both sliders, so those terms are zero here.
 *
 * HORIZONTAL:
 *     double areasize = size.width - grabber->get_size().width;
 *     style->draw(ci, Rect2i(Point2i(0, (size.height - widget_height) / 2),
 *                            Size2i(size.width, widget_height)));
 *     int p = areasize * ratio + grabber->get_width() / 2 + grabber_shift;
 *     grabber_area->draw(ci, Rect2i(Point2i(0, ...), Size2i(p, widget_height)));
 *     grabber->draw(ci, Point2i(ratio * areasize + grabber_shift, ...));
 *
 * VERTICAL:
 *     double areasize = size.height - grabber->get_height();
 *     grabber->draw(ci, Point2i(..., size.height - ratio * areasize
 *                                    - grabber->get_height() + grabber_shift));
 *
 * The vertical grabber's origin measured from the BOTTOM edge is
 * `size.height - (size.height - ratio*areasize - 16) - 16 = ratio * areasize`,
 * which is why a VSlider is anchored bottom-up while an HSlider is left-to-
 * right. Measured against real Godot: in
 * `scenes/demos/viewport/gui_in_3d/gui_panel_3d.tscn` both sliders sit at their
 * default value 0 = min_value, and Godot 4.6 draws the HSlider's grabber at the
 * far LEFT and the VSlider's at the BOTTOM.
 *
 * happy-dom has no layout (ADR-0024), so these assert the CSS the component
 * emits; `pnpm verify:2d` is what checks the browser resolves it to real boxes.
 */
import { describe, it, expect } from 'vitest';
import { sliderChrome, type SliderOrientation } from './sliderChrome';
import type { SliderProperties } from '../../nodes/2d/ui/shared/slider';
import {
  scaledGodotTheme,
  SLIDER_GRABBER_DISABLED_FILL,
  SLIDER_GRABBER_FILL,
  SLIDER_TRACK_THICKNESS,
  STYLE_NORMAL_FILL,
  STYLE_PROGRESS_FILL,
} from './godotDefaultTheme';

const slider = (over: Partial<SliderProperties> = {}): SliderProperties => ({ name: 'S', ...over });

/** Unscaled theme — every metric equals the raw `scale = 1` constant. */
const UNSCALED = scaledGodotTheme(1);
const chrome = (props: SliderProperties, orientation: SliderOrientation) =>
  sliderChrome(props, orientation, UNSCALED);

describe('sliderChrome — track', () => {
  it('runs the full length of an HSlider, 8px thick and vertically centred', () => {
    const { track } = chrome(slider(), 'horizontal');
    expect(track).toMatchObject({
      position: 'absolute',
      left: 0,
      right: 0,
      top: 'calc(50% - 4px)',
      height: `${SLIDER_TRACK_THICKNESS}px`,
      backgroundColor: STYLE_NORMAL_FILL,
    });
  });

  it('runs the full height of a VSlider, 8px wide and horizontally centred', () => {
    const { track } = chrome(slider(), 'vertical');
    expect(track).toMatchObject({
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 'calc(50% - 4px)',
      width: `${SLIDER_TRACK_THICKNESS}px`,
    });
  });
});

describe('sliderChrome — grabber placement', () => {
  it('puts an HSlider grabber at the LEFT for the default value 0 = min_value', () => {
    const { grabber } = chrome(slider(), 'horizontal');
    // `ratio * areasize` = 0, plus the 1px inset of the r=7 circle inside the
    // 16px texture box.
    expect(grabber.left).toBe('1px');
    expect(grabber.top).toBe('calc(50% - 7px)');
    expect(grabber.bottom).toBeUndefined();
  });

  it('puts a VSlider grabber at the BOTTOM for the default value 0 = min_value', () => {
    const { grabber } = chrome(slider(), 'vertical');
    expect(grabber.bottom).toBe('1px');
    expect(grabber.left).toBe('calc(50% - 7px)');
    expect(grabber.top).toBeUndefined();
  });

  it('travels `(100% - grabber) * ratio` along the main axis', () => {
    expect(chrome(slider({ value: 50 }), 'horizontal').grabber.left).toBe(
      'calc((100% - 16px) * 0.5 + 1px)'
    );
    expect(chrome(slider({ value: 50 }), 'vertical').grabber.bottom).toBe(
      'calc((100% - 16px) * 0.5 + 1px)'
    );
  });

  it('reaches the far end at max_value', () => {
    expect(chrome(slider({ value: 100 }), 'horizontal').grabber.left).toBe(
      'calc((100% - 16px) * 1 + 1px)'
    );
  });

  it('is a 14px disc — the r=7 circle inside the 16px grabber texture', () => {
    const { grabber } = chrome(slider(), 'horizontal');
    expect(grabber).toMatchObject({ width: '14px', height: '14px', borderRadius: '50%' });
  });

  it('wears the disabled grabber when editable is false', () => {
    expect(chrome(slider(), 'horizontal').grabber.backgroundColor).toBe(SLIDER_GRABBER_FILL);
    expect(chrome(slider({ editable: false }), 'horizontal').grabber.backgroundColor).toBe(
      SLIDER_GRABBER_DISABLED_FILL
    );
  });
});

describe('sliderChrome — grabber_area fill', () => {
  it('spans to the grabber CENTRE, so an at-minimum slider still shows the half-grabber stub', () => {
    // `p = areasize * 0 + grabber->get_width() / 2` = 8px.
    const { fill } = chrome(slider(), 'horizontal');
    expect(fill).toMatchObject({ left: 0, width: '8px', backgroundColor: STYLE_PROGRESS_FILL });
  });

  it('grows with the ratio, keeping the half-grabber term', () => {
    expect(chrome(slider({ value: 50 }), 'horizontal').fill.width).toBe(
      'calc((100% - 16px) * 0.5 + 8px)'
    );
  });

  it('is pinned to the BOTTOM on a VSlider, matching Godot’s origin+height pair', () => {
    const { fill } = chrome(slider({ value: 50 }), 'vertical');
    expect(fill).toMatchObject({ bottom: 0, height: 'calc((100% - 16px) * 0.5 + 8px)' });
    expect(fill.top).toBeUndefined();
  });
});

describe('sliderChrome — minimum size', () => {
  it('floors an HSlider at the 16px grabber height, per Slider::get_minimum_size', () => {
    // `Size2i(ss.width, MAX(ss.height, rs.height))` = (8, max(8, 16)).
    expect(chrome(slider(), 'horizontal').root).toMatchObject({
      minWidth: '8px',
      minHeight: '16px',
    });
  });

  it('transposes that minimum for a VSlider', () => {
    expect(chrome(slider(), 'vertical').root).toMatchObject({
      minWidth: '16px',
      minHeight: '8px',
    });
  });

  it('takes the MAX with custom_minimum_size, as get_combined_minimum_size does', () => {
    const props = slider({ customMinimumSize: { x: 200, y: 4 } });
    expect(chrome(props, 'horizontal').root).toMatchObject({
      minWidth: '200px',
      minHeight: '16px',
    });
  });
});

describe('sliderChrome — ticks', () => {
  it('draws none when tick_count is unset, even with ticks_on_borders', () => {
    expect(chrome(slider({ ticksOnBorders: true }), 'horizontal').ticks).toEqual([]);
  });

  it('spaces interior ticks across the travel, offset by the grabber half-width', () => {
    // i=1 of 5 → fraction 0.25; lead = grabber/2 - tick/2 = 6, +1px bar inset.
    const { ticks } = chrome(slider({ tickCount: 5 }), 'horizontal');
    expect(ticks).toHaveLength(3);
    expect(ticks[0]).toMatchObject({
      left: 'calc((100% - 16px) * 0.25 + 7px)',
      width: '2px',
      height: '16px',
    });
  });

  it('marches a VSlider’s ticks from the TOP — Godot does not mirror them', () => {
    const { ticks } = chrome(slider({ tickCount: 5, ticksOnBorders: true }), 'vertical');
    expect(ticks).toHaveLength(5);
    expect(ticks[0]!.top).toBe('7px');
    expect(ticks[0]).toMatchObject({ width: '16px', height: '2px' });
    expect(ticks[0]!.bottom).toBeUndefined();
  });

  it('anchors the 16px tick at the track’s leading edge, so it overhangs the 8px track', () => {
    // `(size.height - widget_height) / 2` — NOT the tick's own centre.
    const { ticks } = chrome(slider({ tickCount: 3, ticksOnBorders: true }), 'horizontal');
    expect(ticks[0]!.top).toBe('calc(50% - 4px)');
  });
});

/**
 * Godot bakes `gui/theme/default_theme_scale` into the theme it builds at
 * startup — `make_flat_stylebox` rounds each margin and radius by it, and
 * `generate_icon` rasterises each SVG at it — so every slider metric moves
 * together. `gui_in_3d`, the acceptance scene, sets 2.0.
 */
describe('sliderChrome — project theme scale', () => {
  const scaled = (props: SliderProperties, orientation: SliderOrientation, scale: number) =>
    sliderChrome(props, orientation, scaledGodotTheme(scale));

  it('doubles the track, radius and grabber at default_theme_scale = 2', () => {
    const { track, grabber, root } = scaled(slider(), 'horizontal', 2);
    expect(track).toMatchObject({ height: '16px', top: 'calc(50% - 8px)', borderRadius: '8px' });
    // The 16px icon rasterises to 32px, with its r=7 circle at r=14.
    expect(grabber).toMatchObject({ width: '28px', height: '28px', left: '2px' });
    expect(root).toMatchObject({ minWidth: '16px', minHeight: '32px' });
  });

  it('scales the travel term too, so the grabber still reaches both ends', () => {
    expect(scaled(slider({ value: 100 }), 'horizontal', 2).grabber.left).toBe(
      'calc((100% - 32px) * 1 + 2px)'
    );
    expect(scaled(slider({ value: 100 }), 'vertical', 2).grabber.bottom).toBe(
      'calc((100% - 32px) * 1 + 2px)'
    );
  });

  it('is a no-op at scale 1', () => {
    expect(scaled(slider(), 'horizontal', 1)).toEqual(chrome(slider(), 'horizontal'));
  });

  it('rounds the track as TWICE a rounded margin, not the rounding of twice one', () => {
    // At 1.125 the margin is round(4·1.125) = round(4.5) = 5, so the track is
    // 10 — whereas round(8 · 1.125) = round(9) = 9. The two genuinely differ.
    expect(scaled(slider(), 'horizontal', 1.125).track.height).toBe('10px');
  });
});
