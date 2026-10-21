/**
 * The two views of a sub-viewport target, as Godot's `R8G8B8A8_UNORM` storage with an `R8G8B8A8_SRGB`
 * view (`texture_storage.cpp:3593-3594`, `:3644-3647`): the plain view a canvas item samples
 * (`texture_storage.cpp:754`) and the decoding view a `source_color` sampler reads.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';

import { createCanvasTarget, createSceneTarget } from './offscreenViewport';
import { useTargetViews } from './targetViews';
import { holdsSrgbBytes } from '../../../r3f/srgbByteTextures';
import { CaptureRenderer } from '../../../r3f/testing/CaptureRenderer';

type TargetViews = ReturnType<typeof useTargetViews>;

function Probe({
  target,
  views,
}: {
  target: THREE.WebGLRenderTarget;
  views: { current: TargetViews | null };
}) {
  views.current = useTargetViews(target);
  return null;
}

/** The views of `target`, and a fill that reports the targets it rendered into. */
async function mount(target: THREE.WebGLRenderTarget) {
  const views: { current: TargetViews | null } = { current: null };
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  await ReactThreeTestRenderer.create(
    <>
      <Probe target={target} views={views} />
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
      views.current!.fill();
    } finally {
      Object.assign(gl, {
        setRenderTarget: original.set,
        getRenderTarget: original.get,
        render: original.render,
      });
    }
    return drawnInto;
  };
  return { views: views.current!, fill };
}

describe('useTargetViews', () => {
  it("serves a 3D-content target's own texture as its decoding view, which its storage decodes already", async () => {
    const target = createSceneTarget(8, 8, 'Probe');
    const { views } = await mount(target);
    expect(views.decoding.texture).toBe(target.texture);
  });

  it("serves a canvas target's own texture as its plain view, which holds the bytes", async () => {
    const target = createCanvasTarget(8, 8, 'Probe');
    const { views } = await mount(target);
    expect(views.plain.texture).toBe(target.texture);
  });

  it('stores the decoding copy of a canvas target in SRGB8_ALPHA8, which decodes each texel before the filter', async () => {
    const target = createCanvasTarget(8, 8, 'Probe');
    const { views } = await mount(target);
    expect(views.decoding.texture).not.toBe(target.texture);
    expect(views.decoding.texture.internalFormat).toBe('SRGB8_ALPHA8');
  });

  it('stores the plain copy of a 3D target in RGBA8 and marks it as sRGB bytes, which a canvas consumer filters raw', async () => {
    const target = createSceneTarget(8, 8, 'Probe');
    const { views } = await mount(target);
    expect(views.plain.texture).not.toBe(target.texture);
    expect(views.plain.texture.internalFormat).toBe('RGBA8');
    expect(holdsSrgbBytes(views.plain.texture)).toBe(true);
  });

  it('fills the decoding copy from the plain view while a consumer retains it', async () => {
    const { views, fill } = await mount(createCanvasTarget(8, 8, 'Probe'));
    views.decoding.retain();
    expect(fill().map((drawn) => drawn?.texture)).toEqual([views.decoding.texture]);
  });

  it('fills the plain copy of a 3D target while a consumer retains it', async () => {
    const { views, fill } = await mount(createSceneTarget(8, 8, 'Probe'));
    views.plain.retain();
    expect(fill().map((drawn) => drawn?.texture)).toEqual([views.plain.texture]);
  });

  it('fills nothing for the view that is the target itself, however many consumers retain it', async () => {
    const scene = await mount(createSceneTarget(8, 8, 'Probe'));
    scene.views.decoding.retain();
    expect(scene.fill()).toEqual([]);
    const canvas = await mount(createCanvasTarget(8, 8, 'Probe'));
    canvas.views.plain.retain();
    expect(canvas.fill()).toEqual([]);
  });

  it('fills nothing while no consumer retains a copy (edge case)', async () => {
    const { fill } = await mount(createCanvasTarget(8, 8, 'Probe'));
    expect(fill()).toEqual([]);
  });

  it('stops filling once the last consumer releases the copy', async () => {
    const { views, fill } = await mount(createCanvasTarget(8, 8, 'Probe'));
    const releaseFirst = views.decoding.retain();
    const releaseSecond = views.decoding.retain();
    releaseFirst();
    releaseFirst();
    expect(fill()).toHaveLength(1);
    releaseSecond();
    expect(fill()).toEqual([]);
  });
});
