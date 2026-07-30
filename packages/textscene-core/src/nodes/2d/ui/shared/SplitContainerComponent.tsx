/**
 * The DOM form of a SplitContainer, shared by the HSplit and VSplit slices.
 *
 * Not built on `createContainerComponent`, because a SplitContainer is not a
 * flow container. Every other container hands its children to CSS flow and lets
 * each child's own size flags size it; Godot's `_resort` sizes the two children
 * ITSELF and a child's flags only choose how it sits in the rect it was handed
 * (`scene/gui/split_container.cpp`):
 *
 *     fit_child_in_rect(first,  Rect2(Point2(0, 0), Size2(computed_split_offset, h)));
 *     int sofs = computed_split_offset + sep;
 *     fit_child_in_rect(second, Rect2(Point2(sofs, 0), Size2(w - sofs, h)));
 *
 * So the container declares two TRACKS and the children fall into them —
 * `grid-template-columns: <computed_split_offset> 1fr` with the separation as
 * the gap. Grid rather than flex because the tracks belong to the container:
 * `children` arrives as ONE dispatcher element, never one element per child, so
 * there is nothing to attach a per-child basis to. Two further behaviours come
 * out of that for free:
 *
 *  - A hidden child is `display: none`, and a `display: none` grid item is not
 *    placed — so the visible child slides into the first track, which is
 *    exactly `_get_sortable_child` skipping it.
 *  - `_resort` reads sortable children 0 and 1 and no others, so a third child
 *    is never given a rect. `gridAuto*: 0` + `overflow: hidden` is that: it
 *    lands in a zero-sized implicit track and is not drawn.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import {
  ControlParentProvider,
  useControlParent,
} from '../../../../r3f/controls/ControlParentContext';
import { controlStyle } from '../../../../r3f/controls/controlLayout';
import type { ControlProperties } from '../control/types';
import {
  splitFirstExtent,
  splitSeparation,
  type SplitContainerProperties,
} from './splitContainer';

export interface SplitContainerConfig {
  /** Godot type name, e.g. 'HSplitContainer'. */
  typeName: string;
  /** VSplitContainer splits the vertical axis; HSplitContainer the horizontal. */
  vertical: boolean;
}

export function createSplitContainerComponent({ typeName, vertical }: SplitContainerConfig) {
  function SplitContainer({ node, children }: ControlComponentProps) {
    const props = node.properties as SplitContainerProperties;
    const parentKind = useControlParent();

    // The sortable children, by Godot's rule: visible ones, first two only.
    const sortable = node.children
      .filter((child) => (child.properties as ControlProperties).visible !== false)
      .slice(0, 2);

    // With fewer than two, `_resort` returns early after fitting whichever
    // child exists to the WHOLE container — one track, and no separation
    // because there is no second rect for it to sit between.
    const split = sortable.length === 2;
    const tracks = split
      ? `${splitFirstExtent(
          props,
          sortable[0]?.properties as ControlProperties,
          sortable[1]?.properties as ControlProperties,
          vertical
        )} 1fr`
      : '1fr';

    const style: CSSProperties = controlStyle(props, parentKind, {
      display: 'grid',
      ...(vertical ? { gridTemplateRows: tracks } : { gridTemplateColumns: tracks }),
      // The cross axis is always the container's full extent — Godot passes
      // `get_size().width` (or height) to both rects unconditionally.
      ...(vertical ? { gridTemplateColumns: '100%' } : { gridTemplateRows: '100%' }),
      gap: split ? `${splitSeparation(props)}px` : undefined,
      // A third child gets no rect in Godot; here it gets a zero implicit track.
      gridAutoRows: '0px',
      gridAutoColumns: '0px',
      overflow: 'hidden',
    });

    return (
      <div data-control-type={typeName} data-node-name={node.name} style={style}>
        {/* 'split' tells the child it was handed a rect: no anchors, and no
            flow sizing of its own — the track already IS its size. */}
        <ControlParentProvider kind="split">{children}</ControlParentProvider>
      </div>
    );
  }
  SplitContainer.displayName = typeName;
  return SplitContainer;
}
