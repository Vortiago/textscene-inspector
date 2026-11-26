/** What the 2D-world canvas mounts, rendered through @react-three/test-renderer. */
import { describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SelectionProvider } from '../contexts/SelectionContext';

// The real ControlCanvasLayer renders null here, so a visible stand-in makes
// its mount observable.
vi.mock('../controls/index.js', () => ({
  ControlCanvasLayer: () => <mesh name="native-controls-stub" />,
}));

// A stand-in dispatcher shows the edited root's `[editable]` paths that reach the nodes.
vi.mock('../NodeDispatcher.js', async () => {
  const { useInstanceOwners } = await import('../contexts/InstanceOwnersContext');
  const { useCanvasColorSpace } = await import('../canvasColorSpace');
  return {
    NodeDispatcher: () => (
      <>
        <mesh name={`editable:${useInstanceOwners()[0]!.editablePaths.join(',')}`} />
        <mesh name={`canvas-linear:${useCanvasColorSpace().isLinear}`} />
      </>
    ),
  };
});

// The test renderer's context binds no framebuffer, which the real frame render draws into.
vi.mock('./CanvasFrameRender.js', () => ({
  CanvasFrameRender: () => <mesh name="canvas-frame-render-stub" />,
}));

import { World2DContents } from './World2DContents';
import { StageViewStore } from './stageView';
import { withProject } from '../testing/ProjectFixture';
import { TiledUploadQueue } from '../tiledUpload/TiledUploadQueue';
import { r3fStateProbe } from '../testing/R3FStateProbe';
import { hasShadowPass } from '../testing/shadowPassMark';

const baseProps = {
  nodes: [],
  internalResources: [],
  externalResources: [],
  view: new StageViewStore({ pan: { x: 0, y: 0 }, zoom: 1 }),
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

describe('World2DContents edited root', () => {
  it('hands the scene `[editable]` paths to the nodes it dispatches', async () => {
    const rendered = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <World2DContents {...baseProps} editableInstances={['Door']} />
      </SelectionProvider>
    );
    expect(rendered.scene.findAllByProps({ name: 'editable:Door' })).toHaveLength(1);
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

describe('World2DContents canvas colour space', () => {
  const canvasIsLinearUnder = async (project: string | null) => {
    const ProjectFixture = withProject(project);
    const rendered = await ReactThreeTestRenderer.create(
      <ProjectFixture>
        <SelectionProvider>
          <World2DContents {...baseProps} />
        </SelectionProvider>
      </ProjectFixture>
    );
    return rendered.scene.findAllByProps({ name: 'canvas-linear:true' }).length === 1;
  };

  it('draws its items linear when the project turns hdr_2d on', async () => {
    await waitFor(async () =>
      expect(await canvasIsLinearUnder('[rendering]\nviewport/hdr_2d=true\n')).toBe(true)
    );
  });

  it('draws its items in sRGB by default', async () => {
    expect(await canvasIsLinearUnder(null)).toBe(false);
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

describe('World2DContents renderer', () => {
  it('installs the shadow pass, so a 3D SubViewport on the 2D canvas draws its shadows', async () => {
    const { Probe, state } = r3fStateProbe();

    await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <World2DContents {...baseProps} />
        <Probe />
      </SelectionProvider>
    );

    expect(hasShadowPass(state().gl)).toBe(true);
  });
});

describe('World2DContents camera', () => {
  it('moves the camera to each new stage view', async () => {
    const view = new StageViewStore({ pan: { x: 0, y: 0 }, zoom: 1 });
    const { Probe, state } = r3fStateProbe();
    await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <World2DContents {...baseProps} view={view} />
        <Probe />
      </SelectionProvider>
    );
    const restingX = state().camera.position.x;

    await ReactThreeTestRenderer.act(async () => view.set({ pan: { x: 40, y: 0 }, zoom: 2 }));

    expect(state().camera.zoom).toBe(2);
    expect(state().camera.position.x).toBe((restingX - 40) / 2);
  });
});
