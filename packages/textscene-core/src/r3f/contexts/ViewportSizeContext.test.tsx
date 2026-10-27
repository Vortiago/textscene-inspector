/** The viewport size a node reads: the SubViewport above it, else the project's. */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ViewportSizeProvider, useViewportSize } from './ViewportSizeContext';

function Probe() {
  const { x, y } = useViewportSize();
  return <span data-testid="size">{`${x}x${y}`}</span>;
}

describe('useViewportSize', () => {
  it("reads Godot's default window outside any SubViewport and any project", () => {
    render(<Probe />);
    expect(screen.getByTestId('size').textContent).toBe('1152x648');
  });

  it('reads the size of the nearest provider', () => {
    render(
      <ViewportSizeProvider size={{ x: 800, y: 600 }}>
        <ViewportSizeProvider size={{ x: 200, y: 400 }}>
          <Probe />
        </ViewportSizeProvider>
      </ViewportSizeProvider>
    );
    expect(screen.getByTestId('size').textContent).toBe('200x400');
  });
});
