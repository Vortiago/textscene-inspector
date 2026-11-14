/**
 * The painter pieces ScrollContainer and ItemList share: one scrollbar (track and grabber) and one
 * `scroll_hint_*` fade, drawn from a placement a native solver computed.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { canvasSubOrder, canvasSubOrders, type CanvasSlot } from '../../../../r3f/canvasItemState';
import {
  snappedControlOrigin,
  type ControlDrawTransform,
} from '../../../../r3f/controls/native/controlPixelSnap';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { useOptionalIconTexture } from '../../../../r3f/controls/native/useIconTexture';
import { SCROLL_HINT_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { applyUvWindow, flippedUvWindow, FULL_UV_WINDOW } from '../../../../r3f/uvWindow';
import type { Rgba } from '../../../../godot/math/math';
import type { ScrollBarBoxes, ScrollBarPlacement, ScrollHintPlacement } from './scrollBarSolver';

/**
 * `scroll_hint_vertical_color` and `scroll_hint_horizontal_color`: `Color(0, 0, 0)`
 * in the table, set as the hint's `modulate`
 * (`scroll_container.cpp:622,631,640,650`). Only the texture's alpha ramp shows.
 */
export const SCROLL_HINT_MODULATE = new THREE.Color(0, 0, 0);

/**
 * The pieces of a scroll chrome in its slot: a hint draws above what the slot names and below both
 * scrollbars (`scroll_container.cpp:905-924`). A bare slot key would tie with that item, and three
 * would put the fade under an opaque one.
 */
const SCROLL_CHROME_PIECES = ['hints', 'bars'] as const;

function scrollChromeOrders(chromeSlot: CanvasSlot) {
  return canvasSubOrders(chromeSlot, SCROLL_CHROME_PIECES);
}

/**
 * One visible `scroll_hint_*` TextureRect, stretched across its rect as one
 * quad (`scroll_container.cpp:905-912`). `STRETCH_TILE` (`:751-752`) draws the
 * same pixels, since each gradient is uniform along its tiling axis.
 */
export function ScrollHintChrome({
  hint,
  color,
  opacity,
  chromeSlot,
}: {
  hint: ScrollHintPlacement | null;
  color: THREE.Color;
  opacity: number;
  /** See `ScrollBarChromeProps.chromeSlot`. */
  chromeSlot: CanvasSlot;
}) {
  const loaded = useOptionalIconTexture(
    hint === null ? null : hint.vertical ? SCROLL_HINT_ICONS.vertical : SCROLL_HINT_ICONS.horizontal
  );
  // `set_flip_h`/`set_flip_v` (`:629-630,647-648`) become a negative UV repeat.
  // Each hook instance has its own texture, so the two hints never share a flip.
  const flipH = hint?.flipH === true;
  const flipV = hint?.flipV === true;
  // A memo, not an effect: three refreshes `mapTransform` only when the
  // material changes, so a flip applied after mount never reaches the GPU.
  const texture = useMemo(() => {
    if (!loaded) return null;
    applyUvWindow(loaded, flippedUvWindow(FULL_UV_WINDOW, flipH, flipV));
    return loaded;
  }, [loaded, flipH, flipV]);

  if (!hint || !texture) return null;
  const renderOrder = scrollChromeOrders(chromeSlot).hints.key;
  return (
    <PositionedIcon
      rect={hint.rect}
      texture={texture}
      color={color}
      opacity={opacity}
      renderOrder={renderOrder}
      canvasKey={renderOrder}
    />
  );
}

/**
 * A ScrollBar's `ControlDrawTransform`. `_update_scrollbar_position` places the
 * bars through `set_anchor_and_offset` alone, so they carry no rotation, scale
 * or pivot.
 */
const SCROLL_BAR_DRAW_TRANSFORM: ControlDrawTransform = {
  rotation: 0,
  scale: { x: 1, y: 1 },
  pivot: { x: 0, y: 0 },
};

interface ScrollBarChromeProps {
  bar: ScrollBarPlacement;
  boxes: ScrollBarBoxes;
  /** Raw sRGB, which `<StyleBoxQuad>` composes into both boxes. */
  color: Rgba;
  /**
   * The slot the chrome draws inside, below the next sibling. ScrollContainer passes its
   * `chromeSlot`: its bars are `INTERNAL_MODE_BACK` children (`scroll_container.cpp:919,924`) that
   * paint after every descendant. ItemList passes its own key's slot: its bars are
   * `INTERNAL_MODE_FRONT` children (`item_list.cpp:2472,2476`) that paint over its rows and under
   * its regular children.
   */
  chromeSlot: CanvasSlot;
  /** The walker's `gui/common/snap_controls_to_pixels`, the only value correct inside a SubViewport. */
  snapToPixels: boolean;
  /** The bar's node name, such as ScrollContainer's `_h_scroll` (`scroll_container.cpp:917`). */
  name?: string;
}

/** The draw-order keys of a bar's track and of its grabber, which paints over the track. */
function scrollBarRenderOrders(chromeSlot: CanvasSlot): { track: number; grabber: number } {
  const bars = scrollChromeOrders(chromeSlot).bars;
  return { track: bars.key, grabber: canvasSubOrder(bars).key };
}

/**
 * One scrollbar's track and grabber. Each bar is its own CanvasItem
 * (`scene/gui/scroll_container.cpp:919,924`), so it snaps through
 * `snappedControlOrigin` apart from the container, while `bar.rect` stays at
 * full precision for the reservation arithmetic.
 */
export function ScrollBarChrome({ bar, boxes, color, chromeSlot, snapToPixels, name }: ScrollBarChromeProps) {
  if (!bar.visible) return null;
  const { track: trackKey, grabber: grabberKey } = scrollBarRenderOrders(chromeSlot);
  const origin = snappedControlOrigin(bar.rect, SCROLL_BAR_DRAW_TRANSFORM, snapToPixels);
  // A group carries the position. `StyleBoxQuad` takes only the size and flips y.
  // The grabber is no node (`scene/gui/scroll_bar.cpp:326-344`): it draws
  // unrounded inside the bar's canvas item and inherits the bar's snap.
  return (
    <CanvasItemGroup name={name} position={[origin.x, -origin.y, 0]} renderOrder={trackKey}>
      <StyleBoxQuad styleBox={boxes.scroll} color={color} rect={bar.rect} renderOrder={trackKey} />
      <CanvasItemGroup position={[bar.grabberRect.x, -bar.grabberRect.y, 0]} renderOrder={grabberKey}>
        <StyleBoxQuad
          styleBox={boxes.grabber}
          color={color}
          rect={bar.grabberRect}
          renderOrder={grabberKey}
        />
      </CanvasItemGroup>
    </CanvasItemGroup>
  );
}
