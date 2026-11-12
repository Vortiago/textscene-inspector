/**
 * `isVisible`, from the host, stops both canvases' frame loops while the preview is hidden.
 * A happy-dom render creates no WebGL context, so the test reads the props `<Canvas>` receives.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import { TscnPreviewShell } from './TscnPreviewShell';

vi.mock('@react-three/fiber', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-three/fiber')>()),
  Canvas: vi.fn(() => null),
}));

const NODE_ROOT = (type: 'Node2D' | 'Node3D') => `[gd_scene load_steps=1 format=3]

[node name="Root" type="${type}"]
`;

/** The `frameloop` of the last `<Canvas>` the shell mounts for `type`'s workspace. */
async function frameloopOf(type: 'Node2D' | 'Node3D', isVisible?: boolean) {
  vi.mocked(Canvas).mockClear();
  render(
    <TscnPreviewShell
      panelId={`visibility-${type}-${String(isVisible)}`}
      content={NODE_ROOT(type)}
      initialViewportMode={type === 'Node2D' ? '2D' : '3D'}
      isVisible={isVisible}
    />
  );
  await screen.findAllByText('Root');
  return vi.mocked(Canvas).mock.calls.at(-1)![0].frameloop;
}

describe('<TscnPreviewShell> isVisible', () => {
  it('stops the 3D canvas while the host hides the preview', async () => {
    expect(await frameloopOf('Node3D', false)).toBe('never');
  });

  it('stops the 2D canvas while the host hides the preview', async () => {
    expect(await frameloopOf('Node2D', false)).toBe('never');
  });

  it('runs the 3D canvas while the host shows the preview', async () => {
    expect(await frameloopOf('Node3D', true)).toBe('always');
  });

  it('runs the canvas when the host names no visibility (default)', async () => {
    expect(await frameloopOf('Node3D')).toBe('always');
  });
});
