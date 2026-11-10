/**
 * `Parallax2D::_update_scroll` as pure math (`scene/2d/parallax_2d.cpp:102-141`), and the
 * `screen_offset` a current Camera2D writes (`scene/2d/camera_2d.cpp:61-66`).
 */

import { clamp, fposmodp } from '../../../godot/math/math';
import type { Vector2 } from '../../../godot/math/vector';
import type { ParallaxViewFraming } from '../parallaxbackground/parallaxScroll';
import type { Parallax2DProperties } from './types';

type Parallax2DScrollProperties = Pick<
  Parallax2DProperties,
  'scroll_scale' | 'scroll_offset' | 'repeat_size' | 'limit_begin' | 'limit_end' | 'follow_viewport'
>;

/** One axis of `_update_scroll`, after the clamp and the scroll scale are known. */
function scrolledAxis(
  screenOffset: number,
  scaled: number,
  scrollOffset: number,
  repeatSize: number,
  nodeScale: number
): number {
  if (!repeatSize) return screenOffset + scrollOffset - scaled;
  return screenOffset - fposmodp(scaled - scrollOffset, repeatSize * nodeScale);
}

/** The clamp runs only while the limits leave room for the viewport (`:112-117`). */
function limitedAxis(screenOffset: number, begin: number, end: number, viewportSize: number): number {
  return begin <= end - viewportSize ? clamp(screenOffset, begin, end - viewportSize) : screenOffset;
}

/** The position `_update_scroll` sets, in the node's parent space (Godot's Y down). */
export function parallax2DPosition(
  props: Parallax2DScrollProperties,
  screenOffset: Vector2,
  viewportSize: Vector2,
  nodeScale: Vector2
): Vector2 {
  const x = scrolledAxis(
    screenOffset.x,
    limitedAxis(screenOffset.x, props.limit_begin.x, props.limit_end.x, viewportSize.x) *
      props.scroll_scale.x,
    props.scroll_offset.x,
    props.repeat_size.x,
    nodeScale.x
  );
  const y = scrolledAxis(
    screenOffset.y,
    limitedAxis(screenOffset.y, props.limit_begin.y, props.limit_end.y, viewportSize.y) *
      props.scroll_scale.y,
    props.scroll_offset.y,
    props.repeat_size.y,
    nodeScale.y
  );
  return props.follow_viewport ? { x, y } : { x: x - screenOffset.x, y: y - screenOffset.y };
}

/**
 * `camera_screen_center - screen_size * 0.5`: the view's world centre less half the viewport in
 * pixels, which the zoom does not divide.
 */
export function parallax2DCameraScreenOffset(view: ParallaxViewFraming): Vector2 {
  return {
    x: view.topLeft.x + view.size.x / (2 * view.zoom) - view.size.x / 2,
    y: view.topLeft.y + view.size.y / (2 * view.zoom) - view.size.y / 2,
  };
}
