/**
 * `clip_children` on a canvas item. The item joins the canvas group pass of its canvas as a
 * clipping group, and its own pixels draw as the mask over the group's buffer, so its children
 * show only where its own alpha is (`canvas_item.cpp:1731-1747`).
 */

import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { useSharedClipBuffer } from './sharedClipBuffer';
import { useCanvasColorSpace } from '../canvasColorSpace';
import { runKeysOf, type CanvasItemState } from '../canvasItemState';
import type { PaintRange } from '../canvasPaintOrder';
import { createClipMask } from './clipMask';
import { ClipMaskProvider } from './ClipMaskContext';
import { registerCanvasGroup, type CanvasGroupClip } from './canvasGroupPass';
import { CanvasItemClipChildrenMode } from '../../godot/scene/canvasItem';
import { useGroupFit } from './useGroupFit';

/**
 * The margin the group clears past its rect: the default of `canvas_item_set_canvas_group_mode`
 * (`rendering_server.h:1636`), which `set_clip_children_mode` takes (`canvas_item.cpp:1747`).
 */
const CLEAR_MARGIN = 5;

interface ClipChildrenScopeProps {
  /** The item's `clip_children`. */
  mode: number;
  state: CanvasItemState;
  /**
   * Whether the item y-sorts its children. Godot's y-sort branch attaches the owner's group with no
   * child inside it, so the owner masks an empty buffer and its children draw plain.
   */
  isYSorted: boolean;
  /** The ranges of the children that draw behind the item, as its walk allocated them. */
  behindRanges: readonly PaintRange[];
  /** The run of draw sequences the item's subtree owns, which its group collects. */
  range: PaintRange;
  /** The item's own pixels, which take the mask. Its descendants stay outside the scope. */
  children: ReactNode;
}

/** The group mode of each `clip_children` value that clips. */
const CLIP_MODES: ReadonlyMap<number, CanvasGroupClip['mode']> = new Map([
  [CanvasItemClipChildrenMode.ONLY, 'clipOnly'],
  [CanvasItemClipChildrenMode.AND_DRAW, 'clipAndDraw'],
]);

export function ClipChildrenScope({
  mode,
  state,
  isYSorted,
  behindRanges,
  range,
  children,
}: ClipChildrenScopeProps) {
  const clipMode = CLIP_MODES.get(mode);
  if (!clipMode) return children;
  return (
    <ClippingGroup
      mode={clipMode}
      state={state}
      isYSorted={isYSorted}
      behindRanges={behindRanges}
      range={range}
    >
      {children}
    </ClippingGroup>
  );
}

function ClippingGroup({
  mode,
  state,
  isYSorted,
  behindRanges,
  range,
  children,
}: {
  mode: CanvasGroupClip['mode'];
  state: CanvasItemState;
  isYSorted: boolean;
  behindRanges: readonly PaintRange[];
  range: PaintRange;
  children: ReactNode;
}) {
  const scene = useThree((three) => three.scene);
  const space = useCanvasColorSpace();
  const buffer = useSharedClipBuffer(scene, space);
  const mask = useMemo(createClipMask, []);
  useLayoutEffect(() => mask.readBuffer(buffer.texture), [mask, buffer]);

  const { key: own, keyAt } = state;
  const { base, size } = range;
  const window = useMemo(
    () => (isYSorted ? { own, from: own, to: own + 1 } : runKeysOf(keyAt, own, { base, size })),
    [isYSorted, own, keyAt, base, size]
  );
  const behind = useMemo(
    () =>
      behindRanges
        .filter((run) => !isYSorted && run.size > 0)
        .map((run) => ({
          from: keyAt(run.base),
          to: keyAt(run.base + run.size - 1) + 1,
        })),
    [isYSorted, behindRanges, keyAt]
  );
  const fitRect = useGroupFit({ fitMargin: 0, clearMargin: CLEAR_MARGIN });
  // A CanvasItemMaterial replaces the clip shader of a CLIP_ONLY owner (`:2207-2216`), so its
  // children reach no mask. CLIP_AND_DRAW takes the clip shader over any material.
  const readsBuffer = mode === 'clipAndDraw' || state.material === null;
  useLayoutEffect(
    () =>
      registerCanvasGroup(scene, {
        window,
        kind: 'clip',
        buffer,
        readsBuffer,
        clip: { mode, setMasking: mask.setMasking, behind },
        fit: (drawn, _nested, frameClip) => fitRect(drawn, frameClip)?.cleared ?? null,
      }),
    [scene, window, buffer, readsBuffer, mode, mask, behind, fitRect]
  );
  return <ClipMaskProvider value={mask}>{children}</ClipMaskProvider>;
}
