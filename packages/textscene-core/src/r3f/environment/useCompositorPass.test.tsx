/**
 * Whether the compositor's tone pass mounts on a canvas, whether it carries glow, and how many
 * samples it takes. Godot runs the glow chain whenever the environment enables glow
 * (`renderer_scene_render_rd.cpp:575`, `:686`), blends in linear HDR before it tonemaps, and
 * resolves MSAA before the tonemap pass reads the buffer. A blended surface that loads late
 * still counts, and one a later click adds does not.
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
import { ResourceLoader } from '../../resources/ResourceLoader';
import { COMMIT_FRAMES_AFTER_SETTLE, ResourceLoaderContext } from '../../resources/ResourceLoaderContext';
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
    loader = new ResourceLoader(),
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
    <ResourceLoaderContext.Provider value={loader}>
      <Wrapper>
        <WorldWithAutoExposure>
          <Probe />
        </WorldWithAutoExposure>
      </Wrapper>
    </ResourceLoaderContext.Provider>,
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

  it('mounts no pass when glow is disabled and nothing else needs one', async () => {
    const { pass } = await mount(environmentSettingsOf({ glow_enabled: 'false' }));
    expect(pass()).toBeNull();
  });

  it('mounts a pass without glow for the adjustments alone', async () => {
    const { pass } = await mount(environmentSettingsOf({ adjustment_enabled: 'true' }));
    expect(pass()).toEqual({ glow: null, samples: 0, autoExposure: null });
  });

  it('mounts no pass for an enabled glow whose every level weight is zero (edge case)', async () => {
    const levels = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((level) => [`glow_levels/${level}`, '0.0']));
    const { pass } = await mount(environmentSettingsOf({ glow_enabled: 'true', ...levels }));
    expect(pass()).toBeNull();
  });

  it('mounts no pass on a canvas without a real GL context, even for glow (error path)', async () => {
    const { pass } = await mount(environmentSettingsOf({ glow_enabled: 'true' }), { context: null });
    expect(pass()).toBeNull();
  });
});

const AUTO_EXPOSURE: AutoExposure = { scale: 0.4, minLuminance: 0, maxLuminance: 1 };

describe('useCompositorPass for an auto exposure', () => {
  // Godot reduces the luminance whenever the camera attributes enable it (`renderer_scene_render_rd.cpp:551`).
  it('mounts a pass without glow for the auto exposure alone, and carries it', async () => {
    const { pass } = await mount(environmentSettingsOf({}), { autoExposure: AUTO_EXPOSURE });
    expect(pass()).toEqual({ glow: null, samples: 0, autoExposure: AUTO_EXPOSURE });
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
  it('mounts no pass when nothing blends and MSAA is off', async () => {
    const { pass } = await mount(null);
    expect(pass()).toBeNull();
  });

  it('mounts a multisampled pass without glow for MSAA alone', async () => {
    const Wrapper = withProject('[rendering]\nanti_aliasing/quality/msaa_3d=2\n');
    const { pass } = await mount(null, { Wrapper });
    await waitFor(() => expect(pass()).toEqual({ glow: null, samples: 4, autoExposure: null }));
  });

  it('mounts a pass without glow for a blended surface', async () => {
    const { mesh, blend } = switchableMesh();
    blend();
    const { renderer, pass } = await mount(null, { content: mesh });
    await advance(renderer, 1);
    expect(pass()).toEqual({ glow: null, samples: 0, autoExposure: null });
  });
});

describe('useCompositorPass over a loading scene', () => {
  it('finds a blended surface that loads many frames after the mount', async () => {
    const loader = new ResourceLoader();
    const release = loader.beginPending();
    const { mesh, blend } = switchableMesh();
    const { renderer, pass } = await mount(null, { loader, content: mesh });
    await advance(renderer, 100);
    expect(pass()).toBeNull();

    blend();
    release();
    await advance(renderer, 1);

    expect(pass()).not.toBeNull();
  });

  it('finds a blended surface that commits within the frames after the loader settles', async () => {
    const { mesh, blend } = switchableMesh();
    const { renderer, pass } = await mount(null, { content: mesh });
    await advance(renderer, COMMIT_FRAMES_AFTER_SETTLE - 1);

    blend();
    await advance(renderer, 1);

    expect(pass()).not.toBeNull();
  });

  it('ignores a blended surface added after the scan stops, such as a selection overlay', async () => {
    const { mesh, blend } = switchableMesh();
    const { renderer, pass } = await mount(null, { content: mesh });
    await advance(renderer, COMMIT_FRAMES_AFTER_SETTLE);

    blend();
    await advance(renderer, 3);

    expect(pass()).toBeNull();
  });

  it('scans again while a later load is pending', async () => {
    const loader = new ResourceLoader();
    const { mesh, blend } = switchableMesh();
    const { renderer, pass } = await mount(null, { loader, content: mesh });
    await advance(renderer, COMMIT_FRAMES_AFTER_SETTLE);

    const release = loader.beginPending();
    blend();
    await advance(renderer, 1);
    release();

    expect(pass()).not.toBeNull();
  });

  it('keeps the pass after the surface stops blending, so the pipeline never flips back', async () => {
    const { mesh, blend } = switchableMesh();
    const { renderer, pass } = await mount(null, { content: mesh });
    blend();
    await advance(renderer, 1);

    (mesh.material as THREE.Material).transparent = false;
    await advance(renderer, 3);

    expect(pass()).not.toBeNull();
  });
});
