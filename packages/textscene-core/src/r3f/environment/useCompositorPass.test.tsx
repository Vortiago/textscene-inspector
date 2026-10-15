/**
 * Whether the compositor's tone pass mounts on a canvas, whether it carries glow, and how many
 * samples it takes. Godot runs the glow chain whenever the environment enables glow
 * (`renderer_scene_render_rd.cpp:575`, `:686`), blends in linear HDR before it tonemaps, and
 * resolves MSAA before the tonemap pass reads the buffer. A blended surface that loads late
 * still counts, and one a later click adds does not.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import { waitFor } from '@testing-library/react';
import { useCompositorPass, type CompositorPass } from './useCompositorPass';
import { decodeEnvironment } from '../../resources/environment/decode';
import { createEnvironmentSettings } from '../../resources/environment/build';
import type { EnvironmentSettings } from '../../resources/environment/types';
import { DEFAULT_CLEAR_COLOR } from '../../godot/rendering/rendering';
import { ResourceLoader } from '../../resources/ResourceLoader';
import { COMMIT_FRAMES_AFTER_SETTLE, ResourceLoaderContext } from '../../resources/ResourceLoaderContext';
import { withProject } from '../testing/ProjectFixture';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function settingsOf(properties: Record<string, string>): EnvironmentSettings {
  return createEnvironmentSettings(decodeEnvironment(properties), DEFAULT_CLEAR_COLOR);
}

/** A WebGL 2 context that reports attributes and lists 4 samples for every renderbuffer format. */
function glContext(): object {
  return {
    RENDERBUFFER: 0x8d41,
    SAMPLES: 0x80a9,
    RGBA16F: 0x881a,
    DEPTH_COMPONENT24: 0x81a6,
    getContextAttributes: () => ({}),
    isContextLost: () => false,
    getInternalformatParameter: () => Int32Array.from([4]),
  };
}

function rendererOn(context: object | null) {
  return (defaults: THREE.WebGLRendererParameters) => {
    const gl = new THREE.WebGLRenderer(defaults);
    if (context) gl.getContext = () => context as WebGL2RenderingContext;
    return gl;
  };
}

/** A mesh whose material the test turns blended, standing in for a texture that loads with alpha. */
function switchableMesh() {
  const material = new THREE.MeshBasicMaterial();
  return {
    mesh: new THREE.Mesh(new THREE.BufferGeometry(), material),
    blend: () => (material.transparent = true),
  };
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
  } = {}
): Promise<Mounted> {
  const seen: { pass: CompositorPass | null } = { pass: null };
  function Probe() {
    const scene = useThree((state) => state.scene);
    if (content.parent !== scene) scene.add(content);
    seen.pass = useCompositorPass(settings);
    return null;
  }
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderContext.Provider value={loader}>
      <Probe />
    </ResourceLoaderContext.Provider>,
    { gl: rendererOn(context) }
  );
  return { renderer, pass: () => seen.pass };
}

const advance = (renderer: Renderer, frames: number) =>
  ReactThreeTestRenderer.act(() => renderer.advanceFrames(frames, 0));

describe('useCompositorPass for an Environment', () => {
  it('carries glow when the environment enables it, with nothing emissive in the scene', async () => {
    const { pass } = await mount(settingsOf({ glow_enabled: 'true' }));
    expect(pass()?.glow).not.toBeNull();
  });

  it('mounts no pass when glow is disabled and nothing else needs one', async () => {
    const { pass } = await mount(settingsOf({ glow_enabled: 'false' }));
    expect(pass()).toBeNull();
  });

  it('mounts a pass without glow for the adjustments alone', async () => {
    const { pass } = await mount(settingsOf({ adjustment_enabled: 'true' }));
    expect(pass()).toEqual({ glow: null, samples: 0 });
  });

  it('mounts no pass for an enabled glow whose every level weight is zero (edge case)', async () => {
    const levels = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((level) => [`glow_levels/${level}`, '0.0']));
    const { pass } = await mount(settingsOf({ glow_enabled: 'true', ...levels }));
    expect(pass()).toBeNull();
  });

  it('mounts no pass on a canvas without a real GL context, even for glow (error path)', async () => {
    const { pass } = await mount(settingsOf({ glow_enabled: 'true' }), { context: null });
    expect(pass()).toBeNull();
  });
});

describe('useCompositorPass with no Environment', () => {
  it('mounts no pass when nothing blends and MSAA is off', async () => {
    const { pass } = await mount(null);
    expect(pass()).toBeNull();
  });

  it('mounts a multisampled pass without glow for MSAA alone', async () => {
    const ProjectFixture = withProject('[rendering]\nanti_aliasing/quality/msaa_3d=2\n');
    const seen: { pass: CompositorPass | null; hasProject: boolean } = { pass: null, hasProject: false };
    function Probe() {
      seen.hasProject = useProjectSettings().settings !== null;
      seen.pass = useCompositorPass(null);
      return null;
    }
    await ReactThreeTestRenderer.create(
      <ProjectFixture>
        <Probe />
      </ProjectFixture>,
      { gl: rendererOn(glContext()) }
    );
    await waitFor(() => expect(seen.hasProject).toBe(true));
    expect(seen.pass).toEqual({ glow: null, samples: 4 });
  });

  it('mounts a pass without glow for a blended surface', async () => {
    const { mesh, blend } = switchableMesh();
    blend();
    const { renderer, pass } = await mount(null, { content: mesh });
    await advance(renderer, 1);
    expect(pass()).toEqual({ glow: null, samples: 0 });
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
