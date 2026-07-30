/**
 * The DOM-raster publisher: a Control-only sub-viewport's target, produced by
 * rasterising its Control subtree instead of by a WebGL pass (ADR-0030,
 * ADR-0003 as amended).
 *
 * `<SubViewport>` deliberately publishes nothing for `viewportContentKind ===
 * 'dom'`: Controls are DOM, so that viewport has no WebGL source and its target
 * cannot come from `gl.render`. It cannot come from the on-screen overlay
 * either — `ControlDispatcher` stops at the viewport boundary, and in 3D mode no
 * overlay is mounted at all — so the subtree is rendered HERE, into an
 * off-screen host that exists only to be rasterised. That is why this component
 * lives outside the R3F canvas: it is DOM, and R3F's reconciler hosts three.js
 * objects, not elements.
 *
 * Three caller obligations of `rasterizeControlSubtree`, each measured in
 * `verify-raster.mjs` rather than reasoned about:
 *
 *  - **Size the HOST, not the raster.** `width`/`height` scale each axis of the
 *    output independently, so they stay unset and the host is built at the
 *    sub-viewport's `size`.
 *  - **Hide by moving off-screen.** Every computed property is inlined onto the
 *    rasteriser's clone, so `visibility: hidden`, `opacity: 0` and `clip-path`
 *    each rasterise ZERO opaque pixels — and return a blank canvas rather than
 *    null, so nothing would warn. At `left: -99999px` the same subtree
 *    rasterises 5366.
 *  - **Paint Godot's clear colour underneath** unless `transparent_bg`.
 *
 * COLOUR, and how this publisher is the mirror image of the WebGL one: Godot
 * draws a viewport's canvas AFTER that viewport's tonemap pass —
 * `RendererViewport::_draw_viewport` runs `_draw_3d` (which ends in
 * `_render_buffers_post_process_and_tonemap`) before its `render_canvas` loop —
 * so a Control target stores the canvas's own sRGB values with no curve, and
 * the curve applies exactly ONCE, on the consuming surface in the main
 * viewport's pass. Hence a plain `CanvasTexture` tagged `SRGBColorSpace`: no
 * `isXRRenderTarget`, no pre-tonemap. Measured on
 * `unit-sub-viewport-control-texture.tscn` through Godot 4.6.3 — a
 * Color(0.5, 0.5, 0.5) ColorRect reaches the quad as rgb(162), one FILMIC
 * application of the editor preview environment; a pre-tonemapped raster would
 * land near rgb(196).
 */

import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import * as THREE from 'three';

// The BARREL, not `ControlDispatcher.tsx` — its side-effect imports are what
// register the Control DOM components. Without them every Control resolves to
// `GenericControlFallback` and the whole subtree rasterises as nothing but the
// clear colour. The registry is lazy on purpose (`Canvas2DStage` loads the same
// barrel for the on-screen overlay), so this module is itself lazy-loaded, and
// only for a scene that actually has a Control-only sub-viewport.
import { ControlDispatcher } from '../../../r3f/controls/index.js';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext.js';
import { ControlParentProvider } from '../../../r3f/controls/ControlParentContext.js';
import { rasterizeControlSubtree } from '../../../r3f/controls/rasterizeControlSubtree.js';
import {
  useRegisterViewportTexture,
  type ViewportTextureEntry,
} from '../../../r3f/contexts/ViewportTextureContext.js';
import type { ControlRasterViewport } from './controlRasterViewports.js';

/**
 * Godot's `rendering/environment/defaults/default_clear_color`,
 * `Color(0.3, 0.3, 0.3)`, quantised by `Color::to_rgba32()` —
 * `Math::round(0.3 * 255) = 77`. An sRGB triple, painted straight into the
 * raster, because the raster IS sRGB (see the colour note above).
 */
export const GODOT_CLEAR_CSS = 'rgb(77, 77, 77)';

/**
 * What a viewport clears to behind its canvas:
 * `RendererViewport::_draw_viewport` — `Color bgcolor = p_viewport->transparent_bg
 * ? Color(0, 0, 0, 0) : RSG::texture_storage->get_default_clear_color();`.
 * `undefined` leaves the raster transparent, which is what `Color(0,0,0,0)`
 * produces on a surface that alpha-blends it.
 */
export function rasterBackgroundColor(transparentBg: boolean): string | undefined {
  return transparentBg ? undefined : GODOT_CLEAR_CSS;
}

export interface ControlRasterHostsProps {
  /**
   * The sub-viewports to rasterise, each carrying the resource scope its
   * Controls resolve in — passed in rather than derived here so the CHEAP walk
   * (`collectControlRasterViewports`) can decide, in the shell's own bundle,
   * whether to load this module at all. Explicit scope per ADR-0009's two-mount
   * rule: this is a third mount of the Control subtree, and an ambient provider
   * would hand a sub-scene's Controls the host scene's ids.
   */
  viewports: readonly ControlRasterViewport[];
}

/**
 * One off-screen host per Control-only sub-viewport in the scene.
 *
 * Mounted next to the viewport, not inside either workspace: nothing here is
 * ever seen directly — a viewport surface samples what these publish.
 */
export function ControlRasterHosts({ viewports }: ControlRasterHostsProps) {
  return (
    <>
      {viewports.map((viewport) => (
        <ControlRasterHost key={viewport.path} viewport={viewport} />
      ))}
    </>
  );
}

/**
 * Off-screen, so the browser lays the subtree out and shapes its text without
 * any of it reaching the screen. `overflow: hidden` is Godot's clip: a viewport
 * issues none, but its target is only `size` pixels, so content past the edge
 * was never rendered. `pointer-events: none` keeps a host that drifts on-screen
 * (a stylesheet accident) from eating clicks.
 */
function hostStyle(width: number, height: number): CSSProperties {
  return {
    position: 'fixed',
    left: -99999,
    top: 0,
    width,
    height,
    overflow: 'hidden',
    pointerEvents: 'none',
    // The overlay's own stack, so the raster shapes text exactly as the
    // on-screen overlay does rather than inheriting the app shell's font.
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  };
}

function ControlRasterHost({ viewport }: { viewport: ControlRasterViewport }) {
  const { path, node, transparentBg, internalResources, externalResources } = viewport;
  const { x: width, y: height } = viewport.size;
  const hostRef = useRef<HTMLDivElement>(null);
  const registerViewportTexture = useRegisterViewportTexture();
  // Memoised so a re-render cannot rewrite the host's own style attribute — the
  // MutationObserver below watches attributes, and a rewrite would schedule a
  // pointless redraw on every commit.
  const style = useMemo(() => hostStyle(width, height), [width, height]);

  // ONE canvas and ONE texture for the life of this host at this size: a redraw
  // flips `needsUpdate` instead of allocating a texture the consumer's material
  // would have to be re-pointed at.
  const surface = useMemo(
    () => createRasterSurface(width, height, transparentBg, node.name),
    [width, height, transparentBg, node.name]
  );
  useEffect(() => () => surface.texture.dispose(), [surface]);

  // Gates `readPixels`: a DOM consumer must be able to tell "no raster yet" from
  // "rasterised empty", exactly as the WebGL publisher's `hasRendered` does.
  const hasDrawn = useRef(false);
  useEffect(() => {
    hasDrawn.current = false;
  }, [surface]);

  const readPixels = useCallback((): ImageData | null => {
    if (!hasDrawn.current) return null;
    const context = surface.canvas.getContext('2d');
    if (!context) return null;
    try {
      return context.getImageData(0, 0, surface.canvas.width, surface.canvas.height);
    } catch {
      // A tainted canvas — "not ready" is the honest answer, never a blank image.
      return null;
    }
  }, [surface]);

  // Scalars in the dep list, not `viewport.size`: the walk rebuilds its result
  // objects on every cache tick, and a fresh entry would re-fire every
  // consumer's effect (`ViewportTextureProvider` keys its cleanup on identity).
  const entry = useMemo<ViewportTextureEntry>(
    () => ({ texture: surface.texture, size: { x: width, y: height }, readPixels }),
    [surface, width, height, readPixels]
  );

  useEffect(
    () => registerViewportTexture(path, entry),
    [registerViewportTexture, path, entry]
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let cancelled = false;
    let frame = 0;
    let drawing = false;
    let stale = false;

    const draw = async (): Promise<void> => {
      // Serialising + decoding an SVG is slow enough that two overlapping
      // passes would fight; the second is collapsed into one re-run.
      if (drawing) {
        stale = true;
        return;
      }
      drawing = true;
      try {
        // Text is the bulk of a Control raster, and an unloaded font shapes it
        // at fallback metrics. `fonts.ready` is already resolved on later
        // passes, so this costs nothing after the first.
        await host.ownerDocument.fonts?.ready?.catch?.(() => undefined);
        if (cancelled) return;
        const drawn = await rasterizeControlSubtree(host, {
          canvas: surface.canvas,
          backgroundColor: rasterBackgroundColor(transparentBg),
        });
        if (cancelled || !drawn) return;
        hasDrawn.current = true;
        surface.texture.needsUpdate = true;
      } finally {
        drawing = false;
        if (stale && !cancelled) {
          stale = false;
          schedule();
        }
      }
    };

    const schedule = (): void => {
      if (cancelled || frame) return;
      // One frame of slack so React's commit and the browser's layout are both
      // done — the rasteriser measures the host's border box and bails on a
      // zero-sized one.
      frame = requestAnimationFrame(() => {
        frame = 0;
        void draw();
      });
    };

    schedule();
    // The subtree keeps changing after mount: a StyleBox resolves, a
    // TextureRect's `src` becomes a data: URL, an instanced sub-scene lands.
    // Watching the DOM catches all of them without this component knowing which
    // resource each Control is waiting on. The raster CLONES the subtree, so a
    // pass never mutates what is observed and cannot feed itself.
    const observer = new MutationObserver(schedule);
    observer.observe(host, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [surface, transparentBg]);

  return (
    <div
      ref={hostRef}
      data-viewport-raster-host={path}
      aria-hidden
      style={style}
    >
      <SceneResourcesProvider
        internalResources={internalResources}
        externalResources={externalResources}
      >
        {/* The sub-viewport's rect IS the parent rect its root Controls anchor
            against — Godot lays a viewport's Controls out against `size`. */}
        <ControlParentProvider kind="free">
          {/* Deliberately NOT `showRoots`: that affordance forces the node you
              OPENED visible, and a Control inside a sub-viewport is not it.
              Godot does not draw a `visible = false` Control into the target,
              and the dispatcher already honours per-node visibility. */}
          <ControlDispatcher nodes={node.children} parentPath={path} />
        </ControlParentProvider>
      </SceneResourcesProvider>
    </div>
  );
}

/** The canvas + texture pair a host draws into for as long as its size holds. */
interface RasterSurface {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
}

/**
 * Pre-sized and pre-cleared, so the very first frame a consumer samples shows
 * Godot's clear colour rather than transparent black — which is exactly what an
 * unrendered viewport looks like in Godot too.
 *
 * `flipY` keeps three's default for a DOM source: a canvas is top-down and the
 * upload flips it, which puts row 0 at the top of the quad. (The WebGL
 * publisher's target needs no such flip — GL renders it bottom-up already.)
 */
function createRasterSurface(
  width: number,
  height: number,
  transparentBg: boolean,
  name: string
): RasterSurface {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const background = rasterBackgroundColor(transparentBg);
  const context = canvas.getContext('2d');
  if (context && background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.name = `${name}::raster`;
  // Godot's default `canvas_item_default_texture_filter` (1, LINEAR); the
  // sub-viewport's own filter enum is not reproduced, matching the WebGL path.
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return { canvas, texture };
}
