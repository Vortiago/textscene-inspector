import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useOffscreenTarget } from './useOffscreenTarget';
import { fakeWebGL2Context, rendererOver } from '../../../r3f/testing/fakeWebGL2Context';

/** A device that lists 8 and 4 samples for RGBA8 and depth, and 4 alone for SRGB8_ALPHA8. */
const context = fakeWebGL2Context({ RGBA8: [8, 4], SRGB8_ALPHA8: [4], DEPTH_COMPONENT24: [8, 4] });

type Options = Parameters<typeof useOffscreenTarget>[4];

/** Mounts the hook over `context` and answers each target it returns, and the renderer. */
async function mountTarget(width: number, options?: Options) {
  const targets: THREE.WebGLRenderTarget[] = [];
  function Probe({ width }: { width: number }) {
    targets.push(useOffscreenTarget(width, 16, 'Viewport', 8, options));
    return null;
  }
  const renderer = await ReactThreeTestRenderer.create(<Probe width={width} />, {
    gl: rendererOver(context),
  });
  return { targets, rerender: (next: number) => renderer.update(<Probe width={next} />) };
}

describe('useOffscreenTarget', () => {
  it('takes the samples the device lists for a linear 8-bit target', async () => {
    const { targets } = await mountTarget(16);
    expect(targets.at(-1)!.samples).toBe(8);
  });

  it('takes the samples the device lists for SRGB8_ALPHA8 under an sRGB tag', async () => {
    const { targets } = await mountTarget(16, { colorSpace: THREE.SRGBColorSpace, preTonemapped: false });
    expect(targets.at(-1)!.samples).toBe(4);
    expect(targets.at(-1)!.texture.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('disposes the target it replaces when the size changes (edge case)', async () => {
    const { targets, rerender } = await mountTarget(16);
    const first = targets.at(-1)!;
    let disposed = false;
    first.addEventListener('dispose', () => {
      disposed = true;
    });
    await rerender(32);
    expect(targets.at(-1)).not.toBe(first);
    expect(disposed).toBe(true);
  });
});
