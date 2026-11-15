/**
 * The 3D canvas takes its `frameloop` from the host's preview visibility. A happy-dom render
 * creates no WebGL context, so the test reads the props `<Canvas>` receives.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import { PreviewVisibilityProvider } from './contexts/PreviewVisibilityContext';
import { TscnCanvas } from './TscnCanvas';

vi.mock('@react-three/fiber', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-three/fiber')>()),
  Canvas: vi.fn(() => null),
}));

function frameloopWhen(isVisible: boolean) {
  vi.mocked(Canvas).mockClear();
  render(
    <PreviewVisibilityProvider isVisible={isVisible}>
      <TscnCanvas />
    </PreviewVisibilityProvider>
  );
  return vi.mocked(Canvas).mock.calls.at(-1)![0].frameloop;
}

describe('TscnCanvas frameloop', () => {
  it('renders no frame while the host hides the preview', () => {
    expect(frameloopWhen(false)).toBe('never');
  });

  it('renders every frame while the host shows the preview', () => {
    expect(frameloopWhen(true)).toBe('always');
  });
});
