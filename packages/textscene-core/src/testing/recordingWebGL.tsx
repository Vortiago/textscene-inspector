/**
 * A three renderer on the test renderer's stand-in WebGL context, which happy-dom lacks. The
 * stand-in creates no texture handles, so a recording gives each texture its own and counts the
 * texel writes, which shows what a material samples and what a render uploads.
 */

import { onTestFinished, vi } from 'vitest';
import type * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import ReactThreeTestRenderer from '@react-three/test-renderer';

/** The context calls that write texels into a texture. */
const TEXEL_WRITES = ['texImage2D', 'texSubImage2D', 'texStorage2D'] as const;

export interface TextureRecording {
  /** The texel writes since the recording started. */
  uploads(): number;
}

/** Gives each texture `renderer` creates from now on its own handle, and counts its texel writes. */
export function recordTextures(renderer: THREE.WebGLRenderer): TextureRecording {
  // three has required WebGL2 since r163.
  const context = renderer.getContext() as WebGL2RenderingContext;
  vi.spyOn(context, 'createTexture').mockImplementation(() => ({}) as WebGLTexture);
  const writes = TEXEL_WRITES.map((call) => vi.spyOn(context, call));
  return { uploads: () => writes.reduce((count, write) => count + write.mock.calls.length, 0) };
}

/** The handle three binds for a sampler that holds `texture`, uploading it first if it changed. */
export function boundHandle(renderer: THREE.WebGLRenderer, texture: THREE.Texture): unknown {
  const bind = vi.spyOn(renderer.state, 'bindTexture');
  renderer.initTexture(texture);
  const handle = bind.mock.calls[0]?.[1];
  bind.mockRestore();
  return handle;
}

/** Hands the renderer of the root it mounts in to `onRenderer`. */
export function RendererProbe({ onRenderer }: { onRenderer: (renderer: THREE.WebGLRenderer) => void }) {
  onRenderer(useThree((state) => state.gl));
  return null;
}

/** A recorded renderer on a test root of its own, unmounted when the test ends. */
export async function testRenderer(): Promise<{
  renderer: THREE.WebGLRenderer;
  recording: TextureRecording;
}> {
  let found: THREE.WebGLRenderer | undefined;
  const root = await ReactThreeTestRenderer.create(
    <RendererProbe onRenderer={(renderer) => (found = renderer)} />
  );
  onTestFinished(() => root.unmount());
  return { renderer: found!, recording: recordTextures(found!) };
}
