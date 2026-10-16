/**
 * The canvas's renderer draws the root viewport, so only the root world's Environment sets its tone
 * curve and mounts the compositor. A marker stands in for the compositor, which needs a real GL context.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { EnvironmentLayer } from './EnvironmentLayer';
import { WorldKindProvider, type WorldKind } from './WorldKindContext';
import { environmentSettingsOf } from '../../resources/environment/testing/environmentSettings';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { CaptureRenderer } from '../testing/CaptureRenderer';
import { fakeWebGL2Context, rendererOver } from '../testing/fakeWebGL2Context';

vi.mock('./Compositor', () => ({
  Compositor: () => <group name="Compositor" />,
}));

const TONEMAP_CHUNK = 'tonemapping_pars_fragment';
const FILMIC = '2';

type CapturedRenderer = { current: THREE.WebGLRenderer | null };

function layer(world: WorldKind, properties: Record<string, string>, captured: CapturedRenderer) {
  return (
    <WorldKindProvider world={world}>
      <CaptureRenderer captured={captured} />
      <EnvironmentLayer
        settings={environmentSettingsOf(properties)}
        sky={null}
        resources={NO_RESOURCES}
        skyResources={NO_RESOURCES}
      />
    </WorldKindProvider>
  );
}

async function mountLayer(world: WorldKind, properties: Record<string, string>, hasGlContext = false) {
  const captured: CapturedRenderer = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    layer(world, properties, captured),
    hasGlContext ? { gl: rendererOver(fakeWebGL2Context()) } : undefined
  );
  const compositors = renderer.scene.findAll((node) => node.props.name === 'Compositor').length;
  const scene = renderer.scene.instance as THREE.Scene;
  return { gl: captured.current!, scene, compositors, unmount: () => renderer.unmount() };
}

describe('<EnvironmentLayer> in the root world', () => {
  it('mounts the compositor for a glowing Environment', async () => {
    const { compositors } = await mountLayer('root', { glow_enabled: 'true' }, true);
    expect(compositors).toBe(1);
  });

  it("leaves the renderer's mapping to the compositor, but installs the curve for a shared-world pass", async () => {
    const chunkBefore = THREE.ShaderChunk[TONEMAP_CHUNK];
    const { gl, unmount } = await mountLayer('root', { tonemap_mode: FILMIC, glow_enabled: 'true' }, true);
    expect(gl.toneMapping).not.toBe(THREE.CustomToneMapping);
    expect(THREE.ShaderChunk[TONEMAP_CHUNK]).not.toBe(chunkBefore);
    await unmount();
  });

  it("installs the Environment's curve on the renderer", async () => {
    const chunkBefore = THREE.ShaderChunk[TONEMAP_CHUNK];
    const { gl, unmount } = await mountLayer('root', { tonemap_mode: FILMIC });
    expect(gl.toneMapping).toBe(THREE.CustomToneMapping);
    expect(THREE.ShaderChunk[TONEMAP_CHUNK]).not.toBe(chunkBefore);
    await unmount();
    expect(THREE.ShaderChunk[TONEMAP_CHUNK]).toBe(chunkBefore);
  });
});

describe('<EnvironmentLayer> background', () => {
  it('draws a colour background as a texture, so the tone curve and its exposure reach it', async () => {
    // Godot tonemaps the clear colour with the frame (`tonemap.glsl:868-898`). three's clear skips the curve.
    const { scene } = await mountLayer('root', {
      background_mode: '1',
      background_color: 'Color(0.2, 0.3, 0.4, 1)',
      tonemap_exposure: '2.0',
    });
    expect((scene.background as THREE.DataTexture | null)?.isDataTexture).toBe(true);
  });

  it('builds a new colour background for a new curve, so three recompiles its background material', async () => {
    const captured: CapturedRenderer = { current: null };
    const renderer = await ReactThreeTestRenderer.create(layer('root', { background_mode: '1' }, captured));
    const scene = renderer.scene.instance as THREE.Scene;
    const linear = scene.background;

    await renderer.update(layer('root', { background_mode: '1', tonemap_mode: FILMIC }, captured));

    expect(scene.background).not.toBe(linear);
    await renderer.unmount();
  });

  it('restores the background it found on unmount', async () => {
    const { scene, unmount } = await mountLayer('root', { background_mode: '1' });
    await unmount();
    expect(scene.background).toBeNull();
  });
});

describe('<EnvironmentLayer> in a sub-viewport world', () => {
  it('mounts no compositor, which would draw to the canvas, not the sub-viewport target', async () => {
    const { compositors } = await mountLayer('subViewport', { glow_enabled: 'true' }, true);
    expect(compositors).toBe(0);
  });

  it("leaves the renderer's curve to the root world (edge case)", async () => {
    const chunkBefore = THREE.ShaderChunk[TONEMAP_CHUNK];
    const { gl } = await mountLayer('subViewport', { tonemap_mode: FILMIC });
    expect(gl.toneMapping).not.toBe(THREE.CustomToneMapping);
    expect(THREE.ShaderChunk[TONEMAP_CHUNK]).toBe(chunkBefore);
  });
});
