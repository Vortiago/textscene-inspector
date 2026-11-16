/**
 * The probe holder tells its scene's probes how much is still on its way, so none bakes a capture
 * that a later load changes. A scene font is on its way until its metrics settle, or a probe bakes
 * the text in the bundled default font.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { fontWork } from '../controls/native/text/settledChannel';
import { textureWork } from '../../resources/textures/textureWork';
import { useSceneProbes } from './useSceneProbes';
import { ViewportDescriptionProvider } from '../viewportRender/viewportDescriptionContext';
import { rootViewportDescription } from '../viewportRender/viewportDescription';

const updates = vi.hoisted(() => [] as number[]);
const viewports = vi.hoisted(() => [] as unknown[]);

vi.mock('./sceneProbes', () => ({
  SceneProbes: class {
    update(pendingResources: number, _clear: unknown, viewport: unknown): boolean {
      updates.push(pendingResources);
      viewports.push(viewport);
      return false;
    }
    dispose(): void {}
  },
}));

function Holder() {
  useSceneProbes();
  return null;
}

async function pendingSeenInOneFrame(): Promise<number> {
  const renderer = await ReactThreeTestRenderer.create(<Holder />);
  updates.length = 0;
  await renderer.advanceFrames(1, 16);
  const seen = updates.at(-1);
  await renderer.unmount();
  return seen ?? Number.NaN;
}

const ends: Array<() => void> = [];
afterEach(() => {
  ends.splice(0).forEach((end) => end());
});

describe('useSceneProbes', () => {
  it('reports nothing pending once no work is in flight', async () => {
    expect(await pendingSeenInOneFrame()).toBe(0);
  });

  it('reports a scene font load as pending, so a probe does not bake the fallback text', async () => {
    ends.push(fontWork.begin());

    expect(await pendingSeenInOneFrame()).toBe(1);
  });

  it('reports a texture build as pending', async () => {
    ends.push(textureWork.begin());

    expect(await pendingSeenInOneFrame()).toBe(1);
  });
});

describe('useSceneProbes in a SubViewport', () => {
  it('captures with the description of the viewport that draws the scene', async () => {
    const own = { ...rootViewportDescription(null), mipmapBias: 1.5 };
    const renderer = await ReactThreeTestRenderer.create(
      <ViewportDescriptionProvider description={own}>
        <Holder />
      </ViewportDescriptionProvider>
    );
    viewports.length = 0;
    await renderer.advanceFrames(1, 16);
    await renderer.unmount();

    expect(viewports.at(-1)).toBe(own);
  });
});
