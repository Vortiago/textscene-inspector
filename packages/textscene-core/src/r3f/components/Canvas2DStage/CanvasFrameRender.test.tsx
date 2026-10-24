/**
 * The 2D canvas always draws through its frame, so row 0 of the target is the canvas top, and it
 * multisamples only when the project's `msaa_2d` asks (`scene_tree.cpp:2079-2080`).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import { waitFor } from '@testing-library/react';
import { CanvasFrameRender } from './CanvasFrameRender';
import { patchesContext } from '../../testing/patchesContext';
import { withProject } from '../../testing/ProjectFixture';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';

interface Probe {
  /** The store's reader: R3F mutates the render priority in place, so no selector sees it. */
  get: (() => { internal: { priority: number } }) | null;
  hasProject: boolean;
}

function StoreProbe({ probe }: { probe: Probe }) {
  probe.get = useThree((state) => state.get);
  probe.hasProject = useProjectSettings().settings !== null;
  return null;
}

/** SwiftShader's and lavapipe's list: 4 samples, and no other multisampled count. */
const FOUR_SAMPLES_ONLY = [4];

/** Lists `counts` as the samples every renderbuffer format supports on the test canvas's context. */
function listSampleCounts(counts: number[]) {
  return patchesContext((context) => {
    context.getInternalformatParameter = () => Int32Array.from(counts);
  });
}

/** R3F's render priority under `project`: above 0, a frame callback owns the render. */
async function renderPriorityIn(project: string | null) {
  const ProjectFixture = withProject(project);
  const probe: Probe = { get: null, hasProject: false };
  await ReactThreeTestRenderer.create(
    <ProjectFixture>
      <CanvasFrameRender />
      <StoreProbe probe={probe} />
    </ProjectFixture>,
    { beforeReturn: listSampleCounts(FOUR_SAMPLES_ONLY) }
  );
  if (project !== null) await waitFor(() => expect(probe.hasProject).toBe(true));
  return () => probe.get!().internal.priority;
}

describe('<CanvasFrameRender>', () => {
  it('owns the render when the project turns msaa_2d on', async () => {
    const priority = await renderPriorityIn('[rendering]\nanti_aliasing/quality/msaa_2d=2\n');
    expect(priority()).toBe(1);
  });

  it('owns the render with no project, drawing single-sampled', async () => {
    const priority = await renderPriorityIn(null);
    expect(priority()).toBe(1);
  });

  it('owns the render with msaa_2d off', async () => {
    const priority = await renderPriorityIn('[rendering]\nanti_aliasing/quality/msaa_2d=0\n');
    expect(priority()).toBe(1);
  });

  it('owns the render for 2X on a device whose lowest count is 4 (edge case)', async () => {
    const priority = await renderPriorityIn('[rendering]\nanti_aliasing/quality/msaa_2d=1\n');
    expect(priority()).toBe(1);
  });

  it('owns the render for an msaa_2d the setter refuses (edge case)', async () => {
    const priority = await renderPriorityIn('[rendering]\nanti_aliasing/quality/msaa_2d=7\n');
    expect(priority()).toBe(1);
  });
});
