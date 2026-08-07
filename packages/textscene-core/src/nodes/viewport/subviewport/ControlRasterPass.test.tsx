/**
 * `<ControlRasterPasses>` — the native (WebGL) render-to-texture publisher
 * for a Control-only sub-viewport. Replaces the DOM/SVG rasteriser
 * (`ControlRasterHost`, deleted) with the same offscreen-portal technique
 * `<SubViewport>`'s own 3D/2D pass uses, so every viewport kind now publishes
 * a texture consumers sample directly — no CPU round trip, no `readPixels`.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

// `gui/common/snap_controls_to_pixels` is the ROOT window's setting; the
// Controls this pass rasterises live in a SubViewport, which never gets it.
const projectSettingsMock = vi.hoisted(() => ({
  settings: null as Record<string, string> | null,
  viewportSize: { width: 1152, height: 648 },
  themeScale: 1,
}));

vi.mock('../../../r3f/contexts/ProjectSettingsContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../r3f/contexts/ProjectSettingsContext')>();
  return { ...actual, useProjectSettings: () => projectSettingsMock };
});

import { TscnParser } from '../../../parser/TscnParser';
import type { TscnScene } from '../../../parser/types';
import {
  ViewportTextureProvider,
  useViewportTexture,
  type ViewportTextureEntry,
} from '../../../r3f/contexts/ViewportTextureContext';
import {
  ViewportPassProvider,
  ViewportPassOrchestrator,
} from '../../../r3f/contexts/ViewportPassRegistryContext';
import { collectControlRasterViewports } from './controlRasterViewports';
import { ControlRasterPasses } from './ControlRasterPass';

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

function walk(scene: TscnScene) {
  return collectControlRasterViewports(
    scene.nodes,
    { getCached: () => undefined },
    { internalResources: scene.internalResources, externalResources: scene.externalResources }
  );
}

/** Reports every entry the registry resolves at `path`, in order. */
function Watch({ path, seen }: { path: string; seen: (ViewportTextureEntry | null)[] }) {
  seen.push(useViewportTexture(path));
  return null;
}

/** Captures the canvas renderer so a test can observe the offscreen pass. */
function GlSpy({ captured }: { captured: { current: THREE.WebGLRenderer | null } }) {
  captured.current = useThree((state) => state.gl);
  return null;
}

/**
 * Runs one frame with the renderer's target/render entry points stubbed out,
 * recording every non-null bind — mirrors
 * `Component.publish.test.tsx`'s own `advanceFrameWithStubbedGl`: the test
 * renderer's fake WebGL context cannot service a real bind or draw.
 */
async function advanceFrameWithStubbedGl(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>,
  gl: THREE.WebGLRenderer,
  onBind?: (target: THREE.WebGLRenderTarget | null) => void
): Promise<void> {
  const originalSet = gl.setRenderTarget;
  const originalRender = gl.render;
  gl.setRenderTarget = ((target: THREE.WebGLRenderTarget | null) => {
    onBind?.(target);
  }) as typeof gl.setRenderTarget;
  gl.render = (() => undefined) as typeof gl.render;
  try {
    await renderer.advanceFrames(1, 16);
  } finally {
    gl.setRenderTarget = originalSet;
    gl.render = originalRender;
  }
}

async function mount(scene: TscnScene, seen: (ViewportTextureEntry | null)[] = [], path = 'Root/SubViewport') {
  const renderer = await ReactThreeTestRenderer.create(
    <ViewportTextureProvider>
      <ViewportPassProvider>
        <ControlRasterPasses viewports={walk(scene)} />
        <Watch path={path} seen={seen} />
        <ViewportPassOrchestrator />
      </ViewportPassProvider>
    </ViewportTextureProvider>
  );
  return { renderer, seen };
}

describe('<ControlRasterPasses>', () => {
  it('publishes a target at the sub-viewport path, sized to its `size`', async () => {
    const seen: (ViewportTextureEntry | null)[] = [];
    await mount(parse(GUI_SCENE), seen);
    const entry = seen.at(-1);
    expect(entry).not.toBeNull();
    expect(entry!.size).toEqual({ x: 320, y: 240 });
    expect(entry!.texture.isTexture).toBe(true);
  });

  /**
   * The mirror-image colour contract of the 3D/2D pass's `createOffscreenTarget`
   * (see `ControlRasterPass.tsx`'s own module doc): Godot draws a viewport's
   * canvas items AFTER its tonemap pass, so this target holds ordinary sRGB
   * values with no curve of its own and no `isXRRenderTarget` pre-tonemap tag.
   */
  it('publishes a target tagged sRGB, without the 3D/2D pass\'s isXRRenderTarget tag', async () => {
    const seen: (ViewportTextureEntry | null)[] = [];
    await mount(parse(GUI_SCENE), seen);
    const texture = seen.at(-1)!.texture;
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    const target = seen.at(-1)!.texture as unknown as { isXRRenderTarget?: boolean };
    expect(target.isXRRenderTarget).not.toBe(true);
  });

  it('renders without a tonemap curve — Controls are never tonemapped, on-screen or off', async () => {
    const capturedGl: { current: THREE.WebGLRenderer | null } = { current: null };
    const renderer = await ReactThreeTestRenderer.create(
      <ViewportTextureProvider>
        <ViewportPassProvider>
          <ControlRasterPasses viewports={walk(parse(GUI_SCENE))} />
          <GlSpy captured={capturedGl} />
          <ViewportPassOrchestrator />
        </ViewportPassProvider>
      </ViewportTextureProvider>
    );
    const gl = capturedGl.current!;
    gl.toneMapping = THREE.CustomToneMapping;
    let seenAtBind: THREE.ToneMapping | null = null;
    await advanceFrameWithStubbedGl(renderer, gl, (target) => {
      if (seenAtBind === null && target !== null) seenAtBind = gl.toneMapping;
    });
    expect(seenAtBind).toBe(THREE.NoToneMapping);
    // Restored after the pass, exactly like the 3D/2D pass restores its own.
    expect(gl.toneMapping).toBe(THREE.CustomToneMapping);
  });

  /**
   * `scene/main/viewport.h` initialises `snap_controls_to_pixels` to `true` on
   * every Viewport, and `main/main.cpp` hands the project setting to
   * `sml->get_root()` alone — so a project that opts out leaves a
   * SubViewport's own Controls snapped.
   *
   * Measured through Godot 4.6.3 on
   * `scenes/fixtures/subviewport-snap-off/unit-subviewport-snap-off.tscn`
   * (root window reporting `is_snap_controls_to_pixels_enabled() == false`,
   * its SubViewport reporting `true`): a four-deep chain of 0.5 offsets draws
   * its leaf at (102, 62) in the root window and at (104, 64) inside the
   * sub-viewport.
   */
  it('snaps the rasterised Controls even when the project opts out', async () => {
    projectSettingsMock.settings = { 'gui/common/snap_controls_to_pixels': 'false' };
    try {
      const capturedGl: { current: THREE.WebGLRenderer | null } = { current: null };
      const scene = parse(`[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="SubViewport" type="SubViewport" parent="."]
size = Vector2i(320, 240)

[node name="Bar" type="ColorRect" parent="SubViewport"]
anchors_preset = 0
offset_left = 100.5
offset_top = 60.5
offset_right = 140.5
offset_bottom = 100.5
`);
      const renderer = await ReactThreeTestRenderer.create(
        <ViewportTextureProvider>
          <ViewportPassProvider>
            <ControlRasterPasses viewports={walk(scene)} />
            <GlSpy captured={capturedGl} />
            <ViewportPassOrchestrator />
          </ViewportPassProvider>
        </ViewportTextureProvider>
      );

      // The walker mounts into a DETACHED portal scene, which never appears in
      // the test renderer's own tree — the pass hands it to `gl.render`, so
      // that call is where a test can reach it.
      const gl = capturedGl.current!;
      let portalScene: THREE.Object3D | null = null;
      const originalSet = gl.setRenderTarget;
      const originalRender = gl.render;
      gl.setRenderTarget = (() => undefined) as typeof gl.setRenderTarget;
      gl.render = ((rendered: THREE.Object3D) => {
        portalScene ??= rendered;
      }) as typeof gl.render;
      try {
        await renderer.advanceFrames(1, 16);
      } finally {
        gl.setRenderTarget = originalSet;
        gl.render = originalRender;
      }

      let group: THREE.Object3D | undefined;
      portalScene?.traverse((o) => {
        if (o.name === 'ColorRect:Bar') group = o;
      });

      expect(group?.position.x).toBeCloseTo(101);
      expect(group?.position.y).toBeCloseTo(-61);
    } finally {
      projectSettingsMock.settings = null;
    }
  });

  it('unregisters on unmount, so a removed sub-viewport stops resolving', async () => {
    const seen: (ViewportTextureEntry | null)[] = [];
    const { renderer } = await mount(parse(GUI_SCENE), seen);
    expect(seen.at(-1)).not.toBeNull();
    await renderer.update(
      <ViewportTextureProvider>
        <ViewportPassProvider>
          <Watch path="Root/SubViewport" seen={seen} />
          <ViewportPassOrchestrator />
        </ViewportPassProvider>
      </ViewportTextureProvider>
    );
    expect(seen.at(-1)).toBeNull();
  });
});
