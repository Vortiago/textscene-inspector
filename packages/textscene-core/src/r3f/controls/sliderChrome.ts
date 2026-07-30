/**
 * Maps a Slider's Range value to the CSS boxes of its four painted parts
 * (ADR-0003), transcribing `Slider::_notification(NOTIFICATION_DRAW)` from
 * `scene/gui/slider.cpp`.
 *
 * The engine measures everything against the widget's own pixel size, which the
 * overlay does not know — layout decides it. Every placement is therefore a
 * `calc()` over `100%`, which is the same expression with `size` left symbolic.
 * Godot's default theme sets `center_grabber = 0` and `grabber_offset = 0` for
 * both HSlider and VSlider, so those terms drop out of the transcription below;
 * a theme that changed them would need them back.
 *
 * Keeping this here rather than in the slices means the geometry is one pure,
 * directly-testable function — happy-dom has no layout (ADR-0024), so the CSS
 * string is the only thing a unit test can hold to Godot's math.
 *
 * Every metric arrives through the caller's `ScaledGodotTheme` rather than from
 * the raw constants, because Godot bakes `gui/theme/default_theme_scale` into
 * the theme it builds at startup: at scale 2 the track is 16px thick and the
 * grabber a 32px texture, so a slider reading the unscaled constants would sit
 * at half size beside the Labels and Buttons around it.
 */

import type { CSSProperties } from 'react';
import {
  SLIDER_GRABBER_DISABLED_FILL,
  SLIDER_GRABBER_FILL,
  SLIDER_TICK_FILL,
  STYLE_NORMAL_FILL,
  STYLE_PROGRESS_FILL,
  type ScaledGodotTheme,
} from './godotDefaultTheme';
import {
  SLIDER_DEFAULT_EDITABLE,
  sliderTickIndices,
  type SliderProperties,
} from '../../nodes/2d/ui/shared/slider';
import { rangeRatio } from '../../nodes/2d/ui/shared/range';

export type SliderOrientation = 'horizontal' | 'vertical';

export interface SliderChrome {
  /** Extra CSS for the Control's own box: Godot's combined minimum size. */
  root: CSSProperties;
  /** The `slider` stylebox — the full-length track. */
  track: CSSProperties;
  /** The `grabber_area` stylebox — the filled span from the range's low end. */
  fill: CSSProperties;
  /** The `grabber` icon. */
  grabber: CSSProperties;
  /** One box per painted `tick` icon, in draw order. */
  ticks: CSSProperties[];
}

/**
 * `areasize` is the travel a grabber's leading edge can cover:
 * `size - grabber->get_size()`, since Godot positions the grabber by its
 * top-left corner. As CSS that is `100%` minus the grabber texture.
 */
function axisOffset(ratio: number, addPx: number, grabberSize: number): string {
  if (ratio === 0) return `${addPx}px`;
  const travel = `(100% - ${grabberSize}px) * ${ratio}`;
  return addPx === 0 ? `calc(${travel})` : `calc(${travel} + ${addPx}px)`;
}

/** Centre a box of `size` px on the cross axis of the Control's own box. */
const centred = (size: number) => `calc(50% - ${size / 2}px)`;

export function sliderChrome(
  props: SliderProperties,
  orientation: SliderOrientation,
  theme: ScaledGodotTheme
): SliderChrome {
  // `double ratio = Math::is_nan(get_as_ratio()) ? 0 : get_as_ratio();`
  const raw = rangeRatio(props);
  const ratio = Number.isNaN(raw) ? 0 : raw;
  const vertical = orientation === 'vertical';

  const {
    sliderTrackThickness: thickness,
    sliderCornerRadius: radius,
    sliderGrabberSize: grabberSize,
    sliderGrabberRadius: grabberRadius,
    sliderTickBox: tickBox,
    sliderTickThickness: tickThickness,
    sliderTickLength: tickLength,
  } = theme;

  const grabberFill = (props.editable ?? SLIDER_DEFAULT_EDITABLE)
    ? SLIDER_GRABBER_FILL
    : SLIDER_GRABBER_DISABLED_FILL;

  // `Slider::get_minimum_size()`: the slider stylebox's minimum on the main
  // axis, and the larger of it and the grabber texture on the cross axis. Godot
  // then takes the max of this and `custom_minimum_size`
  // (`Control::get_combined_minimum_size`), which the layout CSS also emits —
  // so fold both together here rather than letting one silently win.
  const minMain = thickness;
  const minCross = Math.max(thickness, grabberSize);
  const root: CSSProperties = {
    minWidth: `${Math.max(vertical ? minCross : minMain, props.customMinimumSize?.x ?? 0)}px`,
    minHeight: `${Math.max(vertical ? minMain : minCross, props.customMinimumSize?.y ?? 0)}px`,
  };

  const track: CSSProperties = {
    position: 'absolute',
    borderRadius: `${radius}px`,
    backgroundColor: STYLE_NORMAL_FILL,
    ...(vertical
      ? { top: 0, bottom: 0, left: centred(thickness), width: `${thickness}px` }
      : { left: 0, right: 0, top: centred(thickness), height: `${thickness}px` }),
  };

  // `grabber_area` spans from the range's low end to the grabber's CENTRE:
  // width `areasize * ratio + grabber->get_width() / 2` horizontally. The
  // vertical branch writes the same span as an origin plus a height whose sum
  // is exactly `size.height`, i.e. it is pinned to the BOTTOM.
  const fillExtent = axisOffset(ratio, grabberSize / 2, grabberSize);
  const fill: CSSProperties = {
    position: 'absolute',
    borderRadius: `${radius}px`,
    backgroundColor: STYLE_PROGRESS_FILL,
    ...(vertical
      ? { bottom: 0, left: centred(thickness), width: `${thickness}px`, height: fillExtent }
      : { left: 0, top: centred(thickness), height: `${thickness}px`, width: fillExtent }),
  };

  // Horizontally the grabber's left edge is `ratio * areasize`; vertically it is
  // `size.height - ratio * areasize - grabber->get_height()`, which measured
  // from the bottom edge is the same `ratio * areasize`. So value = min_value
  // puts an HSlider's grabber at the LEFT and a VSlider's at the BOTTOM.
  //
  // Godot draws the grabber texture's box, but the circle inside it has a
  // smaller radius — so the visible disc is inset from that box on every side.
  const disc = grabberRadius * 2;
  const grabberInset = (grabberSize - disc) / 2;
  const grabberLead = axisOffset(ratio, grabberInset, grabberSize);
  const grabber: CSSProperties = {
    position: 'absolute',
    width: `${disc}px`,
    height: `${disc}px`,
    borderRadius: '50%',
    backgroundColor: grabberFill,
    ...(vertical
      ? { bottom: grabberLead, left: centred(disc) }
      : { left: grabberLead, top: centred(disc) }),
  };

  // Ticks march from the widget's ORIGIN in both orientations — the vertical
  // branch does not mirror them the way it mirrors the grabber. Godot also
  // anchors the tick texture at the track's leading cross-axis edge
  // (`(size.height - widget_height) / 2`), so a tick overhangs the track rather
  // than straddling it.
  //
  // `grabber_offset = grabber->get_width() / 2 - tick->get_width() / 2` reads
  // TEXTURE sizes on both sides — the tick's box, not the bar drawn inside it —
  // and the bar's own inset within that box lands it half a box further on.
  const tickLead = grabberSize / 2 - tickBox / 2 + (tickBox - tickThickness) / 2;
  const indices = sliderTickIndices(props);
  const divisions = (props.tickCount ?? 0) - 1;
  const ticks: CSSProperties[] = indices.map((i) => {
    const lead = axisOffset(i / divisions, tickLead, grabberSize);
    return {
      position: 'absolute',
      backgroundColor: SLIDER_TICK_FILL,
      ...(vertical
        ? {
            top: lead,
            left: centred(thickness),
            width: `${tickLength}px`,
            height: `${tickThickness}px`,
          }
        : {
            left: lead,
            top: centred(thickness),
            height: `${tickLength}px`,
            width: `${tickThickness}px`,
          }),
    };
  });

  return { root, track, fill, grabber, ticks };
}
