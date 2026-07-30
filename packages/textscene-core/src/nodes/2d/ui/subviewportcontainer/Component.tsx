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
 * Content arrives on two arms, because a viewport target has two kinds of
 * source and the previewer draws them in different technologies:
 *
 *  - **Controls** render straight into the surface as DOM, which is both
 *    cheaper and sharper than going through pixels.
 *  - **2D-world and 3D** content has no DOM form at all. `<SubViewport>`
 *    renders it into an offscreen target and publishes
 *    `ViewportTextureEntry.readPixels`; the surface snapshots that into a
 *    `<canvas>` stacked underneath the Control arm. A viewport with neither
 *    (or one whose target has not rendered yet) keeps the correctly sized,
 *    cleared, empty surface rather than showing something wrong.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { ControlParentProvider, useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import { ControlDispatcher } from '../../../../r3f/controls/ControlDispatcher';
import { useViewportTexture } from '../../../../r3f/contexts/ViewportTextureContext';
import { useRegisterViewportRect } from '../../../../r3f/contexts/ViewportRectContext';
import { joinPath } from '../../../../utils/nodePath';
import type { TscnNode } from '../../../../parser/types';
import type { SubViewportProperties } from '../../../viewport/subviewport/types';
import { BLIT_ATTEMPTS, BLIT_INTERVAL_MS, encodeTargetPixels } from './viewportBlit';
import type { SubViewportContainerProperties } from './types';

/**
 * Godot's `rendering/environment/defaults/default_clear_color` — what an
 * opaque render target clears to. Measured off a Godot 4.6.3 render of a
 * stretching container whose content did not cover the whole target.
 */
const DEFAULT_CLEAR_COLOR = 'rgb(77, 77, 77)';

/**
 * Stretched to the surface's own box, which IS the drawn rect: Godot's
 * `draw_texture_rect(c->get_texture(), Rect2(Vector2(), …))` scales the target
 * to whichever rect `stretch` selected, so the surface's sizing rules apply to
 * the pixels without this element repeating any of them. Absolute so it takes
 * no part in the layout of the Control arm above it.
 */
const PIXELS_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
};

/**
 * The pixel arm of a surface: the sub-viewport's offscreen target, snapshotted
 * into a `<canvas>`.
 *
 * Nothing is painted until a snapshot actually arrives. `readPixels` returns
 * null while the target has not rendered — which is the state at mount, since
 * the offscreen pass runs on the R3F frame loop and the DOM overlay commits
 * first — and painting anything at all before then is what tearing would look
 * like here. An unpainted canvas is fully transparent, so the surface's clear
 * colour shows through and the first real frame replaces it in one go.
 *
 * `readPixels()` is a synchronous GPU stall, so the schedule is bounded and
 * one-shot rather than per-frame (`viewportBlit.ts`). It re-arms on a new
 * target (a resized sub-viewport, a remounted publisher) and on a fresh parse
 * handing this surface a new node object — a hot-reload edit inside the
 * sub-viewport keeps the same target, so the entry alone would not notice it.
 */
function ViewportPixels({ viewport, path }: { viewport: TscnNode; path: string }) {
  const entry = useViewportTexture(path);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readPixels = entry?.readPixels;
  const width = entry?.size.x ?? 0;
  const height = entry?.size.y ?? 0;

  useEffect(() => {
    if (!readPixels || width <= 0 || height <= 0) return undefined;
    let attempts = 0;

    const paint = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Null is "no frame yet", never "rendered empty" — leave the previous
      // paint (or the bare clear colour) standing and try again.
      const image = readPixels();
      if (!image) return;
      const context = canvas.getContext('2d');
      // No 2D context at all (happy-dom, a lost context): the surface stays on
      // its DOM arm, which is the same outcome as an unpublished target.
      if (!context) return;
      context.putImageData(encodeTargetPixels(image), 0, 0);
    };

    // The earliest moment the target can hold a frame is after the first
    // animation frame, which is also the R3F loop's own tick.
    const frame = requestAnimationFrame(paint);
    const timer = setInterval(() => {
      paint();
      if (++attempts >= BLIT_ATTEMPTS) clearInterval(timer);
    }, BLIT_INTERVAL_MS);

    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
    };
  }, [readPixels, width, height, viewport]);

  if (!entry) return null;
  return (
    <canvas
      ref={canvasRef}
      data-viewport-pixels="true"
      width={width}
      height={height}
      style={PIXELS_STYLE}
    />
  );
}

/**
 * Publish the rect a STRETCHING container forces onto its sub-viewport, so the
 * offscreen pass lays content out against the same number Godot does.
 *
 * `recalc_force_viewport_sizes` runs `set_size_force(get_size() / stretch_shrink)`
 * and returns early when `stretch` is off — so this measures only while it is
 * on, and publishes nothing otherwise. That asymmetry is also what keeps the
 * measurement from feeding back on itself: with `stretch` off the surface is
 * sized FROM the authored `size`, and measuring it to set the size would be a
 * loop; with it on the surface is sized by the container's own layout, which
 * the target has no influence over.
 *
 * The surface element already IS `get_size() / stretch_shrink`: the shrink
 * divides its percentage width and a `scale()` puts it back, and `offsetWidth`
 * reports the pre-transform box. `Math.round` because a render target is an
 * integer number of pixels and Godot's `Size2i` is too.
 */
function useForcedViewportRect(path: string, stretch: boolean) {
  const registerViewportRect = useRegisterViewportRect();
  const [element, setElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!element || !stretch) return undefined;
    let release: (() => void) | undefined;
    const publish = () => {
      const x = Math.max(1, Math.round(element.offsetWidth));
      const y = Math.max(1, Math.round(element.offsetHeight));
      release?.();
      release = registerViewportRect(path, { x, y });
    };
    publish();
    // happy-dom and any non-layout host have no ResizeObserver; the one-shot
    // measurement above still stands, which is all a test can observe anyway.
    if (typeof ResizeObserver === 'undefined') return () => release?.();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      release?.();
    };
  }, [element, stretch, path, registerViewportRect]);

  return setElement;
}

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
  const surfaceRef = useForcedViewportRect(path, stretch);

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
    <div
      ref={surfaceRef}
      data-viewport-surface="true"
      data-node-name={viewport.name}
      style={style}
    >
      {/* Under the Control arm: a mixed sub-viewport's Controls are the LAST
          canvas items Godot composites into the same target. */}
      <ViewportPixels viewport={viewport} path={path} />
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
