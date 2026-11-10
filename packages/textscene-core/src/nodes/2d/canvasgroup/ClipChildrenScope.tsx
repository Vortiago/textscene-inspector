/**
 * `clip_children` on a canvas item. The item joins the canvas group pass of its canvas as a
 * clipping group, and its own pixels draw as the mask over the group's buffer, so its children
 * show only where its own alpha is (`canvas_item.cpp:1731-1747`).
 */

import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { useSharedClipBuffer } from '../../../r3f/canvasGroup/sharedClipBuffer';
import { useCanvasColorSpace } from '../../../r3f/canvasColorSpace';
import type { CanvasItemState } from '../../../r3f/canvasItemState';
import { behindParentRanges, type PaintRange } from '../../../r3f/canvasPaintOrder';
import type { TscnNode } from '../../../parser/types';
import { createClipMask } from '../../../r3f/canvasGroup/clipMask';
import { ClipMaskProvider } from '../../../r3f/canvasGroup/ClipMaskContext';
import { registerCanvasGroup, type CanvasGroupClip } from '../../../r3f/canvasGroup/canvasGroupPass';
import { CanvasItemClipChildrenMode } from '../../../godot/scene/canvasItem';
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
  node: TscnNode;
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

export function ClipChildrenScope({ mode, state, node, range, children }: ClipChildrenScopeProps) {
  const clipMode = CLIP_MODES.get(mode);
  if (!clipMode) return children;
  return (
    <ClippingGroup mode={clipMode} state={state} node={node} range={range}>
      {children}
    </ClippingGroup>
  );
}

function ClippingGroup({
  mode,
  state,
  node,
  range,
  children,
}: {
  mode: CanvasGroupClip['mode'];
  state: CanvasItemState;
  node: TscnNode;
  range: PaintRange;
  children: ReactNode;
}) {
  const scene = useThree((three) => three.scene);
  const space = useCanvasColorSpace();
  const buffer = useSharedClipBuffer(scene, space);
  const mask = useMemo(createClipMask, []);
  useLayoutEffect(() => mask.readBuffer(buffer.texture), [mask, buffer]);

  const { base, size } = range;
  const { key: own, keyAt } = state;
  // Past the last key, not at `base + size`: the encoding saturates a sequence at the stride's end.
  const window = useMemo(
    () => ({ own, from: keyAt(base), to: keyAt(base + size - 1) + 1 }),
    [own, keyAt, base, size]
  );
  const behind = useMemo(
    () =>
      behindParentRanges(range, node)
        .filter((run) => run.size > 0)
        .map((run) => ({
          from: keyAt(run.base),
          to: keyAt(run.base + run.size - 1) + 1,
        })),
    [range, node, keyAt]
  );
  const fitRect = useGroupFit({ fitMargin: 0, clearMargin: CLEAR_MARGIN });
  // A CanvasItemMaterial replaces the clip shader of a CLIP_ONLY owner (`:2207-2216`), so its
  // children reach no mask. CLIP_AND_DRAW takes the clip shader over any material.
  const readsBuffer = mode === 'clipAndDraw' || state.material === null;
  useLayoutEffect(
    () =>
      registerCanvasGroup(scene, {
        window,
        buffer: readsBuffer ? buffer : null,
        clip: { mode, setMasking: mask.setMasking, behind },
        fit: (drawn, _nested, frameClip) => fitRect(drawn, frameClip)?.cleared ?? null,
      }),
    [scene, window, buffer, readsBuffer, mode, mask, behind, fitRect]
  );
  return <ClipMaskProvider value={mask}>{children}</ClipMaskProvider>;
}
