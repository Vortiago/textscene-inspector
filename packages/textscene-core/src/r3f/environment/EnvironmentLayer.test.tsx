/**
 * The canvas's renderer draws the root viewport, so only the root world's Environment sets its tone
 * curve and mounts the compositor. A marker stands in for the compositor, which needs a real GL context.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { EnvironmentLayer } from './EnvironmentLayer';
import { WorldKindProvider, type WorldKind } from './WorldKindContext';
import { decodeEnvironment } from '../../resources/environment/decode';
import { createEnvironmentSettings } from '../../resources/environment/build';
import { DEFAULT_CLEAR_COLOR } from '../../godot/rendering/rendering';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { CaptureRenderer } from '../testing/CaptureRenderer';

vi.mock('./ToneMapLayer', () => ({
  ToneMapLayer: () => <group name="ToneMapLayer" />,
}));

const TONEMAP_CHUNK = 'tonemapping_pars_fragment';
const FILMIC = '2';

/** A renderer whose context reports attributes, so the 3D passes take it for a real GL context. */
function rendererWithGlContext(defaults: THREE.WebGLRendererParameters): THREE.WebGLRenderer {
  const gl = new THREE.WebGLRenderer(defaults);
  gl.getContext = () => ({ getContextAttributes: () => ({}) }) as unknown as WebGL2RenderingContext;
  return gl;
}

function settingsOf(properties: Record<string, string>) {
  return createEnvironmentSettings(decodeEnvironment(properties), DEFAULT_CLEAR_COLOR);
}

async function mountLayer(world: WorldKind, properties: Record<string, string>, hasGlContext = false) {
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <WorldKindProvider world={world}>
      <CaptureRenderer captured={captured} />
      <EnvironmentLayer
        settings={settingsOf(properties)}
        sky={null}
        resources={NO_RESOURCES}
        skyResources={NO_RESOURCES}
      />
    </WorldKindProvider>,
    hasGlContext ? { gl: rendererWithGlContext } : undefined
  );
  const compositors = renderer.scene.findAll((node) => node.props.name === 'ToneMapLayer').length;
  return { gl: captured.current!, compositors, unmount: () => renderer.unmount() };
}

describe('<EnvironmentLayer> in the root world', () => {
  it('mounts the compositor for a glowing Environment', async () => {
    const { compositors } = await mountLayer('root', { glow_enabled: 'true' }, true);
    expect(compositors).toBe(1);
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
