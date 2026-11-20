import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountScene, type ViewOptions } from './mountScene';
import { openScene } from '../scene/openScene';
import type { ResourceProvider } from '../resources/ResourceProvider';
import { PERFORMANCE_TESTIDS } from './frameProfile/performanceTestIds';
import type { ViewShow } from './viewShow/viewShow';

// A happy-dom render creates no WebGL context.
vi.mock('@react-three/fiber', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-three/fiber')>()),
  Canvas: () => <canvas />,
}));

const NO_FILES: ResourceProvider = { loadResource: async () => null };
const SCENE = `[gd_scene format=3]

[node name="Main" type="Node3D"]
`;

function sceneView(options: ViewOptions) {
  const host = document.createElement('div');
  document.body.append(host);
  return mountScene(host, openScene({ source: SCENE, provider: NO_FILES }), options);
}

const hasPerformancePanel = () =>
  document.querySelector(`[data-testid="${PERFORMANCE_TESTIDS.overlay}"]`) !== null;

afterEach(() => {
  document.body.replaceChildren();
});

describe('the show option of a mounted view', () => {
  it('draws no performance panel by default', async () => {
    const view = await act(async () => sceneView({ mode: '3D' }));

    expect(hasPerformancePanel()).toBe(false);
    view.dispose();
  });

  it('draws the performance panel over the view when the mount asks for it', async () => {
    const view = await act(async () => sceneView({ mode: '3D', show: { performance: true } }));

    expect(hasPerformancePanel()).toBe(true);
    view.dispose();
  });

  it('turns the performance panel off through update', async () => {
    const view = await act(async () => sceneView({ mode: '3D', show: { performance: true } }));

    await act(async () => view.update({ show: { performance: false } }));

    expect(hasPerformancePanel()).toBe(false);
    view.dispose();
  });

  it('keeps a key an update leaves out', async () => {
    const view = await act(async () => sceneView({ mode: '3D', show: { performance: true } }));

    await act(async () => view.update({ show: { grid: true } }));

    expect(hasPerformancePanel()).toBe(true);
    view.dispose();
  });

  it('keeps the show of a view across a mode switch', async () => {
    const view = await act(async () => sceneView({ mode: '3D', show: { performance: true } }));

    await act(async () => view.update({ mode: 'in-game' }));

    // The game stage loads on demand, so its panel lands with the stage's chunk.
    await vi.waitFor(() => expect(hasPerformancePanel()).toBe(true));
    view.dispose();
  });

  it('throws for a show key the view does not know', () => {
    expect(() => sceneView({ show: { gird: true } as Partial<ViewShow> })).toThrow(
      'expected a key of show, got "gird"'
    );
  });

  it('throws for a show value that is not a boolean, through update too', async () => {
    const view = await act(async () => sceneView({ mode: '3D' }));

    expect(() => view.update({ show: { gizmos: 'false' as unknown as boolean } })).toThrow(
      'expected show.gizmos to be a boolean, got "false"'
    );
    view.dispose();
  });
});
