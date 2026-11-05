/**
 * One ScrollBar's track and grabber, drawn the way `scene/gui/scroll_bar.cpp:295-344` does for a bar
 * its owner places: ScrollContainer, GraphEdit and RichTextLabel each own bars of their own.
 */
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import {
  snappedControlOrigin,
  type ControlDrawTransform,
} from '../../../../r3f/controls/native/controlPixelSnap';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { Rgba } from '../../../../godot/math/math';
import type { ScrollBarPlacement } from './scrollBarSolver';

/**
 * A ScrollBar's `ControlDrawTransform`. Its owner places it through `set_anchor_and_offset`
 * alone, so it carries no rotation, scale or pivot.
 */
const SCROLL_BAR_DRAW_TRANSFORM: ControlDrawTransform = {
  rotation: 0,
  scale: { x: 1, y: 1 },
  pivot: { x: 0, y: 0 },
};

/**
 * A bar's track and grabber sit at fractions above its slot's key, below the next sibling's
 * integer key: the grabber paints over the track, and both over what the slot's node drew.
 */
export const SCROLL_BAR_TRACK_RENDER_ORDER_OFFSET = 0.25;
export const SCROLL_BAR_GRABBER_RENDER_ORDER_OFFSET = 0.5;

interface ScrollBarChromeProps {
  bar: ScrollBarPlacement;
  track: StyleBoxFlatData;
  grabber: StyleBoxFlatData;
  /** Raw sRGB, which `<StyleBoxQuad>` composes into `track` and `grabber`. */
  color: Rgba;
  /** The track's key. The grabber's key sits above it, since the track draws first. */
  renderOrder: number;
  grabberRenderOrder: number;
  /** The walker's `gui/common/snap_controls_to_pixels`, the only value correct inside a SubViewport. */
  snapToPixels: boolean;
}

/**
 * Each bar is its own CanvasItem, so it snaps through `snappedControlOrigin` apart from its owner,
 * while `bar.rect` stays at full precision for the owner's arithmetic. The grabber is no node: it
 * draws unrounded inside the bar's canvas item and inherits the bar's snap.
 */
export function ScrollBarChrome({
  bar,
  track,
  grabber,
  color,
  renderOrder,
  grabberRenderOrder,
  snapToPixels,
}: ScrollBarChromeProps) {
  if (!bar.visible) return null;
  const origin = snappedControlOrigin(bar.rect, SCROLL_BAR_DRAW_TRANSFORM, snapToPixels);
  // A group carries the position. `StyleBoxQuad` takes only the size and flips y.
  return (
    <CanvasItemGroup position={[origin.x, -origin.y, 0]} renderOrder={renderOrder}>
      <StyleBoxQuad styleBox={track} color={color} rect={bar.rect} renderOrder={renderOrder} />
      <CanvasItemGroup position={[bar.grabberRect.x, -bar.grabberRect.y, 0]} renderOrder={grabberRenderOrder}>
        <StyleBoxQuad
          styleBox={grabber}
          color={color}
          rect={bar.grabberRect}
          renderOrder={grabberRenderOrder}
        />
      </CanvasItemGroup>
    </CanvasItemGroup>
  );
}
