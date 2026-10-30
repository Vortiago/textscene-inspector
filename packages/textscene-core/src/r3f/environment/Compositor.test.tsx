/**
 * The root canvas draws every 3D frame through Godot's tonemap pass (ADR-0061): the scene into the
 * half-float world buffer, then the tonemap effect onto the canvas. It tonemaps with the Environment
 * and the auto exposure of the root world, and Godot runs the glow chain whenever the Environment
 * enables glow (`renderer_scene_render_rd.cpp:575`, `:686`).
 */
import { describe, expect, it } from 'vitest';
import { Fragment, type ComponentType, type ReactNode } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import { waitFor } from '@testing-library/react';
import { Compositor } from './Compositor';
import { WorldToneMapProvider } from './worldToneMap';
import { usePublishCameraAttributes } from './worldExposure';
import { environmentSettingsOf } from '../../resources/environment/testing/environmentSettings';
import type { EnvironmentSettings } from '../../resources/environment/types';
import type { AutoExposure } from '../../resources/cameraattributes/types';
import { LUMINANCE_UNIFORM } from '../../resources/environment/godotLuminance';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { withProject } from '../testing/ProjectFixture';
import { withStubbedGl } from '../testing/stubbedGl';
import { CaptureRenderer } from '../testing/CaptureRenderer';
import { InWorld } from '../testing/InWorld';
import { DEPTH_COMPONENT24, fakeWebGL2Context, rendererOver, RGBA16F } from '../testing/fakeWebGL2Context';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** One `render` of a frame: the target bound, what it drew, and whether the render cleared first. */
interface Draw {
  bound: THREE.WebGLRenderTarget | null;
  scene: THREE.Object3D;
  autoClear: boolean;
}

interface MountOptions {
  settings?: EnvironmentSettings | null;
  autoExposure?: AutoExposure | null;
  content?: THREE.Object3D;
  Wrapper?: ComponentType<{ children: ReactNode }>;
  context?: object | null;
}

function PublishedAutoExposure({ autoExposure }: { autoExposure: AutoExposure | null }) {
  usePublishCameraAttributes({ status: 'resolved', attributes: { exposureMultiplier: 1, autoExposure } });
  return null;
}

function Content({ object }: { object: THREE.Object3D }) {
  const scene = useThree((state) => state.scene);
  if (object.parent !== scene) scene.add(object);
  return null;
}

/** Mounts the compositor in a root world, and answers the draws of each next frame. */
async function mount({
  settings = null,
  autoExposure = null,
  content = new THREE.Object3D(),
  Wrapper = Fragment,
  context = null,
}: MountOptions = {}): Promise<{ renderer: Renderer; nextFrame: () => Promise<Draw[]> }> {
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <Wrapper>
      <CaptureRenderer captured={captured} />
      <InWorld>
        <PublishedAutoExposure autoExposure={autoExposure} />
        <WorldToneMapProvider settings={settings} resources={NO_RESOURCES}>
          <Content object={content} />
          <Compositor />
        </WorldToneMapProvider>
      </InWorld>
    </Wrapper>,
    { gl: rendererOver(context) }
  );
  const nextFrame = async () => {
    const draws: Draw[] = [];
    await withStubbedGl(
      captured.current!,
      { onRender: (bound, scene) => draws.push({ bound, scene, autoClear: captured.current!.autoClear }) },
      () => renderer.advanceFrames(1, 16)
    );
    return draws;
  };
  return { renderer, nextFrame };
}

function namesOf(draws: Draw[]): (string | null)[] {
  return draws.map(({ bound }) => bound?.texture.name ?? null);
}

/**
 * Whether the tonemap effect, which the frame's last draw writes onto the canvas, names `name`. The
 * effect pass prefixes each name of an effect's shader and capitalises it, so case is ignored.
 */
function canvasShaderNames(draws: Draw[], name: string): boolean {
  const quad = draws.at(-1)?.scene.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  return quad.material.fragmentShader.toLowerCase().includes(name.toLowerCase());
}

const GLOW_LEVEL_0 = 'GodotGlow.Level0';
const AUTO_EXPOSURE: AutoExposure = { scale: 0.4, minLuminance: 0, maxLuminance: 1 };

describe('<Compositor> on the root canvas', () => {
  it('draws the scene into the half-float world buffer, then tonemaps it onto the canvas', async () => {
    const { renderer, nextFrame } = await mount();
    const draws = await nextFrame();

    expect(draws[0]?.bound?.texture.name).toBe('Canvas::world');
    expect(draws[0]?.bound?.texture.type).toBe(THREE.HalfFloatType);
    expect(draws[0]?.scene).toBe(renderer.scene.instance);
    expect(draws.at(-1)?.bound).toBeNull();
  });

  it('resizes the world buffer in place when the canvas resizes', async () => {
    const setSize: { current: ((width: number, height: number) => void) | null } = { current: null };
    function CaptureSetSize({ children }: { children: ReactNode }) {
      setSize.current = useThree((state) => state.setSize);
      return children;
    }
    const { nextFrame } = await mount({ Wrapper: CaptureSetSize });
    const before = (await nextFrame())[0]?.bound;
    await ReactThreeTestRenderer.act(async () => setSize.current!(64, 32));
    const after = (await nextFrame())[0]?.bound;

    expect(after).toBe(before);
    expect([after?.width, after?.height]).toEqual([64, 32]);
  });

  it("clears the world buffer in the scene's own render", async () => {
    const { nextFrame } = await mount();
    const draws = await nextFrame();

    expect(draws[0]?.autoClear).toBe(true);
  });

  // A blended draw anywhere, even off-screen, must not move the rest of the frame by a level.
  it('draws a scene with a blended surface through the same buffer', async () => {
    const blended = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ transparent: true })
    );
    const { nextFrame } = await mount({ content: blended });

    expect(namesOf(await nextFrame())).toEqual(['Canvas::world', null]);
  });

  it('multisamples the world buffer at the msaa_3d samples', async () => {
    const { nextFrame } = await mount({
      Wrapper: withProject('[rendering]\nanti_aliasing/quality/msaa_3d=2\n'),
      context: fakeWebGL2Context({ counts: { [RGBA16F]: [4], [DEPTH_COMPONENT24]: [4] } }),
    });

    await waitFor(async () => expect((await nextFrame())[0]?.bound?.samples).toBe(4));
  });

  /** Godot dithers in its tonemap pass (`renderer_scene_render_rd.cpp:784-797`). */
  it('dithers under use_debanding', async () => {
    const { nextFrame } = await mount({
      Wrapper: withProject('[rendering]\nanti_aliasing/quality/use_debanding=true\n'),
    });

    await waitFor(async () => expect(canvasShaderNames(await nextFrame(), 'godotDither')).toBe(true));
  });
});

describe('<Compositor> glow', () => {
  it('runs the glow chain when the Environment enables glow, with nothing emissive in the scene', async () => {
    const { nextFrame } = await mount({ settings: environmentSettingsOf({ glow_enabled: 'true' }) });

    expect(namesOf(await nextFrame())).toContain(GLOW_LEVEL_0);
  });

  it('runs no glow chain when glow is disabled', async () => {
    const { nextFrame } = await mount({ settings: environmentSettingsOf({ glow_enabled: 'false' }) });

    expect(namesOf(await nextFrame())).toEqual(['Canvas::world', null]);
  });

  it('runs no glow chain for an enabled glow whose every level weight is zero (edge case)', async () => {
    const levels = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((level) => [`glow_levels/${level}`, '0.0']));
    const { nextFrame } = await mount({
      settings: environmentSettingsOf({ glow_enabled: 'true', ...levels }),
    });

    expect(namesOf(await nextFrame())).not.toContain(GLOW_LEVEL_0);
  });
});

describe('<Compositor> auto exposure', () => {
  // Godot reduces the luminance whenever the camera attributes enable it (`renderer_scene_render_rd.cpp:551`).
  it('reads the luminance of the world for an auto exposure, with no Environment', async () => {
    const { nextFrame } = await mount({ autoExposure: AUTO_EXPOSURE });

    expect(canvasShaderNames(await nextFrame(), LUMINANCE_UNIFORM)).toBe(true);
  });

  it('reads no luminance without one', async () => {
    const { nextFrame } = await mount();

    expect(canvasShaderNames(await nextFrame(), LUMINANCE_UNIFORM)).toBe(false);
  });
});
