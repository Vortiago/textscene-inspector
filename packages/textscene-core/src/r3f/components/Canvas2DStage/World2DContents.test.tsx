/** What the 2D-world canvas mounts, rendered through @react-three/test-renderer. */
import { describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SelectionProvider } from '../../contexts/SelectionContext';

// The real ControlCanvasLayer renders null here, so a visible stand-in makes
// its mount observable.
vi.mock('../../controls/index.js', () => ({
  ControlCanvasLayer: () => <mesh name="native-controls-stub" />,
}));

// A stand-in dispatcher shows the edited root's `[editable]` paths that reach the nodes.
vi.mock('../../NodeDispatcher.js', async () => {
  const { useInstanceOwners } = await import('../../contexts/InstanceOwnersContext');
  const { useCanvasColorSpace } = await import('../../canvasColorSpace');
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
import type { RootViewportPixels, World2DCamera } from './world2DCamera';
import { withProject } from '../../testing/ProjectFixture';
import { TiledUploadQueue } from '../../tiledUpload/TiledUploadQueue';
import { r3fStateProbe } from '../../testing/R3FStateProbe';
import { hasShadowPass } from '../../testing/shadowPassMark';

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

describe('World2DContents camera rig', () => {
  it("gives the camera the project's viewport size, which the screen built-ins count", async () => {
    await expectRootViewport('[display]\nwindow/size/viewport_width=640\nwindow/size/viewport_height=360\n', {
      targetSize: { x: 640, y: 360 },
      pixelsPerCanvasPixel: { x: 1, y: 1 },
    });
  });

  it('gives the camera the window override and the stretch of a canvas_items window', async () => {
    await expectRootViewport(
      '[display]\nwindow/size/viewport_width=640\nwindow/size/viewport_height=360\n' +
        'window/size/window_width_override=1280\nwindow/size/window_height_override=720\n' +
        'window/stretch/mode="canvas_items"\n',
      { targetSize: { x: 1280, y: 720 }, pixelsPerCanvasPixel: { x: 2, y: 2 } }
    );
  });

  it('gives the camera the window override unstretched for a window that does not stretch', async () => {
    await expectRootViewport(
      '[display]\nwindow/size/viewport_width=640\nwindow/size/viewport_height=360\n' +
        'window/size/window_width_override=1280\nwindow/size/window_height_override=720\n',
      { targetSize: { x: 1280, y: 720 }, pixelsPerCanvasPixel: { x: 1, y: 1 } }
    );
  });

  it('gives the camera the design size for a viewport-mode window', async () => {
    await expectRootViewport(
      '[display]\nwindow/size/viewport_width=640\nwindow/size/viewport_height=360\n' +
        'window/size/window_width_override=1280\nwindow/size/window_height_override=720\n' +
        'window/stretch/mode="viewport"\n',
      { targetSize: { x: 640, y: 360 }, pixelsPerCanvasPixel: { x: 1, y: 1 } }
    );
  });
});

/** Waits for the camera rig to give the camera `expected` for a project of `projectText`. */
async function expectRootViewport(projectText: string, expected: RootViewportPixels): Promise<void> {
  const ProjectFixture = withProject(projectText);
  const { Probe, state } = r3fStateProbe();
  await ReactThreeTestRenderer.create(
    <ProjectFixture>
      <SelectionProvider>
        <World2DContents {...baseProps} />
        <Probe />
      </SelectionProvider>
    </ProjectFixture>
  );
  await waitFor(() => expect((state().camera as World2DCamera).rootViewport).toEqual(expected));
}
