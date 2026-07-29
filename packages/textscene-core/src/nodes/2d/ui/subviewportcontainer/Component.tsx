/**
 * `<SubViewportContainer>` — the **viewport surface** (ADR-0030): the one place
 * a sub-viewport's canvas subtree is drawn.
 *
 * Godot draws EVERY `SubViewport` child, stacked in tree order, and sizes each
 * drawn rect from `stretch` (`subviewport_container.cpp`):
 *
 *   stretch  → draw_texture_rect(tex, Rect2(Vector2(), get_size()))
 *   !stretch → draw_texture_rect(tex, Rect2(Vector2(), c->get_size()))
 *
 * so with `stretch` off the surface is the SUB-VIEWPORT's size, not the
 * container's — the container rect does not size the content. With it on, the
 * viewport is first resized to `get_size() / stretch_shrink`, so content lays
 * out against the smaller rect and is scaled back up to fill the container.
 *
 * Clipping is a CONSEQUENCE, not an operation: the container issues no clip,
 * but the render target is only `size` pixels, so anything outside it was never
 * rendered. That is why `overflow: hidden` belongs on the surface and never on
 * the container — a surface may legitimately overflow the container's own box,
 * since Godot Controls clip only with `clip_contents`.
 *
 * Content: a sub-viewport holding **Controls** renders them straight into the
 * surface as DOM, which is both cheaper and sharper than going through pixels.
 * A sub-viewport holding 2D-world or 3D content has no DOM form; its pixels
 * arrive through `ViewportTextureEntry.readPixels`, which is the offscreen
 * subsystem's job — until then such a surface renders correctly sized, cleared,
 * and empty rather than wrong.
 */

import type { CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { ControlParentProvider, useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import { ControlDispatcher } from '../../../../r3f/controls/ControlDispatcher';
import { joinPath } from '../../../../utils/nodePath';
import type { TscnNode } from '../../../../parser/types';
import type { SubViewportProperties } from '../../../viewport/subviewport/types';
import type { SubViewportContainerProperties } from './types';

/**
 * Godot's `rendering/environment/defaults/default_clear_color` — what an
 * opaque render target clears to. Measured off a Godot 4.6.3 render of a
 * stretching container whose content did not cover the whole target.
 */
const DEFAULT_CLEAR_COLOR = 'rgb(77, 77, 77)';

/** One sub-viewport's drawn rect, as an absolutely-clipped surface. */
function ViewportSurface({
  viewport,
  path,
  stretch,
  shrink,
}: {
  viewport: TscnNode;
  path: string;
  stretch: boolean;
  shrink: number;
}) {
  const props = viewport.properties as SubViewportProperties;
  const size = props.size ?? { x: 512, y: 512 };

  const style: CSSProperties = {
    position: 'relative',
    // The render target is only `size` pixels — content beyond it was never
    // rendered, so the clip belongs here rather than on the container.
    overflow: 'hidden',
    ...(props.transparent_bg ? {} : { backgroundColor: DEFAULT_CLEAR_COLOR }),
    ...(stretch
      ? {
          // Fills the container's rect. With a shrink the content lays out
          // against rect/shrink and is scaled back up, mirroring
          // `set_size_force(get_size() / shrink)`.
          width: shrink > 1 ? `${100 / shrink}%` : '100%',
          height: shrink > 1 ? `${100 / shrink}%` : '100%',
          ...(shrink > 1 ? { transform: `scale(${shrink})`, transformOrigin: 'top left' } : {}),
        }
      : { width: `${size.x}px`, height: `${size.y}px` }),
  };

  return (
    <div data-viewport-surface="true" data-node-name={viewport.name} style={style}>
      {/* Controls inside a sub-viewport anchor against the TARGET rect, which
          this element is — so they get the 'free' (anchors/offsets) kind. */}
      <ControlParentProvider kind="free">
        <ControlDispatcher nodes={viewport.children} parentPath={path} />
      </ControlParentProvider>
    </div>
  );
}

export function SubViewportContainer({ node, path, children }: ControlComponentProps) {
  const props = node.properties as SubViewportContainerProperties;
  const parentKind = useControlParent();
  const stretch = props.stretch ?? false;
  const shrink = Math.max(1, props.stretch_shrink ?? 1);

  const style: CSSProperties = controlLayoutStyle(props, parentKind);
  const basePath = path ?? node.name;

  // `ControlDispatcher` stops at a viewport boundary, so the SubViewport
  // children never reach `children` — this component reaches for them directly,
  // which is exactly the "dispatched by its surface, not its parent" rule.
  const viewports = node.children.filter((child) => child.type === 'SubViewport');

  return (
    <div data-control-type="SubViewportContainer" data-node-name={node.name} style={style}>
      {viewports.map((viewport) => (
        <ViewportSurface
          key={viewport.name}
          viewport={viewport}
          path={joinPath(basePath, viewport.name)}
          stretch={stretch}
          shrink={shrink}
        />
      ))}
      {children}
    </div>
  );
}
