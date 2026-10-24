/** What the 2D-world canvas mounts, rendered through @react-three/test-renderer. */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { ViewportActionsProvider } from '../../contexts/ViewportActionsContext';
import { viewportActionsProbe } from '../../testing/ViewportActionsProbe';

// The real ControlCanvasLayer renders null here, so a visible stand-in makes
// its mount observable.
vi.mock('../../controls/index.js', () => ({
  ControlCanvasLayer: () => <mesh name="native-controls-stub" />,
}));

// The test renderer's context binds no framebuffer, which the real frame render draws into.
vi.mock('./CanvasFrameRender.js', () => ({
  CanvasFrameRender: () => <mesh name="canvas-frame-render-stub" />,
}));

import { World2DContents } from './World2DContents';
import { TiledUploadQueue } from '../../tiledUpload/TiledUploadQueue';

const baseProps = {
  nodes: [],
  internalResources: [],
  externalResources: [],
  pan: { x: 0, y: 0 },
  zoom: 1,
};

describe('World2DContents native-controls mount seam', () => {
  it('lazily mounts ControlCanvasLayer (from the controls barrel) as a sibling after NodeDispatcher', async () => {
    const rendered = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <World2DContents {...baseProps} />
      </SelectionProvider>
    );
    expect(rendered.scene.findAllByProps({ name: 'native-controls-stub' })).toHaveLength(1);
  });
});

describe('World2DContents canvas frame', () => {
  it("mounts the canvas frame render, which copies the y-down camera's rows upright", async () => {
    const rendered = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <World2DContents {...baseProps} />
      </SelectionProvider>
    );
    expect(rendered.scene.findAllByProps({ name: 'canvas-frame-render-stub' })).toHaveLength(1);
  });
});

describe('World2DContents tiled uploads', () => {
  it('drives a tiled upload queue every frame, so large textures upload in bands', async () => {
    const tick = vi.spyOn(TiledUploadQueue.prototype, 'tick');
    const rendered = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <World2DContents {...baseProps} />
      </SelectionProvider>
    );
    tick.mockClear();
    await rendered.advanceFrames(2, 16);

    expect(tick).toHaveBeenCalledTimes(2);
    tick.mockRestore();
  });
});

describe('World2DContents screenshot', () => {
  it('registers the 2D view for the toolbar Screenshot and the host capture', async () => {
    const { Probe, actions } = viewportActionsProbe();
    await ReactThreeTestRenderer.create(
      <ViewportActionsProvider>
        <SelectionProvider>
          <Probe />
          <World2DContents {...baseProps} />
        </SelectionProvider>
      </ViewportActionsProvider>
    );

    expect(actions().hasScreenshotHandler()).toBe(true);
  });
});
