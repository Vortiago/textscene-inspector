import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TscnCanvas } from './TscnCanvas';
import { openScene } from '../scene/openScene';
import type { ResourceProvider } from '../resources/ResourceProvider';
import type { View } from './mountScene';

// No WebGL here, so the view stays pending: what the ref answers before its first frame is what this checks.
vi.mock('@react-three/fiber', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-three/fiber')>()),
  Canvas: () => <div data-testid="canvas" />,
}));

const NO_FILES: ResourceProvider = { loadResource: async () => null };
const SCENE = '[gd_scene format=3]\n\n[node name="Main" type="Node3D"]\n';

type ViewAnswers = Pick<View, 'settled' | 'captureImage' | 'status'>;

describe('<TscnCanvas> ref', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rejects a capture before the view settles, naming the pending view', async () => {
    const view = createRef<ViewAnswers>();
    render(<TscnCanvas ref={view} scene={openScene({ source: SCENE, provider: NO_FILES })} />);
    await expect(view.current!.captureImage()).rejects.toThrow(/^expected a settled view, got /);
  });

  it('gives the status of the view, pending before its first frame', () => {
    const view = createRef<ViewAnswers>();
    render(<TscnCanvas ref={view} scene={openScene({ source: SCENE, provider: NO_FILES })} />);
    expect(view.current!.status()).toMatchObject({ settled: null, undrawn: [], frame: null });
  });

  it('rejects a pending settled once the view unmounts', async () => {
    const view = createRef<ViewAnswers>();
    const { unmount } = render(
      <TscnCanvas ref={view} scene={openScene({ source: SCENE, provider: NO_FILES })} />
    );
    const settled = view.current!.settled;
    unmount();
    await expect(settled).rejects.toThrow('expected the view to settle before its unmount');
  });
});
