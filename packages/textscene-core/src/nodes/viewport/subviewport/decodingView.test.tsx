/**
 * The decoding view of a sub-viewport target: Godot's `R8G8B8A8_SRGB` view of the same storage
 * (`texture_storage.cpp:3593-3594`, `:3644-3647`), which a `source_color` sampler reads.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';

import { createCanvasTarget, createSceneTarget } from './offscreenViewport';
import { useDecodingView, type PassDecodingView } from './decodingView';
import { CaptureRenderer } from '../../../r3f/testing/CaptureRenderer';

function Probe({
  target,
  view,
}: {
  target: THREE.WebGLRenderTarget;
  view: { current: PassDecodingView | null };
}) {
  view.current = useDecodingView(target);
  return null;
}

/** The decoding view of `target`, and a fill that reports the targets it rendered into. */
async function mount(target: THREE.WebGLRenderTarget) {
  const view: { current: PassDecodingView | null } = { current: null };
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  await ReactThreeTestRenderer.create(
    <>
      <Probe target={target} view={view} />
      <CaptureRenderer captured={captured} />
    </>
  );
  const gl = captured.current!;
  /** Runs one fill with the renderer stubbed, since the test context cannot draw. */
  const fill = (): (THREE.WebGLRenderTarget | null)[] => {
    const drawnInto: (THREE.WebGLRenderTarget | null)[] = [];
    let bound: THREE.WebGLRenderTarget | null = null;
    const original = { set: gl.setRenderTarget, get: gl.getRenderTarget, render: gl.render };
    gl.setRenderTarget = ((next: THREE.WebGLRenderTarget | null) => {
      bound = next;
    }) as typeof gl.setRenderTarget;
    gl.getRenderTarget = () => bound;
    gl.render = (() => drawnInto.push(bound)) as typeof gl.render;
    try {
      view.current!.fill();
    } finally {
      Object.assign(gl, {
        setRenderTarget: original.set,
        getRenderTarget: original.get,
        render: original.render,
      });
    }
    return drawnInto;
  };
  return { view: view.current!, fill };
}

describe('useDecodingView', () => {
  it("serves a 3D-content target's own texture, which its storage decodes already", async () => {
    const target = createSceneTarget(8, 8, 'Probe');
    const { view } = await mount(target);
    expect(view.texture).toBe(target.texture);
  });

  it('stores the copy of a canvas target in SRGB8_ALPHA8, which decodes each texel before the filter', async () => {
    const target = createCanvasTarget(8, 8, 'Probe');
    const { view } = await mount(target);
    expect(view.texture).not.toBe(target.texture);
    expect(view.texture.internalFormat).toBe('SRGB8_ALPHA8');
  });

  it('fills the copy from the plain view while a consumer retains it', async () => {
    const { view, fill } = await mount(createCanvasTarget(8, 8, 'Probe'));
    view.retain();
    expect(fill().map((drawn) => drawn?.texture)).toEqual([view.texture]);
  });

  it('fills nothing while no consumer retains the copy (edge case)', async () => {
    const { fill } = await mount(createCanvasTarget(8, 8, 'Probe'));
    expect(fill()).toEqual([]);
  });

  it('stops filling once the last consumer releases the copy', async () => {
    const { view, fill } = await mount(createCanvasTarget(8, 8, 'Probe'));
    const releaseFirst = view.retain();
    const releaseSecond = view.retain();
    releaseFirst();
    releaseFirst();
    expect(fill()).toHaveLength(1);
    releaseSecond();
    expect(fill()).toEqual([]);
  });
});
