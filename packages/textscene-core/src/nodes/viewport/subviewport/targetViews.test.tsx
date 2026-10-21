/**
 * The two views of a sub-viewport target, as Godot's `R8G8B8A8_UNORM` storage with an `R8G8B8A8_SRGB`
 * view (`texture_storage.cpp:3593-3594`, `:3644-3647`): the plain view a canvas item samples
 * (`texture_storage.cpp:754`) and the decoding view a `source_color` sampler reads.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';

import { createCanvasTarget, createSceneTarget } from './offscreenViewport';
import { useTargetViews } from './targetViews';
import { holdsSrgbBytes } from '../../../r3f/srgbByteTextures';
import { CaptureRenderer } from '../../../r3f/testing/CaptureRenderer';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';

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
  const fill = async (): Promise<(THREE.WebGLRenderTarget | null)[]> => {
    const drawnInto: (THREE.WebGLRenderTarget | null)[] = [];
    await withStubbedGl(gl, { onRender: (bound) => drawnInto.push(bound) }, () => views.current!.fill());
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
    expect((await fill()).map((drawn) => drawn?.texture)).toEqual([views.decoding.texture]);
  });

  it('fills the plain copy of a 3D target while a consumer retains it', async () => {
    const { views, fill } = await mount(createSceneTarget(8, 8, 'Probe'));
    views.plain.retain();
    expect((await fill()).map((drawn) => drawn?.texture)).toEqual([views.plain.texture]);
  });

  it('fills nothing for the view that is the target itself, however many consumers retain it', async () => {
    const scene = await mount(createSceneTarget(8, 8, 'Probe'));
    scene.views.decoding.retain();
    expect(await scene.fill()).toEqual([]);
    const canvas = await mount(createCanvasTarget(8, 8, 'Probe'));
    canvas.views.plain.retain();
    expect(await canvas.fill()).toEqual([]);
  });

  it('fills nothing while no consumer retains a copy (edge case)', async () => {
    const { fill } = await mount(createCanvasTarget(8, 8, 'Probe'));
    expect(await fill()).toEqual([]);
  });

  describe('storage of a copy', () => {
    afterEach(() => vi.restoreAllMocks());

    it('is freed once the last consumer releases it and the task ends', async () => {
      const { views } = await mount(createCanvasTarget(8, 8, 'Probe'));
      const dispose = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose');
      const releaseFirst = views.decoding.retain();
      const releaseSecond = views.decoding.retain();
      releaseFirst();
      releaseSecond();
      await Promise.resolve();
      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('stays while a consumer retakes it in the same task as the release (edge case)', async () => {
      const { views, fill } = await mount(createCanvasTarget(8, 8, 'Probe'));
      const dispose = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose');
      views.decoding.retain()();
      views.decoding.retain();
      await Promise.resolve();
      expect(dispose).not.toHaveBeenCalled();
      expect(await fill()).toHaveLength(1);
    });
  });

  it('stops filling once the last consumer releases the copy', async () => {
    const { views, fill } = await mount(createCanvasTarget(8, 8, 'Probe'));
    const releaseFirst = views.decoding.retain();
    const releaseSecond = views.decoding.retain();
    releaseFirst();
    releaseFirst();
    expect(await fill()).toHaveLength(1);
    releaseSecond();
    expect(await fill()).toEqual([]);
  });
});
