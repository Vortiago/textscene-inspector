/**
 * What the compositor's tone pass carries on a 3D canvas: glow, samples, auto exposure and
 * debanding. The pass mounts whatever the scene draws (ADR-0061). Godot runs the glow chain whenever
 * the environment enables glow (`renderer_scene_render_rd.cpp:575`, `:686`).
 */
import { describe, expect, it } from 'vitest';
import { Fragment, type ComponentType, type ReactNode } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import { waitFor } from '@testing-library/react';
import { useCompositorPass, type CompositorPass } from './useCompositorPass';
import { environmentSettingsOf } from '../../resources/environment/testing/environmentSettings';
import type { EnvironmentSettings } from '../../resources/environment/types';
import type { AutoExposure } from '../../resources/cameraattributes/types';
import { usePublishCameraAttributes, WorldExposureScope } from './worldExposure';
import { withProject } from '../testing/ProjectFixture';
import { DEPTH_COMPONENT24, fakeWebGL2Context, rendererOver, RGBA16F } from '../testing/fakeWebGL2Context';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** A device that lists 4 samples for the half-float scene buffer and its depth. */
const glContext = () => fakeWebGL2Context({ counts: { [RGBA16F]: [4], [DEPTH_COMPONENT24]: [4] } });

/** A mesh whose material the test turns blended, standing in for a texture that loads with alpha. */
function switchableMesh() {
  const material = new THREE.MeshBasicMaterial();
  return {
    mesh: new THREE.Mesh(new THREE.BufferGeometry(), material),
    blend: () => (material.transparent = true),
  };
}

function PublishedAutoExposure({ autoExposure }: { autoExposure: AutoExposure | null }) {
  usePublishCameraAttributes({ status: 'resolved', attributes: { exposureMultiplier: 1, autoExposure } });
  return null;
}

interface Mounted {
  renderer: Renderer;
  pass: () => CompositorPass | null;
}

async function mount(
  settings: EnvironmentSettings | null,
  {
    context = glContext() as object | null,
    content = new THREE.Object3D(),
    Wrapper = Fragment as ComponentType<{ children: ReactNode }>,
    autoExposure = null as AutoExposure | null,
  } = {}
): Promise<Mounted> {
  const seen: { pass: CompositorPass | null } = { pass: null };
  function Probe() {
    const scene = useThree((state) => state.scene);
    if (content.parent !== scene) scene.add(content);
    seen.pass = useCompositorPass(settings);
    return null;
  }
  /** The world's attributes, which the hook reads its auto exposure from. */
  function WorldWithAutoExposure({ children }: { children: ReactNode }) {
    return (
      <WorldExposureScope>
        <PublishedAutoExposure autoExposure={autoExposure} />
        {children}
      </WorldExposureScope>
    );
  }
  const renderer = await ReactThreeTestRenderer.create(
    <Wrapper>
      <WorldWithAutoExposure>
        <Probe />
      </WorldWithAutoExposure>
    </Wrapper>,
    { gl: rendererOver(context) }
  );
  return { renderer, pass: () => seen.pass };
}

const advance = (renderer: Renderer, frames: number) =>
  ReactThreeTestRenderer.act(() => renderer.advanceFrames(frames, 0));

describe('useCompositorPass for an Environment', () => {
  it('carries glow when the environment enables it, with nothing emissive in the scene', async () => {
    const { pass } = await mount(environmentSettingsOf({ glow_enabled: 'true' }));
    expect(pass()?.glow).not.toBeNull();
  });

  it('mounts a pass without glow when glow is disabled', async () => {
    const { pass } = await mount(environmentSettingsOf({ glow_enabled: 'false' }));
    expect(pass()).toEqual({ glow: null, samples: 0, autoExposure: null, usesDebanding: false });
  });

  it('mounts a pass without glow for an enabled glow whose every level weight is zero (edge case)', async () => {
    const levels = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((level) => [`glow_levels/${level}`, '0.0']));
    const { pass } = await mount(environmentSettingsOf({ glow_enabled: 'true', ...levels }));
    expect(pass()?.glow).toBeNull();
  });

  it('mounts no pass on a canvas without a real GL context, even for glow (error path)', async () => {
    const { pass } = await mount(environmentSettingsOf({ glow_enabled: 'true' }), { context: null });
    expect(pass()).toBeNull();
  });
});

const AUTO_EXPOSURE: AutoExposure = { scale: 0.4, minLuminance: 0, maxLuminance: 1 };

describe('useCompositorPass for an auto exposure', () => {
  // Godot reduces the luminance whenever the camera attributes enable it (`renderer_scene_render_rd.cpp:551`).
  it('carries the auto exposure', async () => {
    const { pass } = await mount(environmentSettingsOf({}), { autoExposure: AUTO_EXPOSURE });
    expect(pass()).toEqual({ glow: null, samples: 0, autoExposure: AUTO_EXPOSURE, usesDebanding: false });
  });

  it('mounts a pass for the auto exposure with no Environment', async () => {
    const { pass } = await mount(null, { autoExposure: AUTO_EXPOSURE });
    expect(pass()?.autoExposure).toBe(AUTO_EXPOSURE);
  });

  it('carries it with the glow', async () => {
    const { pass } = await mount(environmentSettingsOf({ glow_enabled: 'true' }), {
      autoExposure: AUTO_EXPOSURE,
    });
    expect([pass()?.glow, pass()?.autoExposure]).toEqual([expect.anything(), AUTO_EXPOSURE]);
  });

  it('mounts no pass on a canvas without a real GL context (error path)', async () => {
    const { pass } = await mount(null, { autoExposure: AUTO_EXPOSURE, context: null });
    expect(pass()).toBeNull();
  });
});

describe('useCompositorPass with no Environment', () => {
  it("mounts a pass with Godot's defaults when nothing else asks for one", async () => {
    const { pass } = await mount(null);
    expect(pass()).toEqual({ glow: null, samples: 0, autoExposure: null, usesDebanding: false });
  });

  it('carries the msaa_3d samples', async () => {
    const Wrapper = withProject('[rendering]\nanti_aliasing/quality/msaa_3d=2\n');
    const { pass } = await mount(null, { Wrapper });
    await waitFor(() =>
      expect(pass()).toEqual({ glow: null, samples: 4, autoExposure: null, usesDebanding: false })
    );
  });

  /** Godot dithers in its tonemap pass (`renderer_scene_render_rd.cpp:784-797`), which three's curve lacks. */
  it('carries use_debanding', async () => {
    const Wrapper = withProject('[rendering]\nanti_aliasing/quality/use_debanding=true\n');
    const { pass } = await mount(null, { Wrapper });
    await waitFor(() =>
      expect(pass()).toEqual({ glow: null, samples: 0, autoExposure: null, usesDebanding: true })
    );
  });
});

describe('useCompositorPass over a blended surface', () => {
  // A blended draw anywhere, even off-screen, must not move the rest of the frame by a level.
  it('mounts the same pass with and without a blended surface in the scene', async () => {
    const { mesh, blend } = switchableMesh();
    const { renderer, pass } = await mount(null, { content: mesh });
    await advance(renderer, 1);
    const opaque = pass();

    blend();
    await advance(renderer, 1);

    expect([opaque, pass()]).toEqual([expect.anything(), opaque]);
  });
});
