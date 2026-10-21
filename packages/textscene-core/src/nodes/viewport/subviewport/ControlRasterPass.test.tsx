/**
 * `<ControlRasterPasses>`: the native (WebGL) render-to-texture publisher for a
 * Control-only sub-viewport, publishing a texture consumers sample directly.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';

// `gui/common/snap_controls_to_pixels` is the root window's setting. The
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
import { MAX_TEXTURE_EXTENT } from '../../../r3f/webglLimits.js';
import { CaptureRenderer } from '../../../r3f/testing/CaptureRenderer';
import { advanceFrameWithStubbedGl, withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { holdsSrgbBytes } from '../../../r3f/srgbByteTextures';

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

async function mount(
  scene: TscnScene,
  seen: (ViewportTextureEntry | null)[] = [],
  path = 'Root/SubViewport'
) {
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <ViewportTextureProvider>
      <ViewportPassProvider>
        <ControlRasterPasses viewports={walk(scene)} />
        <Watch path={path} seen={seen} />
        <CaptureRenderer captured={captured} />
        <ViewportPassOrchestrator />
      </ViewportPassProvider>
    </ViewportTextureProvider>
  );
  return { renderer, seen, gl: captured.current! };
}

describe('<ControlRasterPasses>', () => {
  it('publishes a target at the sub-viewport path, sized to its `size`', async () => {
    const seen: (ViewportTextureEntry | null)[] = [];
    await mount(parse(GUI_SCENE), seen);
    const entry = seen.at(-1);
    expect(entry).not.toBeNull();
    expect(entry!.size).toEqual({ x: 320, y: 240 });
    expect(entry!.plain.texture.isTexture).toBe(true);
  });

  it('caps a size Godot opens but WebGL cannot allocate', async () => {
    const seen: (ViewportTextureEntry | null)[] = [];
    await mount(parse(GUI_SCENE.replace('Vector2i(320, 240)', 'Vector2i(2000000000, 1)')), seen);
    expect(seen.at(-1)!.size).toEqual({ x: MAX_TEXTURE_EXTENT, y: 2 });
  });

  /**
   * Controls are canvas items, which Godot writes as sRGB numbers into an `R8G8B8A8_UNORM` target
   * (`renderer_canvas_render_rd.cpp:671,729`), so a consumer filters the bytes raw.
   */
  it('publishes a plain view that holds sRGB bytes', async () => {
    const seen: (ViewportTextureEntry | null)[] = [];
    await mount(parse(GUI_SCENE), seen);
    const texture = seen.at(-1)!.plain.texture;
    expect(texture.internalFormat).toBe('RGBA8');
    expect(holdsSrgbBytes(texture)).toBe(true);
  });

  it('fills the decoding view after its pass while a consumer retains it', async () => {
    const { renderer, seen, gl } = await mount(parse(GUI_SCENE));
    const { plain, decoding } = seen.at(-1)!;
    decoding.retain();
    const bound: (THREE.Texture | undefined)[] = [];
    await advanceFrameWithStubbedGl(renderer, gl, (target) => {
      if (target) bound.push(target.texture);
    });
    expect(bound).toEqual([plain.texture, decoding.texture]);
  });

  it('renders without a tonemap curve — Controls are never tonemapped, on-screen or off', async () => {
    const capturedGl: { current: THREE.WebGLRenderer | null } = { current: null };
    const renderer = await ReactThreeTestRenderer.create(
      <ViewportTextureProvider>
        <ViewportPassProvider>
          <ControlRasterPasses viewports={walk(parse(GUI_SCENE))} />
          <CaptureRenderer captured={capturedGl} />
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
    // Restored after the pass, as the 3D/2D pass restores its own.
    expect(gl.toneMapping).toBe(THREE.CustomToneMapping);
  });

  /**
   * `scene/main/viewport.h` sets `snap_controls_to_pixels` true on every Viewport,
   * and `main/main.cpp` hands the project setting to the root alone. Measured on
   * `scenes/fixtures/subviewport-snap-off/unit-subviewport-snap-off.tscn`: a four-deep
   * chain of 0.5 offsets draws its leaf at (102, 62) in the root, (104, 64) inside.
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
            <CaptureRenderer captured={capturedGl} />
            <ViewportPassOrchestrator />
          </ViewportPassProvider>
        </ViewportTextureProvider>
      );

      // The walker mounts into a detached portal scene, outside the test
      // renderer's tree. The pass hands it to `gl.render`, where a test reaches it.
      const gl = capturedGl.current!;
      // Held on an object rather than in a `let`: a local assigned only from
      // inside a callback stays narrowed to its initialiser, so `portalScene`
      // would read as `null` at every use below.
      const captured: { portalScene: THREE.Object3D | null } = { portalScene: null };
      await withStubbedGl(
        gl,
        {
          onRender: (_, rendered) => {
            captured.portalScene ??= rendered;
          },
        },
        () => renderer.advanceFrames(1, 16)
      );

      let group: THREE.Object3D | undefined;
      captured.portalScene?.traverse((o) => {
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
