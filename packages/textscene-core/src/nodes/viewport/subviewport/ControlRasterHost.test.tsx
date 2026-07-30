/**
 * The publishing half of the Control-raster path.
 *
 * happy-dom has neither layout nor a rasteriser, so `rasterizeControlSubtree`
 * can only ever return null here — every PIXEL assertion lives in
 * `scripts/showcase/verify-raster.mjs` (ADR-0024). What is decidable without
 * pixels is asserted here: the registry entry's shape and identity stability,
 * the colour-space answer, the measured host-hiding contract, and the
 * mount/unmount lifecycle.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';

import { TscnParser } from '../../../parser/TscnParser';
import type { TscnScene } from '../../../parser/types';
import {
  ViewportTextureProvider,
  useViewportTexture,
  type ViewportTextureEntry,
} from '../../../r3f/contexts/ViewportTextureContext';
import { collectControlRasterViewports } from './controlRasterViewports';
import { ControlRasterHosts, rasterBackgroundColor, GODOT_CLEAR_CSS } from './ControlRasterHost';
import '../../../r3f/nodes/index';

const GUI_SCENE = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="SubViewport" type="SubViewport" parent="."]
size = Vector2i(320, 240)

[node name="Panel" type="Panel" parent="SubViewport"]
anchors_preset = 0
offset_right = 320.0
offset_bottom = 240.0
`;

function parse(source: string): TscnScene {
  return new TscnParser().parse(source);
}

/** Reports every entry the registry resolves at `path`, in order. */
function Watch({ path, seen }: { path: string; seen: (ViewportTextureEntry | null)[] }) {
  seen.push(useViewportTexture(path));
  return null;
}

/** A FRESH walk result, as the shell produces on every live-tree tick. */
function walk(scene: TscnScene) {
  return collectControlRasterViewports(
    scene.nodes,
    { getCached: () => undefined },
    { internalResources: scene.internalResources, externalResources: scene.externalResources }
  );
}

function mount(scene: TscnScene, seen: (ViewportTextureEntry | null)[] = [], path = 'Root/SubViewport') {
  const tree = (viewports: ReturnType<typeof walk>) => (
    <ViewportTextureProvider>
      <ControlRasterHosts viewports={viewports} />
      <Watch path={path} seen={seen} />
    </ViewportTextureProvider>
  );
  const ui = tree(walk(scene));
  return { seen, ...render(ui), ui, tree };
}

describe('ControlRasterHosts', () => {
  it('publishes a target at the sub-viewport path, sized to its `size`', () => {
    const seen: (ViewportTextureEntry | null)[] = [];
    mount(parse(GUI_SCENE), seen);
    const entry = seen.at(-1);
    expect(entry).not.toBeNull();
    expect(entry!.size).toEqual({ x: 320, y: 240 });
    expect(typeof entry!.readPixels).toBe('function');
  });

  /**
   * The tonemap answer, pinned as a type + a colour space.
   *
   * Godot draws a viewport's canvas AFTER that viewport's tonemap pass —
   * `RendererViewport::_draw_viewport` runs `_draw_3d` (which ends in
   * `_render_buffers_post_process_and_tonemap`) before its `render_canvas`
   * loop — so a Control-only target stores the canvas's own sRGB values with
   * NO curve applied, and the curve runs exactly once: on the consuming
   * surface, in the main viewport's pass. Measured through Godot 4.6.3 on
   * `unit-sub-viewport-control-texture.tscn`: a Color(0.5, 0.5, 0.5) ColorRect
   * reaches the quad as rgb(162) — one FILMIC application of the editor preview
   * environment. Tonemapping the raster too would land it near rgb(196).
   *
   * So this publisher is the OPPOSITE of the WebGL one: no `isXRRenderTarget`,
   * no pre-tonemap, and an sRGB tag so the sample decodes to linear before the
   * one curve the main pass applies.
   */
  it('publishes a CanvasTexture tagged sRGB — untonemapped, decoded once on the surface', () => {
    const seen: (ViewportTextureEntry | null)[] = [];
    mount(parse(GUI_SCENE), seen);
    const texture = seen.at(-1)!.texture;
    expect((texture as THREE.CanvasTexture).isCanvasTexture).toBe(true);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('mounts the Control subtree through the dispatcher inside the host', () => {
    const { container } = mount(parse(GUI_SCENE));
    const host = container.querySelector('[data-viewport-raster-host]');
    expect(host).not.toBeNull();
    expect(host!.getAttribute('data-viewport-raster-host')).toBe('Root/SubViewport');
    expect(host!.querySelector('[data-control-type="Panel"]')).not.toBeNull();
  });

  /**
   * The measured host-hiding contract (`verify-raster.mjs`, suite A): every
   * computed property is inlined onto the rasteriser's clone, so
   * `visibility: hidden`, `opacity: 0` and `clip-path` each rasterise ZERO
   * opaque pixels — and return a BLANK canvas rather than null, so nothing
   * would warn. Moving the host off-screen is the only hiding that survives.
   */
  it('hides the host by moving it off-screen, never by visibility/opacity/clip-path', () => {
    const { container } = mount(parse(GUI_SCENE));
    const host = container.querySelector('[data-viewport-raster-host]') as HTMLElement;
    expect(host.style.position).toBe('fixed');
    expect(parseFloat(host.style.left)).toBeLessThan(-9999);
    expect(host.style.width).toBe('320px');
    expect(host.style.height).toBe('240px');
    expect(host.style.visibility).toBe('');
    expect(host.style.opacity).toBe('');
    expect(host.style.clipPath).toBe('');
    expect(host.style.display).not.toBe('none');
  });

  /**
   * The live-tree tick rebuilds the walk's result objects wholesale, so a
   * publisher keyed on those objects would hand the registry a NEW entry each
   * time — and `ViewportTextureProvider` compares entries by identity, so every
   * consumer's effect would re-fire and every material re-point. Re-rendering
   * with a FRESH walk is the shape that actually happens; `rerender(ui)` alone
   * would pass even if the dep list were wrong.
   */
  it('keeps ONE entry identity across a fresh walk, so consumer effects do not re-fire', () => {
    const scene = parse(GUI_SCENE);
    const seen: (ViewportTextureEntry | null)[] = [];
    const { rerender, tree } = mount(scene, seen);
    const first = seen.at(-1);
    const refreshed = walk(scene);
    expect(refreshed[0]).not.toBe(undefined);
    rerender(tree(refreshed));
    expect(seen.at(-1)).toBe(first);
  });

  it('unregisters and disposes on unmount', () => {
    const seen: (ViewportTextureEntry | null)[] = [];
    const { unmount } = mount(parse(GUI_SCENE), seen);
    const texture = seen.at(-1)!.texture;
    let disposed = false;
    texture.addEventListener('dispose', () => {
      disposed = true;
    });
    unmount();
    expect(disposed).toBe(true);
  });

  it('mounts no host for a sub-viewport the WebGL publisher owns', () => {
    const scene = parse(`[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="SubViewport" type="SubViewport" parent="."]

[node name="Box" type="MeshInstance3D" parent="SubViewport"]
`);
    const { container, seen } = mount(scene);
    expect(container.querySelector('[data-viewport-raster-host]')).toBeNull();
    expect(seen.at(-1)).toBeNull();
  });
});

describe('rasterBackgroundColor', () => {
  /**
   * `RendererViewport::_draw_viewport`:
   * `Color bgcolor = p_viewport->transparent_bg ? Color(0, 0, 0, 0) :
   * RSG::texture_storage->get_default_clear_color();` — and the default is
   * `Color(0.3, 0.3, 0.3)`, quantised by `Color::to_rgba32()` to 77.
   */
  it('paints Godot default clear colour behind an opaque sub-viewport', () => {
    expect(rasterBackgroundColor(false)).toBe(GODOT_CLEAR_CSS);
    expect(GODOT_CLEAR_CSS).toBe('rgb(77, 77, 77)');
  });

  it('leaves a transparent_bg sub-viewport transparent', () => {
    expect(rasterBackgroundColor(true)).toBeUndefined();
  });
});
