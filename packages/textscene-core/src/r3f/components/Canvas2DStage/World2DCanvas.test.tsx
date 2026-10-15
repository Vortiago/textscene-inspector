/**
 * The props `World2DCanvas` hands R3F's `<Canvas>`. A happy-dom render creates no WebGL context,
 * so the test reads the props instead of the renderer they configure.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas, type CanvasProps } from '@react-three/fiber';
import { World2DCanvas } from './World2DCanvas';

vi.mock('@react-three/fiber', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-three/fiber')>()),
  Canvas: vi.fn(() => null),
}));

/** The props of the one `<Canvas>` a fresh `World2DCanvas` renders. */
function canvasProps(): CanvasProps {
  vi.mocked(Canvas).mockClear();
  render(
    <World2DCanvas nodes={[]} internalResources={[]} externalResources={[]} pan={{ x: 0, y: 0 }} zoom={1} />
  );
  expect(Canvas).toHaveBeenCalledTimes(1);
  return vi.mocked(Canvas).mock.calls[0]![0];
}

describe('World2DCanvas', () => {
  it('passes `flat`, so R3F selects NoToneMapping: Godot tone-maps only the 3D pass', () => {
    expect(canvasProps().flat).toBe(true);
  });

  it("asks for a non-multisampled drawing buffer, matching Godot's 2D viewport default", () => {
    // scene/main/viewport.h:309: `msaa_2d = MSAA_DISABLED`, the project setting's default
    // (rendering_server.cpp:3773). R3F defaults `antialias: true`, which resolves coverage on top
    // of the authored feather rings.
    expect(canvasProps().gl).toMatchObject({ antialias: false });
  });

  it('enables local clipping, without which three ignores the Control clip planes', () => {
    expect(canvasProps().gl).toMatchObject({ localClippingEnabled: true });
  });
});
